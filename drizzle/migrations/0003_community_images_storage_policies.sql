-- Members can upload their own community images and everyone signed-in can read them
CREATE POLICY "community images readable by members"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'community-images');

CREATE POLICY "members upload own community images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'community-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "members update own community images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'community-images' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'community-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "members delete own community images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'community-images' AND (storage.foldername(name))[1] = auth.uid()::text);
