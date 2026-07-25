-- DocuVault schema: profiles, documents, RLS policies, storage bucket.
-- Run this in the Supabase SQL editor for a fresh project.

-- profiles: one row per auth user, carries the app role
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- security-definer helper so policies can check role without recursive RLS on profiles
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- auto-create a profile row whenever a new auth user is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create policy "profiles_select_own_or_admin"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id or public.is_admin());

-- documents: one row per uploaded file
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint not null,
  uploaded_at timestamptz not null default now()
);

create index documents_user_id_idx on public.documents (user_id);

alter table public.documents enable row level security;

create policy "documents_select_own_or_admin"
  on public.documents for select
  to authenticated
  using (auth.uid() = user_id or public.is_admin());

create policy "documents_insert_own"
  on public.documents for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "documents_delete_own"
  on public.documents for delete
  to authenticated
  using (auth.uid() = user_id);

-- storage bucket for the actual files, private, one folder per user email
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- folder is keyed by the user's email; the uid fallback check keeps any
-- objects uploaded before this scheme change accessible to their owner
create policy "documents_bucket_select_own_or_admin"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'documents'
    and (
      (storage.foldername(name))[1] = auth.email()
      or (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

create policy "documents_bucket_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.email()
  );

create policy "documents_bucket_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'documents'
    and (
      (storage.foldername(name))[1] = auth.email()
      or (storage.foldername(name))[1] = auth.uid()::text
    )
  );

-- AI summary + Q&A: cached extracted text and generated summary per document
alter table public.documents
  add column extracted_text text,
  add column summary text;

create policy "documents_update_own_or_admin"
  on public.documents for update
  to authenticated
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

-- restrict what authenticated users can actually change via this policy:
-- only the two AI-derived columns above, never file_name/storage_path/etc.
revoke update on public.documents from authenticated;
grant update (extracted_text, summary) on public.documents to authenticated;

-- lock down helper function execute grants (defense in depth against PostgREST RPC exposure)
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
