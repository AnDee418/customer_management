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

do $trigger$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'trg_location_slots_updated_at'
  ) then
    create trigger trg_location_slots_updated_at
    before update on public.location_slots
    for each row execute function public.set_updated_at();
  end if;
end;
$trigger$;

alter table public.location_slots enable row level security;

do $policy$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'location_slots'
      and policyname = 'location_slots_admin_select'
  ) then
    create policy location_slots_admin_select on public.location_slots
      for select using (
        exists (
          select 1 from public.profiles p
          where p.user_id = auth.uid() and p.role = 'admin'
        )
      );
  end if;
end;
$policy$;

do $policy$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'location_slots'
      and policyname = 'location_slots_admin_insert'
  ) then
    create policy location_slots_admin_insert on public.location_slots
      for insert with check (
        exists (
          select 1 from public.profiles p
          where p.user_id = auth.uid() and p.role = 'admin'
        )
      );
  end if;
end;
$policy$;

do $policy$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'location_slots'
      and policyname = 'location_slots_admin_update'
  ) then
    create policy location_slots_admin_update on public.location_slots
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
  end if;
end;
$policy$;

do $policy$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'location_slots'
      and policyname = 'location_slots_admin_delete'
  ) then
    create policy location_slots_admin_delete on public.location_slots
      for delete using (
        exists (
          select 1 from public.profiles p
          where p.user_id = auth.uid() and p.role = 'admin'
        )
      );
  end if;
end;
$policy$;

alter table if exists public.profiles
  add column if not exists location_id uuid references public.location_slots(id);

create index if not exists idx_profiles_location_id on public.profiles(location_id);

commit;
