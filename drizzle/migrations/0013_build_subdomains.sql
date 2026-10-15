ALTER TABLE public.memories ADD COLUMN IF NOT EXISTS subdomain text, ADD COLUMN IF NOT EXISTS custom_domain text, ADD COLUMN IF NOT EXISTS domain_status text NOT NULL DEFAULT 'none', ADD COLUMN IF NOT EXISTS subdomain_edits integer NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS memories_subdomain_key ON public.memories (subdomain) WHERE subdomain IS NOT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subdomain text, ADD COLUMN IF NOT EXISTS custom_domain text, ADD COLUMN IF NOT EXISTS domain_status text;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_subdomain_key ON public.profiles (subdomain) WHERE subdomain IS NOT NULL;

CREATE OR REPLACE FUNCTION public.subdomain_valid(_s text) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT _s ~ '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$' AND _s NOT IN ('www','api','admin','app','mail','blog','auth','studio','cdn','static','dev','ftp','noquitai');
$$;

CREATE OR REPLACE FUNCTION public.check_subdomain_availability(_subdomain text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.subdomain_valid(lower(_subdomain)) AND NOT EXISTS (SELECT 1 FROM public.memories WHERE subdomain = lower(_subdomain));
$$;

CREATE OR REPLACE FUNCTION public.slugify(_t text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT trim(both '-' from regexp_replace(lower(coalesce(_t,'')), '[^a-z0-9]+', '-', 'g'));
$$;

CREATE OR REPLACE FUNCTION public.publish_build(_build_id uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.memories; base text; uname text; cand text; n int := 1;
BEGIN
  SELECT * INTO m FROM public.memories WHERE id = _build_id AND user_id = auth.uid();
  IF m.id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  IF m.subdomain IS NOT NULL THEN RETURN m.subdomain; END IF;
  SELECT public.slugify(coalesce(username, display_name, 'user')) INTO uname FROM public.profiles WHERE id = auth.uid();
  base := left(public.slugify(array_to_string((regexp_split_to_array(trim(coalesce(nullif(m.summary,''), m.prompt)), '\s+'))[1:2], ' ')), 18);
  IF base = '' THEN base := 'app'; END IF;
  base := left(base || '-' || coalesce(nullif(uname,''), 'user'), 36);
  base := trim(both '-' from base);
  IF length(base) < 3 THEN base := base || '-app'; END IF;
  cand := base;
  WHILE NOT public.check_subdomain_availability(cand) LOOP
    n := n + 1; cand := base || n;
  END LOOP;
  UPDATE public.memories SET subdomain = cand, domain_status = 'active' WHERE id = m.id;
  RETURN cand;
END $$;

CREATE OR REPLACE FUNCTION public.rename_build_subdomain(_build_id uuid, _subdomain text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.memories; s text := lower(trim(_subdomain));
BEGIN
  SELECT * INTO m FROM public.memories WHERE id = _build_id AND user_id = auth.uid();
  IF m.id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  IF m.subdomain_edits >= 1 THEN RAISE EXCEPTION 'already edited once'; END IF;
  IF NOT public.check_subdomain_availability(s) THEN RAISE EXCEPTION 'not available'; END IF;
  UPDATE public.memories SET subdomain = s, subdomain_edits = subdomain_edits + 1, domain_status = 'active' WHERE id = m.id;
  RETURN s;
END $$;

CREATE OR REPLACE FUNCTION public.get_site_by_subdomain(_subdomain text) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(nullif(code,''), blueprint->>'html') FROM public.memories WHERE subdomain = lower(_subdomain) AND project_type = 'website' LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.publish_build(uuid), public.rename_build_subdomain(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.publish_build(uuid), public.rename_build_subdomain(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_subdomain_availability(text), public.get_site_by_subdomain(text) TO anon, authenticated;