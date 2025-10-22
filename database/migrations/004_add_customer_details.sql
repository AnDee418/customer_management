-- 顧客詳細情報の追加（足の計測データ・健康情報）
-- 要件: 名/連絡先/住所は必須、その他は任意

-- customersテーブルにカラム追加
alter table public.customers
  add column if not exists contact text,
  add column if not exists address text,
  add column if not exists age integer,
  add column if not exists weight_kg numeric(5,2),
  add column if not exists usual_shoe_size text,
  add column if not exists foot_length_right_cm numeric(4,1),
  add column if not exists foot_length_left_cm numeric(4,1),
  add column if not exists foot_width_right_cm numeric(4,1),
  add column if not exists foot_width_left_cm numeric(4,1),
  add column if not exists foot_arch_right_cm numeric(4,1),
  add column if not exists foot_arch_left_cm numeric(4,1),
  add column if not exists medical_conditions text[];

-- 必須項目のnot null制約（既存データがない前提）
alter table public.customers
  alter column name set not null,
  alter column contact set not null,
  alter column address set not null;

-- コメント追加
comment on column public.customers.contact is '連絡先（電話/メール等）※必須';
comment on column public.customers.address is '住所 ※必須';
comment on column public.customers.age is '年齢';
comment on column public.customers.weight_kg is '体重（kg）';
comment on column public.customers.usual_shoe_size is '普段使っている靴の大きさ';
comment on column public.customers.foot_length_right_cm is '足の大きさ(右) cm';
comment on column public.customers.foot_length_left_cm is '足の大きさ(左) cm';
comment on column public.customers.foot_width_right_cm is '足の幅(右) cm';
comment on column public.customers.foot_width_left_cm is '足の幅(左) cm';
comment on column public.customers.foot_arch_right_cm is '足のアーチサイズ(右) cm';
comment on column public.customers.foot_arch_left_cm is '足のアーチサイズ(左) cm';
comment on column public.customers.medical_conditions is '持病/症状（肩凝り、外反母趾、半月板損傷等の配列）';

-- インデックス追加（検索最適化）
create index if not exists idx_customers_contact on public.customers(contact) where deleted_at is null;
create index if not exists idx_customers_age on public.customers(age) where deleted_at is null;
create index if not exists idx_customers_medical_conditions on public.customers using gin(medical_conditions) where deleted_at is null;

