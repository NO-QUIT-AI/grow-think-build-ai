create table public.hd_redirect_clicks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  partner text not null check (partner in ('creatomate','capcut')),
  reason text not null,
  created_at timestamptz not null default now()
);
alter table public.hd_redirect_clicks enable row level security;
grant insert on public.hd_redirect_clicks to anon, authenticated;
grant select on public.hd_redirect_clicks to authenticated;
create policy "anyone logs click" on public.hd_redirect_clicks for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());
create policy "owner reads clicks" on public.hd_redirect_clicks for select to authenticated
  using (public.is_owner(auth.uid()));