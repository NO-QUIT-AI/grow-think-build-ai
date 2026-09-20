ALTER TABLE public.nqai_mining ADD COLUMN IF NOT EXISTS total_invites integer NOT NULL DEFAULT 0;

-- Backfill existing rows from referrals count
UPDATE public.nqai_mining m
SET total_invites = (SELECT count(*) FROM public.referrals r WHERE r.inviter_id = m.user_id),
    mining_rate = 0.5 + (SELECT count(*) FROM public.referrals r WHERE r.inviter_id = m.user_id) * 0.1,
    updated_at = now();

-- Referral trigger: +10 dono ko (pehle se) + inviter ki speed boost
CREATE OR REPLACE FUNCTION public.nqai_on_referral()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.nqai_award(NEW.inviter_id, 10, 'Invite joined (+10)');
  PERFORM public.nqai_award(NEW.invited_user_id, 10, 'Joined via invite (+10)');

  INSERT INTO public.nqai_mining (user_id, total_invites, mining_rate)
  VALUES (NEW.inviter_id, 1, 0.6)
  ON CONFLICT (user_id) DO UPDATE
    SET total_invites = public.nqai_mining.total_invites + 1,
        mining_rate = 0.5 + (public.nqai_mining.total_invites + 1) * 0.1,
        updated_at = now();

  RETURN NEW;
END;
$function$;

-- Mining state: rate hamesha live referrals se sync rahe
CREATE OR REPLACE FUNCTION public.nqai_mining_state()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  m public.nqai_mining%ROWTYPE;
  running boolean;
  invites integer;
  speed numeric;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  invites := (SELECT count(*) FROM public.referrals r WHERE r.inviter_id = uid);
  speed := 0.5 + invites * 0.1;

  INSERT INTO public.nqai_mining (user_id) VALUES (uid) ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.nqai_mining
     SET total_invites = invites, mining_rate = speed, updated_at = now()
   WHERE user_id = uid
     AND (total_invites IS DISTINCT FROM invites OR mining_rate IS DISTINCT FROM speed);

  SELECT * INTO m FROM public.nqai_mining WHERE user_id = uid;

  running := m.is_mining AND m.session_start IS NOT NULL;

  RETURN json_build_object(
    'total_coins', m.total_coins,
    'mining_rate', m.mining_rate,
    'total_invites', m.total_invites,
    'is_mining', running,
    'session_start', m.session_start,
    'ends_at', CASE WHEN running THEN m.session_start + interval '24 hours' ELSE null END,
    'next_claim_at', CASE WHEN m.last_claim_time IS NULL THEN null ELSE m.last_claim_time + interval '24 hours' END,
    'pending', CASE WHEN running THEN round(LEAST(EXTRACT(EPOCH FROM (now() - m.session_start)) / 3600.0, 24) * m.mining_rate, 2) ELSE 0 END,
    'server_time', now()
  );
END;
$function$;