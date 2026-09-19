CREATE TABLE public.ad_impressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  slot text NOT NULL,
  page text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ad_impressions_created_idx ON public.ad_impressions (created_at DESC);

GRANT INSERT ON public.ad_impressions TO authenticated;
GRANT ALL ON public.ad_impressions TO service_role;

ALTER TABLE public.ad_impressions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users log own impressions"
ON public.ad_impressions FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users read own impressions"
ON public.ad_impressions FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Aggregate-only stats (no personal data leaves this function)
CREATE OR REPLACE FUNCTION public.ad_stats()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'total', (SELECT count(*) FROM public.ad_impressions),
    'today', (SELECT count(*) FROM public.ad_impressions WHERE created_at >= date_trunc('day', now())),
    'last7', (SELECT count(*) FROM public.ad_impressions WHERE created_at >= now() - interval '7 days'),
    'last30', (SELECT count(*) FROM public.ad_impressions WHERE created_at >= now() - interval '30 days'),
    'viewers', (SELECT count(DISTINCT user_id) FROM public.ad_impressions)
  )
$$;

REVOKE EXECUTE ON FUNCTION public.ad_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ad_stats() TO authenticated;