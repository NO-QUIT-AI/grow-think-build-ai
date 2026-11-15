CREATE TABLE public.security_backup_settings (user_id uuid PRIMARY KEY, auto_enabled boolean NOT NULL DEFAULT false, last_backup_at timestamptz, object_id uuid, row_count integer NOT NULL DEFAULT 0);
GRANT SELECT, INSERT, UPDATE ON public.security_backup_settings TO authenticated;
GRANT ALL ON public.security_backup_settings TO service_role;
ALTER TABLE public.security_backup_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own backup status" ON public.security_backup_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Insert own backup choice" ON public.security_backup_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Change own backup choice" ON public.security_backup_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
REVOKE INSERT, UPDATE ON public.security_backup_settings FROM authenticated;
GRANT INSERT (user_id, auto_enabled), UPDATE (auto_enabled) ON public.security_backup_settings TO authenticated;