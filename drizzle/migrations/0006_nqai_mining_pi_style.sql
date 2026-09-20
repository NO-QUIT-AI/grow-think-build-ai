CREATE TABLE IF NOT EXISTS public.nqai_mining (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_coins numeric NOT NULL DEFAULT 0,
  mining_rate numeric NOT NULL DEFAULT 0.5,
  last_claim_time timestamptz,
  session_start timestamptz,
  is_mining boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.nqai_mining TO authenticated;
GRANT ALL ON public.nqai_mining TO service_role;

ALTER TABLE public.nqai_mining ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read own mining row" ON public.nqai_mining
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Start a mining session (server time only)
CREATE OR REPLACE FUNCTION public.nqai_start_mining()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  m public.nqai_mining%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  INSERT INTO public.nqai_mining (user_id) VALUES (uid) ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO m FROM public.nqai_mining WHERE user_id = uid FOR UPDATE;

  IF m.is_mining AND m.session_start IS NOT NULL AND m.session_start > now() - interval '24 hours' THEN
    RETURN json_build_object('ok', false, 'reason', 'already_mining',
      'total_coins', m.total_coins, 'mining_rate', m.mining_rate,
      'is_mining', true, 'session_start', m.session_start,
      'ends_at', m.session_start + interval '24 hours');
  END IF;

  IF m.last_claim_time IS NOT NULL AND m.last_claim_time > now() - interval '24 hours' AND NOT m.is_mining THEN
    -- cooldown only applies if a session was claimed within the last 24h without restart allowance
    NULL;
  END IF;

  UPDATE public.nqai_mining
     SET is_mining = true, session_start = now(), updated_at = now()
   WHERE user_id = uid
   RETURNING * INTO m;

  RETURN json_build_object('ok', true, 'total_coins', m.total_coins, 'mining_rate', m.mining_rate,
    'is_mining', true, 'session_start', m.session_start, 'ends_at', m.session_start + interval '24 hours');
END;
$$;

-- Claim mined coins; session must be running. Max 24h worth.
CREATE OR REPLACE FUNCTION public.nqai_claim_mining()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  m public.nqai_mining%ROWTYPE;
  hours numeric;
  reward numeric;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  INSERT INTO public.nqai_mining (user_id) VALUES (uid) ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO m FROM public.nqai_mining WHERE user_id = uid FOR UPDATE;

  IF NOT m.is_mining OR m.session_start IS NULL THEN
    RETURN json_build_object('ok', false, 'reason', 'not_mining',
      'total_coins', m.total_coins, 'mining_rate', m.mining_rate, 'is_mining', false,
      'session_start', null, 'ends_at', null);
  END IF;

  IF m.last_claim_time IS NOT NULL AND m.last_claim_time > now() - interval '24 hours' THEN
    RETURN json_build_object('ok', false, 'reason', 'cooldown',
      'total_coins', m.total_coins, 'mining_rate', m.mining_rate, 'is_mining', m.is_mining,
      'session_start', m.session_start, 'ends_at', m.session_start + interval '24 hours',
      'next_claim_at', m.last_claim_time + interval '24 hours');
  END IF;

  hours := LEAST(EXTRACT(EPOCH FROM (now() - m.session_start)) / 3600.0, 24);
  reward := round(hours * m.mining_rate, 2);

  IF reward <= 0 THEN
    RETURN json_build_object('ok', false, 'reason', 'too_early',
      'total_coins', m.total_coins, 'mining_rate', m.mining_rate, 'is_mining', true,
      'session_start', m.session_start, 'ends_at', m.session_start + interval '24 hours');
  END IF;

  UPDATE public.nqai_mining
     SET total_coins = total_coins + reward,
         last_claim_time = now(),
         is_mining = true,
         session_start = now(),
         updated_at = now()
   WHERE user_id = uid
   RETURNING * INTO m;

  PERFORM public.nqai_award(uid, reward, 'Mining claim');

  RETURN json_build_object('ok', true, 'reward', reward, 'total_coins', m.total_coins,
    'mining_rate', m.mining_rate, 'is_mining', true, 'session_start', m.session_start,
    'ends_at', m.session_start + interval '24 hours',
    'next_claim_at', m.last_claim_time + interval '24 hours');
END;
$$;

-- Current mining state with server time
CREATE OR REPLACE FUNCTION public.nqai_mining_state()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  m public.nqai_mining%ROWTYPE;
  running boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO m FROM public.nqai_mining WHERE user_id = uid;

  IF NOT FOUND THEN
    RETURN json_build_object('total_coins', 0, 'mining_rate', 0.5, 'is_mining', false,
      'session_start', null, 'ends_at', null, 'next_claim_at', null,
      'pending', 0, 'server_time', now());
  END IF;

  running := m.is_mining AND m.session_start IS NOT NULL;

  RETURN json_build_object(
    'total_coins', m.total_coins,
    'mining_rate', m.mining_rate,
    'is_mining', running,
    'session_start', m.session_start,
    'ends_at', CASE WHEN running THEN m.session_start + interval '24 hours' ELSE null END,
    'next_claim_at', CASE WHEN m.last_claim_time IS NULL THEN null ELSE m.last_claim_time + interval '24 hours' END,
    'pending', CASE WHEN running THEN round(LEAST(EXTRACT(EPOCH FROM (now() - m.session_start)) / 3600.0, 24) * m.mining_rate, 2) ELSE 0 END,
    'server_time', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.nqai_start_mining() FROM public;
REVOKE ALL ON FUNCTION public.nqai_claim_mining() FROM public;
REVOKE ALL ON FUNCTION public.nqai_mining_state() FROM public;
GRANT EXECUTE ON FUNCTION public.nqai_start_mining() TO authenticated;
GRANT EXECUTE ON FUNCTION public.nqai_claim_mining() TO authenticated;
GRANT EXECUTE ON FUNCTION public.nqai_mining_state() TO authenticated;

-- Referral bonus: both sides +10
CREATE OR REPLACE FUNCTION public.nqai_on_referral()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.nqai_award(NEW.inviter_id, 10, 'Invite joined (+10)');
  PERFORM public.nqai_award(NEW.invited_user_id, 10, 'Joined via invite (+10)');
  RETURN NEW;
END;
$$;
