CREATE TABLE public.referrals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inviter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referrals_no_self CHECK (inviter_id <> invited_user_id)
);

GRANT SELECT, INSERT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see referrals they are part of"
ON public.referrals FOR SELECT TO authenticated
USING (auth.uid() = inviter_id OR auth.uid() = invited_user_id);

CREATE POLICY "Invited user records their own referral"
ON public.referrals FOR INSERT TO authenticated
WITH CHECK (auth.uid() = invited_user_id);