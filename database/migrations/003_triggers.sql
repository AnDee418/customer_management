-- トリガ関数（search_vector更新、updated_at自動更新）
-- リアルタイム最優先のため、トリガは即時同期

-- ====================================
-- customers.search_vector 更新関数
-- ====================================
create or replace function public.customers_tsv_refresh(target_id uuid)
returns void language sql as $$
  update public.customers c
  set search_vector =
    setweight(to_tsvector('simple', coalesce(c.name,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(c.code,'')), 'B') ||
    setweight(to_tsvector('simple', coalesce((
      select string_agg(ct.name,' ')
      from public.contacts ct
      where ct.customer_id = c.id
    ),'')), 'C')
  where c.id = target_id;
$$;

-- customers INSERT/UPDATE時にsearch_vector更新
create or replace function public.customers_tsv_update()
returns trigger language plpgsql as $$
begin
  perform public.customers_tsv_refresh(new.id);
  return new;
end $$;

create trigger trg_customers_tsv_update
before insert or update of name, code on public.customers
for each row execute function public.customers_tsv_update();

-- contacts変更時にcustomers.search_vector更新
create or replace function public.contacts_after_change()
returns trigger language plpgsql as $$
begin
  perform public.customers_tsv_refresh(coalesce(new.customer_id, old.customer_id));
  return null;
end $$;

create trigger trg_contacts_after_change
after insert or update or delete on public.contacts
for each row execute function public.contacts_after_change();

-- ====================================
-- updated_at 自動更新
-- ====================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- customers
create trigger trg_customers_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

-- contacts
create trigger trg_contacts_updated_at
before update on public.contacts
for each row execute function public.set_updated_at();

-- integration_jobs
create trigger trg_integration_jobs_updated_at
before update on public.integration_jobs
for each row execute function public.set_updated_at();


