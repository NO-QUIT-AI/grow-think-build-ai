ALTER TABLE public.genesis_plans ADD COLUMN conversation_id uuid, ADD COLUMN completed_steps integer NOT NULL DEFAULT 0;
CREATE TABLE public.genesis_cost_approvals (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, conversation_id uuid NOT NULL, tool text NOT NULL, args jsonb NOT NULL, usd numeric NOT NULL CHECK (usd > 0), status text NOT NULL DEFAULT 'pending', created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.genesis_cost_approvals TO authenticated;
GRANT ALL ON public.genesis_cost_approvals TO service_role;
ALTER TABLE public.genesis_cost_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY cost_approval_user_read ON public.genesis_cost_approvals FOR SELECT TO authenticated USING (user_id=auth.uid());
CREATE OR REPLACE FUNCTION public.genesis_approve_action(p_id uuid,p_kind text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE found_id uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 IF p_kind='plan' THEN
 UPDATE public.genesis_plans SET status='approved' WHERE id=p_id AND user_id=auth.uid() AND status='pending' AND conversation_id IS NOT NULL RETURNING id INTO found_id;
 ELSIF p_kind='cost' THEN
 UPDATE public.genesis_cost_approvals SET status='approved' WHERE id=p_id AND user_id=auth.uid() AND status='pending' AND created_at>now()-interval '1 hour' RETURNING id INTO found_id;
 ELSE RAISE EXCEPTION 'Invalid action'; END IF;
 IF found_id IS NULL THEN RAISE EXCEPTION 'Approval expired or already used'; END IF;
 RETURN jsonb_build_object('approved',true,'id',found_id);
END $$;
REVOKE ALL ON FUNCTION public.genesis_approve_action(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.genesis_approve_action(uuid,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.genesis_claim_plan(p_user uuid,p_id uuid,p_conversation uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.genesis_plans;
BEGIN
 UPDATE public.genesis_plans SET status='running' WHERE id=p_id AND user_id=p_user AND conversation_id=p_conversation AND status='approved' RETURNING * INTO p;
 IF p.id IS NULL THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('id',p.id,'steps',p.steps);
END $$;
REVOKE ALL ON FUNCTION public.genesis_claim_plan(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.genesis_claim_plan(uuid,uuid,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.genesis_consume_cost(p_user uuid,p_id uuid,p_conversation uuid,p_tool text,p_args jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE found_id uuid;
BEGIN
 UPDATE public.genesis_cost_approvals SET status='used' WHERE id=p_id AND user_id=p_user AND conversation_id=p_conversation AND tool=p_tool AND args=p_args AND status='approved' AND created_at>now()-interval '1 hour' RETURNING id INTO found_id;
 RETURN found_id IS NOT NULL;
END $$;
REVOKE ALL ON FUNCTION public.genesis_consume_cost(uuid,uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.genesis_consume_cost(uuid,uuid,uuid,text,jsonb) TO service_role;