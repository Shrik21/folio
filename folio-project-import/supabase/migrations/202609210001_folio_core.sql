-- Folio core schema. Apply with `supabase db push` or from the Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  full_name text not null default '',
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Untitled portfolio',
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  profession text not null default 'professional',
  purpose text not null default 'job-search',
  template_key text not null default 'ledger'
    check (template_key in ('ledger', 'atlas', 'gallery', 'brief')),
  accent text not null default 'ochre'
    check (accent in ('ochre', 'teal', 'blue', 'plum')),
  status text not null default 'draft' check (status in ('draft', 'published', 'unpublished')),
  content jsonb not null default '{}'::jsonb,
  ai_meta jsonb not null default '{}'::jsonb,
  view_count bigint not null default 0 check (view_count >= 0),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists portfolios_user_id_idx on public.portfolios(user_id);
create index if not exists portfolios_status_idx on public.portfolios(status);
create index if not exists portfolios_published_at_idx on public.portfolios(published_at desc)
  where status = 'published';

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists portfolios_set_updated_at on public.portfolios;
create trigger portfolios_set_updated_at
before update on public.portfolios
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of email on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.increment_portfolio_view(target_slug text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.portfolios
  set view_count = view_count + 1
  where slug = target_slug and status = 'published';
$$;

revoke all on function public.increment_portfolio_view(text) from public;
grant execute on function public.increment_portfolio_view(text) to anon, authenticated;

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Only an administrator can change account roles';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role
before update on public.profiles
for each row execute function public.protect_profile_role();

alter table public.profiles enable row level security;
alter table public.portfolios enable row level security;

drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin on public.profiles
for select to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_self_or_admin on public.profiles;
create policy profiles_update_self_or_admin on public.profiles
for update to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

drop policy if exists portfolios_select_visible on public.portfolios;
create policy portfolios_select_visible on public.portfolios
for select
using (status = 'published' or user_id = auth.uid() or public.is_admin());

drop policy if exists portfolios_insert_owner on public.portfolios;
create policy portfolios_insert_owner on public.portfolios
for insert to authenticated
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists portfolios_update_owner on public.portfolios;
create policy portfolios_update_owner on public.portfolios
for update to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists portfolios_delete_owner on public.portfolios;
create policy portfolios_delete_owner on public.portfolios
for delete to authenticated
using (user_id = auth.uid() or public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resumes',
  'resumes',
  false,
  8388608,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists resume_objects_select_owner on storage.objects;
create policy resume_objects_select_owner on storage.objects
for select to authenticated
using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists resume_objects_insert_owner on storage.objects;
create policy resume_objects_insert_owner on storage.objects
for insert to authenticated
with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists resume_objects_delete_owner on storage.objects;
create policy resume_objects_delete_owner on storage.objects
for delete to authenticated
using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

grant usage on schema public to anon, authenticated;
grant select on public.portfolios to anon;
grant select, insert, update, delete on public.portfolios to authenticated;
grant select, update on public.profiles to authenticated;
