-- 足の幅カラムをnumericからtextに変更
-- 理由: ワイズ（A、B、C、D、E、2E、3E、4E、F、G）の文字列表記に対応するため
-- 作成日: 2025-10-21

-- 既存データがnumericの場合、textに変換
alter table public.customers
  alter column foot_width_right_cm type text using foot_width_right_cm::text,
  alter column foot_width_left_cm type text using foot_width_left_cm::text;

-- コメント更新
comment on column public.customers.foot_width_right_cm is '足の幅(右) ワイズ（A、B、C、D、E、2E、3E、4E、F、G等）';
comment on column public.customers.foot_width_left_cm is '足の幅(左) ワイズ（A、B、C、D、E、2E、3E、4E、F、G等）';
