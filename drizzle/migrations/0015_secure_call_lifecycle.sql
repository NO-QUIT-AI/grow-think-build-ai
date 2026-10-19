CREATE OR REPLACE FUNCTION public.validate_call_invite() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.from_user = NEW.to_user OR NOT public.are_friends(NEW.from_user, NEW.to_user) THEN
      RAISE EXCEPTION 'Calls require accepted friends';
    END IF;
    IF NEW.status <> 'ringing' OR NEW.from_user IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Invalid call invitation';
    END IF;
    NEW.created_at := now();
  ELSE
    IF NEW.from_user IS DISTINCT FROM OLD.from_user OR NEW.to_user IS DISTINCT FROM OLD.to_user OR NEW.room_id IS DISTINCT FROM OLD.room_id OR NEW.call_type IS DISTINCT FROM OLD.call_type OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Call participants and room cannot change';
    END IF;
    IF auth.uid() IS NULL OR (auth.uid() <> OLD.from_user AND auth.uid() <> OLD.to_user) THEN
      RAISE EXCEPTION 'Not a call participant';
    END IF;
    IF NEW.status = OLD.status THEN RETURN NEW; END IF;
    IF OLD.status = 'ringing' THEN
      IF NEW.status NOT IN ('accepted', 'rejected', 'missed') THEN RAISE EXCEPTION 'Invalid ringing transition'; END IF;
      IF NEW.status IN ('accepted', 'rejected') AND auth.uid() <> OLD.to_user THEN RAISE EXCEPTION 'Only receiver can answer'; END IF;
      IF NEW.status = 'accepted' AND (OLD.created_at < now() - interval '30 seconds' OR NOT public.are_friends(OLD.from_user, OLD.to_user)) THEN RAISE EXCEPTION 'Invitation expired or friendship ended'; END IF;
    ELSIF OLD.status = 'accepted' AND NEW.status = 'ended' THEN
      NULL;
    ELSE RAISE EXCEPTION 'Call already closed';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_call_invite() FROM PUBLIC;
CREATE TRIGGER validate_call_invite_before_write BEFORE INSERT OR UPDATE ON public.call_invites FOR EACH ROW EXECUTE FUNCTION public.validate_call_invite();
CREATE INDEX IF NOT EXISTS call_invites_receiver_status ON public.call_invites (to_user, status, created_at);
