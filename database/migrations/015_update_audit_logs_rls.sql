-- ====================================
-- Update audit_logs RLS policy
-- ====================================
-- 管理者：すべてのログを閲覧可能
-- マネージャー：同じlocation_idのユーザーのログを閲覧可能

-- 既存のポリシーを削除
drop policy if exists audit_logs_admin_only on public.audit_logs;

-- 新しいポリシーを作成
create policy audit_logs_role_based on public.audit_logs
  for select
  using (
    -- 管理者：制限なし
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.role = 'admin'
    )
    or
    -- マネージャー：同じlocation_idのユーザーのログのみ
    (
      exists (
        select 1 from public.profiles p
        where p.user_id = auth.uid() and p.role = 'manager' and p.location_id is not null
      )
      and
      exists (
        select 1 from public.profiles actor_profile
        where actor_profile.user_id = audit_logs.actor_user_id
          and actor_profile.location_id = (
            select location_id from public.profiles where user_id = auth.uid()
          )
      )
    )
  );

comment on policy audit_logs_role_based on public.audit_logs is '管理者：全ログ閲覧可、マネージャー：同じlocation_idのユーザーのログのみ閲覧可';
