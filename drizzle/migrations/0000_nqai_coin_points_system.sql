-- NQAI coin wallets
CREATE TABLE IF NOT EXISTS public.nqai_wallets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance numeric(20,4) NOT NULL DEFAULT 0,
  streak integer NOT NULL DEFAULT 0,
  last_mined_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.nqai_wallets TO authenticated;
GRANT ALL ON public.nqai_wallets TO service_role;
ALTER TABLE public.nqai_wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wallets readable by members" ON public.nqai_wallets;
CREATE POLICY "wallets readable by members" ON public.nqai_wallets
  FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.nqai_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(20,4) NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS nqai_tx_user_idx ON public.nqai_transactions (user_id, created_at DESC);

GRANT SELECT ON public.nqai_transactions TO authenticated;
GRANT ALL ON public.nqai_transactions TO service_role;
ALTER TABLE public.nqai_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own transactions" ON public.nqai_transactions;
CREATE POLICY "own transactions" ON public.nqai_transactions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- internal award helper
CREATE OR REPLACE FUNCTION public.nqai_award(_user uuid, _amount numeric, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _user IS NULL OR _amount IS NULL OR _amount = 0 THEN RETURN; END IF;
  INSERT INTO public.nqai_wallets (user_id, balance, updated_at)
  VALUES (_user, _amount, now())
  ON CONFLICT (user_id) DO UPDATE
    SET balance = public.nqai_wallets.balance + EXCLUDED.balance,
        updated_at = now();
  INSERT INTO public.nqai_transactions (user_id, amount, reason) VALUES (_user, _amount, _reason);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.nqai_award(uuid, numeric, text) FROM PUBLIC, anon, authenticated;

-- daily mining claim (Pi style)
CREATE OR REPLACE FUNCTION public.nqai_mine()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  w public.nqai_wallets%ROWTYPE;
  new_streak integer := 1;
  reward numeric := 5;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  INSERT INTO public.nqai_wallets (user_id) VALUES (uid) ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO w FROM public.nqai_wallets WHERE user_id = uid FOR UPDATE;

  IF w.last_mined_at IS NOT NULL AND w.last_mined_at > now() - interval '24 hours' THEN
    RETURN json_build_object(
      'ok', false,
      'balance', w.balance,
      'streak', w.streak,
      'next_at', w.last_mined_at + interval '24 hours'
    );
  END IF;

  IF w.last_mined_at IS NOT NULL AND w.last_mined_at > now() - interval '48 hours' THEN
    new_streak := w.streak + 1;
  END IF;

  reward := 5 + LEAST(new_streak - 1, 10);

  UPDATE public.nqai_wallets
     SET balance = balance + reward,
         streak = new_streak,
         last_mined_at = now(),
         updated_at = now()
   WHERE user_id = uid
   RETURNING * INTO w;

  INSERT INTO public.nqai_transactions (user_id, amount, reason)
  VALUES (uid, reward, 'Daily mining');

  RETURN json_build_object(
    'ok', true,
    'reward', reward,
    'balance', w.balance,
    'streak', w.streak,
    'next_at', w.last_mined_at + interval '24 hours'
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.nqai_mine() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nqai_mine() TO authenticated;

-- earn coins for community activity
CREATE OR REPLACE FUNCTION public.nqai_on_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.nqai_award(NEW.user_id, 2, 'Community post');
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.nqai_on_post() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS nqai_post_award ON public.community_posts;
CREATE TRIGGER nqai_post_award AFTER INSERT ON public.community_posts
FOR EACH ROW EXECUTE FUNCTION public.nqai_on_post();

CREATE OR REPLACE FUNCTION public.nqai_on_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.nqai_award(NEW.user_id, 1, 'Community comment');
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.nqai_on_comment() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS nqai_comment_award ON public.post_comments;
CREATE TRIGGER nqai_comment_award AFTER INSERT ON public.post_comments
FOR EACH ROW EXECUTE FUNCTION public.nqai_on_comment();

CREATE OR REPLACE FUNCTION public.nqai_on_referral()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.nqai_award(NEW.inviter_id, 20, 'Invite joined');
  PERFORM public.nqai_award(NEW.invited_user_id, 10, 'Joined via invite');
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.nqai_on_referral() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS nqai_referral_award ON public.referrals;
CREATE TRIGGER nqai_referral_award AFTER INSERT ON public.referrals
FOR EACH ROW EXECUTE FUNCTION public.nqai_on_referral();