DELETE FROM public.owners WHERE lower(email) = 'noquitai1@gmail.com';
INSERT INTO public.owners (email) VALUES ('ranaimranp2@gmail.com') ON CONFLICT (email) DO NOTHING;