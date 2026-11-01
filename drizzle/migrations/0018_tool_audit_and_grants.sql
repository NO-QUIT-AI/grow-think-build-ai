CREATE TABLE public.tool_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tool text NOT NULL,
  args jsonb,
  result jsonb,
  ok boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.tool_audit_log TO authenticated;
GRANT ALL ON public.tool_audit_log TO service_role;
ALTER TABLE public.tool_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own audit insert" ON public.tool_audit_log FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "owner audit read" ON public.tool_audit_log FOR SELECT TO authenticated USING (public.is_owner(auth.uid()));
CREATE INDEX tool_audit_log_user_idx ON public.tool_audit_log(user_id, created_at DESC);

CREATE TABLE public.tool_permission_grants (
  user_id uuid NOT NULL,
  scope text NOT NULL CHECK (scope IN ('deploy','domain')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, scope)
);
GRANT SELECT, INSERT, DELETE ON public.tool_permission_grants TO authenticated;
GRANT ALL ON public.tool_permission_grants TO service_role;
ALTER TABLE public.tool_permission_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own grants" ON public.tool_permission_grants FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());