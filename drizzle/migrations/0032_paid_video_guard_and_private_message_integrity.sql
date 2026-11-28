CREATE TABLE public.paid_video_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 provider text NOT NULL CHECK (provider IN ('runway','fal-avatar','fal-intro')),
 task_id text,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(provider, task_id)
);
GRANT SELECT ON public.paid_video_requests TO authenticated;
GRANT ALL ON public.paid_video_requests TO service_role;
ALTER TABLE public.paid_video_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY paid_video_read_own ON public.paid_video_requests FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE INDEX paid_video_created_idx ON public.paid_video_requests(created_at);
CREATE INDEX paid_video_user_created_idx ON public.paid_video_requests(user_id,created_at);
CREATE OR REPLACE FUNCTION public.reserve_paid_video(p_user uuid,p_provider text,p_hour integer,p_day integer,p_global_day integer) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE reservation uuid; current_time timestamptz := now();
BEGIN
 IF p_user IS NULL OR p_provider NOT IN ('runway','fal-avatar','fal-intro') OR p_hour NOT BETWEEN 1 AND 100 OR p_day NOT BETWEEN 1 AND 1000 OR p_global_day NOT BETWEEN 1 AND 10000 THEN RAISE EXCEPTION 'Invalid paid video reservation'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('noquit_paid_video_guard'));
 IF (SELECT count(*) FROM public.paid_video_requests WHERE user_id=p_user AND created_at > current_time - interval '1 hour') >= p_hour
 OR (SELECT count(*) FROM public.paid_video_requests WHERE user_id=p_user AND created_at > current_time - interval '24 hours') >= p_day
 OR (SELECT count(*) FROM public.paid_video_requests WHERE created_at > current_time - interval '24 hours') >= p_global_day THEN RETURN NULL; END IF;
 INSERT INTO public.paid_video_requests(user_id,provider) VALUES(p_user,p_provider) RETURNING id INTO reservation;
 RETURN reservation;
END $$;
REVOKE ALL ON FUNCTION public.reserve_paid_video(uuid,text,integer,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_paid_video(uuid,text,integer,integer,integer) TO service_role;
ALTER POLICY "own messages" ON public.messages USING (auth.uid()=user_id AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id=messages.conversation_id AND c.user_id=auth.uid())) WITH CHECK (auth.uid()=user_id AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id=messages.conversation_id AND c.user_id=auth.uid()));
CREATE OR REPLACE FUNCTION public.keep_dm_content_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF current_user='authenticated' AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id OR NEW.sender_id IS DISTINCT FROM OLD.sender_id OR NEW.text IS DISTINCT FROM OLD.text OR NEW.created_at IS DISTINCT FROM OLD.created_at) THEN RAISE EXCEPTION 'Message content cannot be changed'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER dm_message_content_integrity BEFORE UPDATE ON public.dm_messages FOR EACH ROW EXECUTE FUNCTION public.keep_dm_content_immutable();