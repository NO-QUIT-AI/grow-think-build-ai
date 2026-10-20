CREATE FUNCTION public.sync_jalsa_messages(items jsonb) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 IF jsonb_typeof(items) <> 'array' OR jsonb_array_length(items)>200 THEN RAISE EXCEPTION 'Invalid archive batch'; END IF;
 INSERT INTO public.jalsa_messages(owner_id,id,peer_id,sender_id,text,delivery,created_at)
 SELECT auth.uid(),r.id,r.peer_id,r.sender_id,r.text,r.delivery,r.created_at FROM jsonb_to_recordset(items) AS r(id uuid,peer_id uuid,sender_id uuid,text text,delivery text,created_at timestamptz)
 ON CONFLICT(owner_id,id) DO UPDATE SET delivery=CASE WHEN jalsa_messages.delivery='queued' THEN EXCLUDED.delivery ELSE jalsa_messages.delivery END;
END; $$;
REVOKE ALL ON FUNCTION public.sync_jalsa_messages(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sync_jalsa_messages(jsonb) TO authenticated;