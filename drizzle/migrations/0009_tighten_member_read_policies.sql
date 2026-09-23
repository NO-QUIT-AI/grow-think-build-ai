ALTER POLICY "posts readable by members" ON public.community_posts USING (auth.uid() IS NOT NULL);
ALTER POLICY "replies readable by members" ON public.community_replies USING (auth.uid() IS NOT NULL);
ALTER POLICY "member profiles readable" ON public.profiles USING (auth.uid() IS NOT NULL);
ALTER POLICY "likes readable by members" ON public.post_likes USING (auth.uid() IS NOT NULL);
ALTER POLICY "comments readable by members" ON public.post_comments USING (auth.uid() IS NOT NULL);
ALTER POLICY "follows readable by members" ON public.follows USING (auth.uid() IS NOT NULL);
ALTER POLICY "community images readable by members" ON storage.objects USING (
  bucket_id = 'community-images' AND auth.uid() IS NOT NULL AND (
    owner_id = (select auth.uid()::text)
    OR EXISTS (SELECT 1 FROM public.community_posts p WHERE p.image_url IS NOT NULL AND position(objects.name in p.image_url) > 0)
  )
);