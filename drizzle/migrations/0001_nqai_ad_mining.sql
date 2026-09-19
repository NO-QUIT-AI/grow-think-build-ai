ALTER TABLE public.nqai_wallets ADD COLUMN IF NOT EXISTS last_share_at timestamptz;

CREATE OR REPLACE FUNCTION public.nqai_invite_multiplier(_user uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT LEAST(1 + (SELECT count(*) FROM public.referrals r WHERE r.inviter_id = _user), 10)::numeric;
$$;

REVOKE EXECUTE ON FUNCTION public.nqai_invite_multiplier(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nqai_invite_multiplier(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.nqai_mine_ad(_ad_watched boolean)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  w public.nqai_wallets%ROWTYPE;
  new_streak integer := 1;
  mult numeric := 1;
  reward numeric := 1;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  INSERT INTO public.nqai_wallets (user_id) VALUES (uid) ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO w FROM public.nqai_wallets WHERE user_id = uid FOR UPDATE;

  mult := public.nqai_invite_multiplier(uid);

  IF w.last_mined_at IS NOT NULL AND w.last_mined_at > now() - interval '24 hours' THEN
    RETURN json_build_object('ok', false, 'reason', 'cooldown', 'balance', w.balance,
      'streak', w.streak, 'multiplier', mult, 'next_at', w.last_mined_at + interval '24 hours');
  END IF;

  IF _ad_watched IS NOT TRUE THEN
    RETURN json_build_object('ok', false, 'reason', 'ad_required', 'balance', w.balance,
      'streak', w.streak, 'multiplier', mult, 'next_at', null);
  END IF;

  IF w.last_mined_at IS NOT NULL AND w.last_mined_at > now() - interval '48 hours' THEN
    new_streak := w.streak + 1;
  END IF;

  reward := round(1 * mult, 2);

  UPDATE public.nqai_wallets
     SET balance = balance + reward, streak = new_streak,
         last_mined_at = now(), updated_at = now()
   WHERE user_id = uid RETURNING * INTO w;

  INSERT INTO public.nqai_transactions (user_id, amount, reason)
  VALUES (uid, reward, 'Ad dekh kar mining (x' || mult || ')');

  RETURN json_build_object('ok', true, 'reward', reward, 'balance', w.balance,
    'streak', w.streak, 'multiplier', mult, 'next_at', w.last_mined_at + interval '24 hours');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.nqai_mine_ad(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nqai_mine_ad(boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.nqai_share_bonus()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  w public.nqai_wallets%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  INSERT INTO public.nqai_wallets (user_id) VALUES (uid) ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO w FROM public.nqai_wallets WHERE user_id = uid FOR UPDATE;

  IF w.last_share_at IS NOT NULL AND w.last_share_at > now() - interval '24 hours' THEN
    RETURN json_build_object('ok', false, 'balance', w.balance,
      'next_at', w.last_share_at + interval '24 hours');
  END IF;

  UPDATE public.nqai_wallets
     SET balance = balance + 1, last_share_at = now(), updated_at = now()
   WHERE user_id = uid RETURNING * INTO w;

  INSERT INTO public.nqai_transactions (user_id, amount, reason)
  VALUES (uid, 1, 'Daily invite link share');

  RETURN json_build_object('ok', true, 'reward', 1, 'balance', w.balance,
    'next_at', w.last_share_at + interval '24 hours');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.nqai_share_bonus() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nqai_share_bonus() TO authenticated;