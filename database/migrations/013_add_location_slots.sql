-- 所属地スロットテーブルとプロファイル拡張
-- マイクロサービス全体で共有するロケーションマスタ

begin;

create table if not exists public.location_slots (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger if not exists trg_location_slots_updated_at
before update on public.location_slots
for each row execute function public.set_updated_at();

alter table public.location_slots enable row level security;

create policy if not exists location_slots_admin_select on public.location_slots
  for select using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.role = 'admin'
    )
  );

create policy if not exists location_slots_admin_insert on public.location_slots
  for insert with check (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.role = 'admin'
    )
  );

create policy if not exists location_slots_admin_update on public.location_slots
  for update using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.role = 'admin'
    )
  ) with check (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.role = 'admin'
    )
  );

create policy if not exists location_slots_admin_delete on public.location_slots
  for delete using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.role = 'admin'
    )
  );

alter table if exists public.profiles
  add column if not exists location_id uuid references public.location_slots(id);

create index if not exists idx_profiles_location_id on public.profiles(location_id);

commit;
