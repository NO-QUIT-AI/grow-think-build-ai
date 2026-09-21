-- 1. Unique invite code per user
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS invite_code text;

CREATE OR REPLACE FUNCTION public.gen_invite_code()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
  i int;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..8 LOOP
      code := code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.invite_code = code);
  END LOOP;
  RETURN code;
END;
$$;

UPDATE public.profiles SET invite_code = public.gen_invite_code() WHERE invite_code IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_invite_code_key ON public.profiles (invite_code);

ALTER TABLE public.profiles ALTER COLUMN invite_code SET DEFAULT NULL;

-- 2. New users get a code automatically
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, username, invite_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'member_' || replace(substr(NEW.id::text, 1, 8), '-', ''),
    public.gen_invite_code()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 3. One referral per invited user (anti-abuse)
CREATE UNIQUE INDEX IF NOT EXISTS referrals_invited_user_key ON public.referrals (invited_user_id);

-- 4. Redeem an invite code — the only path that awards invite points
CREATE OR REPLACE FUNCTION public.nqai_redeem_invite(_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  inviter uuid;
  joined_at timestamptz;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  IF EXISTS (SELECT 1 FROM public.referrals r WHERE r.invited_user_id = uid) THEN
    RETURN json_build_object('ok', false, 'reason', 'already_redeemed');
  END IF;

  SELECT p.id INTO inviter
    FROM public.profiles p
   WHERE upper(trim(_code)) = upper(p.invite_code)
   LIMIT 1;

  IF inviter IS NULL THEN
    RETURN json_build_object('ok', false, 'reason', 'invalid_code');
  END IF;

  IF inviter = uid THEN
    RETURN json_build_object('ok', false, 'reason', 'self_invite');
  END IF;

  SELECT u.created_at INTO joined_at FROM auth.users u WHERE u.id = uid;
  IF joined_at IS NULL OR joined_at < now() - interval '7 days' THEN
    RETURN json_build_object('ok', false, 'reason', 'account_too_old');
  END IF;

  INSERT INTO public.referrals (inviter_id, invited_user_id) VALUES (inviter, uid);

  RETURN json_build_object('ok', true, 'reason', 'redeemed');
END;
$$;

GRANT EXECUTE ON FUNCTION public.nqai_redeem_invite(text) TO authenticated;

-- 5. Points only come from real invites: daily share bonus disabled
CREATE OR REPLACE FUNCTION public.nqai_share_bonus()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  bal numeric := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT balance INTO bal FROM public.nqai_wallets WHERE user_id = uid;
  RETURN json_build_object('ok', false, 'reason', 'invite_only', 'balance', COALESCE(bal, 0), 'next_at', null);
END;
$$;