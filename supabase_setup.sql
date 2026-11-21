-- QomusiyAPP Supabase Database, Chat & Storage ('pdfs' bucket) SQL Setup

-- 1. Books jadvali
create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text not null,
  version text not null default 'v1.0',
  status text not null default 'draft' check (status in ('draft', 'released')),
  file_path text not null,
  file_url text not null,
  uploaded_by text not null,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.books enable row level security;

drop policy if exists "Anyone can read books" on public.books;
create policy "Anyone can read books"
on public.books for select
using (true);

drop policy if exists "Anyone can insert books" on public.books;
create policy "Anyone can insert books"
on public.books for insert
with check (true);

drop policy if exists "Anyone can update books" on public.books;
create policy "Anyone can update books"
on public.books for update
using (true);

drop policy if exists "Anyone can delete books" on public.books;
create policy "Anyone can delete books"
on public.books for delete
using (true);

-- 2. Chat xabarlari jadvali (Umumiy chat)
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  sender_nick text not null,
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.chat_messages enable row level security;

drop policy if exists "Anyone can read chat_messages" on public.chat_messages;
create policy "Anyone can read chat_messages"
on public.chat_messages for select
using (true);

drop policy if exists "Anyone can insert chat_messages" on public.chat_messages;
create policy "Anyone can insert chat_messages"
on public.chat_messages for insert
with check (true);

-- 3. Storage Bucket ('pdfs') yaratish (agar mavjud bo'lmasa)
insert into storage.buckets (id, name, public)
values ('pdfs', 'pdfs', true)
on conflict (id) do nothing;

-- 4. Storage RLS Policies ('pdfs' bucket)
drop policy if exists "Public read access for QomusiyAPP PDFs" on storage.objects;
create policy "Public read access for QomusiyAPP PDFs"
on storage.objects
for select
using (bucket_id = 'pdfs');

drop policy if exists "Anyone can upload QomusiyAPP PDFs" on storage.objects;
create policy "Anyone can upload QomusiyAPP PDFs"
on storage.objects
for insert
with check (bucket_id = 'pdfs');

drop policy if exists "Anyone can delete QomusiyAPP PDFs" on storage.objects;
create policy "Anyone can delete QomusiyAPP PDFs"
on storage.objects
for delete
using (bucket_id = 'pdfs');
