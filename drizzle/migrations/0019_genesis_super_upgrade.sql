CREATE TABLE public.genesis_patches (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, target_file text NOT NULL, patch_description text NOT NULL DEFAULT '', previous_content text NOT NULL DEFAULT '', new_content text NOT NULL, status text NOT NULL DEFAULT 'pending', created_at timestamptz NOT NULL DEFAULT now(), applied_at timestamptz);
GRANT SELECT ON public.genesis_patches TO authenticated;
GRANT ALL ON public.genesis_patches TO service_role;
ALTER TABLE public.genesis_patches ENABLE ROW LEVEL SECURITY;
CREATE POLICY patches_owner_read ON public.genesis_patches FOR SELECT TO authenticated USING (user_id = auth.uid() AND public.is_owner(auth.uid()));
CREATE TABLE public.genesis_plans (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, steps jsonb NOT NULL, status text NOT NULL DEFAULT 'pending', created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.genesis_plans TO authenticated;
GRANT ALL ON public.genesis_plans TO service_role;
ALTER TABLE public.genesis_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY plans_user_read ON public.genesis_plans FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE TABLE public.genesis_budgets (user_id uuid PRIMARY KEY, monthly_usd numeric NOT NULL DEFAULT 0 CHECK (monthly_usd >= 0), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE ON public.genesis_budgets TO authenticated;
GRANT ALL ON public.genesis_budgets TO service_role;
ALTER TABLE public.genesis_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY budget_user ON public.genesis_budgets FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TABLE public.usage (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, tool text NOT NULL, tokens integer, usd numeric NOT NULL DEFAULT 0 CHECK (usd >= 0), cost_kind text NOT NULL DEFAULT 'estimate', status text NOT NULL DEFAULT 'reserved', created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.usage TO authenticated;
GRANT ALL ON public.usage TO service_role;
ALTER TABLE public.usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY usage_user_read ON public.usage FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE INDEX usage_user_month ON public.usage(user_id, created_at);
CREATE INDEX patches_target_latest ON public.genesis_patches(user_id,target_file,applied_at DESC);
CREATE INDEX knowledge_user_topic ON public.knowledge(user_id,topic);
CREATE OR REPLACE FUNCTION public.genesis_reserve_usage(p_user uuid, p_tool text, p_usd numeric) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cap numeric; spent numeric; entry_id uuid;
BEGIN
 IF p_usd < 0 THEN RAISE EXCEPTION 'Invalid cost'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
 IF p_usd > 0 THEN
  SELECT monthly_usd INTO cap FROM public.genesis_budgets WHERE user_id=p_user FOR UPDATE;
  IF cap IS NULL THEN RAISE EXCEPTION 'Set a monthly budget before paid tools'; END IF;
  SELECT coalesce(sum(usd),0) INTO spent FROM public.usage WHERE user_id=p_user AND created_at>=date_trunc('month',now()) AND status IN ('reserved','completed','uncertain');
  IF spent+p_usd>cap THEN RAISE EXCEPTION 'Monthly budget exceeded'; END IF;
 END IF;
 INSERT INTO public.usage(user_id,tool,usd) VALUES(p_user,p_tool,p_usd) RETURNING id INTO entry_id;
 RETURN entry_id;
END $$;
REVOKE ALL ON FUNCTION public.genesis_reserve_usage(uuid,text,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.genesis_reserve_usage(uuid,text,numeric) TO service_role;
CREATE OR REPLACE FUNCTION public.genesis_confirm_patch(p_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.genesis_patches; current_content text;
BEGIN
 IF NOT public.is_owner(auth.uid()) THEN RAISE EXCEPTION 'Owner only'; END IF;
 SELECT * INTO p FROM public.genesis_patches WHERE id=p_id AND user_id=auth.uid() FOR UPDATE;
 IF p.id IS NULL OR p.status<>'pending' THEN RAISE EXCEPTION 'Patch not pending'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p.user_id::text||p.target_file,0));
 SELECT new_content INTO current_content FROM public.genesis_patches WHERE user_id=p.user_id AND target_file=p.target_file AND status='applied' ORDER BY applied_at DESC LIMIT 1;
 IF coalesce(current_content,'')<>p.previous_content THEN RAISE EXCEPTION 'Configuration changed. Preview a new patch.'; END IF;
 UPDATE public.genesis_patches SET status='applied', applied_at=clock_timestamp() WHERE id=p_id;
 RETURN jsonb_build_object('applied',true,'targetFile',p.target_file);
END $$;
REVOKE ALL ON FUNCTION public.genesis_confirm_patch(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.genesis_confirm_patch(uuid) TO authenticated;