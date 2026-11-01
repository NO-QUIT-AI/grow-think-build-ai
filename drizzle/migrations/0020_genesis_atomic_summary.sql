CREATE OR REPLACE FUNCTION public.genesis_save_summary(p_topic text,p_content text,p_tags text[],p_source text) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE n integer; merged text; keep_id uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 IF length(p_content)>6000 OR length(p_topic)>200 THEN RAISE EXCEPTION 'Summary too long'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_topic,0));
 SELECT count(*) INTO n FROM public.knowledge WHERE user_id=auth.uid() AND topic=p_topic;
 IF n>=10 THEN
  SELECT string_agg(content,E'\n' ORDER BY created_at DESC), (array_agg(id ORDER BY created_at DESC))[1] INTO merged,keep_id FROM public.knowledge WHERE user_id=auth.uid() AND topic=p_topic;
  UPDATE public.knowledge SET content=left(p_content||E'\n'||coalesce(merged,''),6000),tags=p_tags,source=p_source,updated_at=now() WHERE id=keep_id AND user_id=auth.uid();
  DELETE FROM public.knowledge WHERE user_id=auth.uid() AND topic=p_topic AND id<>keep_id;
  RETURN jsonb_build_object('saved',true,'consolidated',true);
 END IF;
 INSERT INTO public.knowledge(user_id,topic,content,tags,source,confidence) VALUES(auth.uid(),p_topic,p_content,p_tags,p_source,0.8);
 RETURN jsonb_build_object('saved',true,'consolidated',false);
END $$;
REVOKE ALL ON FUNCTION public.genesis_save_summary(text,text,text[],text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.genesis_save_summary(text,text,text[],text) TO authenticated;