create extension if not exists "pgcrypto";

create type public.work_status as enum ('pending', 'published', 'rejected', 'removed');

create table public.works (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null check (char_length(title) between 1 and 120),
  author_username text not null check (char_length(author_username) between 1 and 80),
  author_profile_url text,
  source_url text not null,
  description text not null default '' check (char_length(description) <= 500),
  tags text[] not null default '{}',
  html_path text not null,
  status public.work_status not null default 'pending',
  submitted_by uuid references auth.users(id) on delete set null,
  submitted_at timestamptz not null default now(),
  published_at timestamptz,
  moderated_at timestamptz,
  moderation_note text
);

create index works_status_submitted_at_idx on public.works(status, submitted_at desc);

create table public.votes (
  work_id uuid not null references public.works(id) on delete cascade,
  voter_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 4),
  updated_at timestamptz not null default now(),
  primary key (work_id, voter_id)
);

create index votes_work_id_idx on public.votes(work_id);

create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  created_at timestamptz not null default now()
);

create table public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.site_settings(key, value) values
  ('premium_break_rate_threshold', '0.50'::jsonb),
  ('premium_min_votes', '10'::jsonb),
  ('auto_advance_ms', '1000'::jsonb)
on conflict (key) do nothing;

create table public.takedown_requests (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works(id) on delete cascade,
  requester_contact text not null check (char_length(requester_contact) between 3 and 160),
  reason text not null check (char_length(reason) between 5 and 1000),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create or replace view public.work_vote_stats as
select
  w.id as work_id,
  count(v.*)::int as total_votes,
  count(v.*) filter (where v.rating = 1)::int as rating_1,
  count(v.*) filter (where v.rating = 2)::int as rating_2,
  count(v.*) filter (where v.rating = 3)::int as rating_3,
  count(v.*) filter (where v.rating = 4)::int as rating_4,
  coalesce(round((count(v.*) filter (where v.rating = 4))::numeric / nullif(count(v.*), 0), 4), 0)::numeric as break_rate
from public.works w
left join public.votes v on v.work_id = w.id
group by w.id;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.admins where user_id = auth.uid());
$$;

create or replace function public.cast_vote(p_work_id uuid, p_rating smallint)
returns table (total_votes int, rating_1 int, rating_2 int, rating_3 int, rating_4 int, break_rate numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'anonymous session required'; end if;
  if p_rating not between 1 and 4 then raise exception 'rating must be between 1 and 4'; end if;
  if not exists (select 1 from public.works where id = p_work_id and status = 'published') then raise exception 'work is not published'; end if;

  insert into public.votes(work_id, voter_id, rating, updated_at)
  values (p_work_id, v_user, p_rating, now())
  on conflict (work_id, voter_id) do update set rating = excluded.rating, updated_at = now();

  return query select s.total_votes, s.rating_1, s.rating_2, s.rating_3, s.rating_4, s.break_rate
  from public.work_vote_stats s where s.work_id = p_work_id;
end;
$$;

alter table public.works enable row level security;
alter table public.votes enable row level security;
alter table public.admins enable row level security;
alter table public.site_settings enable row level security;
alter table public.takedown_requests enable row level security;

create policy "public can read published works" on public.works for select using (status = 'published' or public.is_admin());
create policy "admins can manage works" on public.works for all using (public.is_admin()) with check (public.is_admin());

create policy "users can read their own vote" on public.votes for select using (voter_id = auth.uid() or public.is_admin());
create policy "users can write their own vote" on public.votes for insert with check (voter_id = auth.uid());
create policy "users can update their own vote" on public.votes for update using (voter_id = auth.uid()) with check (voter_id = auth.uid());

create policy "public can read settings" on public.site_settings for select using (true);
create policy "admins can update settings" on public.site_settings for all using (public.is_admin()) with check (public.is_admin());

create policy "public can submit takedown requests" on public.takedown_requests for insert with check (true);
create policy "admins can manage takedown requests" on public.takedown_requests for all using (public.is_admin()) with check (public.is_admin());

revoke all on public.votes from anon, authenticated;
grant select on public.works, public.site_settings, public.work_vote_stats to anon, authenticated;
grant execute on function public.cast_vote(uuid, smallint) to authenticated;
grant execute on function public.is_admin() to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('pending-html', 'pending-html', false, 5242880, array['text/html']),
  ('published-html', 'published-html', true, 5242880, array['text/html'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "anonymous sessions can upload their own pending html" on storage.objects for insert to authenticated
with check (bucket_id = 'pending-html' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "public can read published html" on storage.objects for select to public
using (bucket_id = 'published-html');
create policy "admins can manage html" on storage.objects for all to authenticated
using (public.is_admin()) with check (public.is_admin());
