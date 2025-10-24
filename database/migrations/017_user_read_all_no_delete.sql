-- Migration 017: user権限の読取全件許可 + 削除不可
--
-- 変更内容:
-- - user権限: すべての顧客データを閲覧可能
-- - user権限: 編集は自分が作成したデータのみ（現状維持）
-- - user権限: 削除不可（admin/managerのみ削除可能）
--
-- 理由:
-- - userは全顧客データを参照する必要がある
-- - データの整合性保護のため、削除はadmin/managerのみに制限
--
-- 作成日: 2025-10-24

-- customers テーブルのRLSポリシーを更新

-- 【READ】既存のREADポリシーを削除して再作成（全認証ユーザーに許可）
DROP POLICY IF EXISTS customers_owner_read ON customers;

CREATE POLICY customers_owner_read ON customers
FOR SELECT
USING (
  -- 削除済みでない全顧客を表示
  deleted_at IS NULL
  -- 認証済みユーザーであればすべて閲覧可能
  AND auth.uid() IS NOT NULL
);

-- 【UPDATE】既存のUPDATEポリシー（変更なし: 所有者/admin/managerのみ）
-- すでにmanager対応済みなので変更不要

-- 【DELETE】既存のDELETEポリシーを削除して再作成（admin/managerのみ）
DROP POLICY IF EXISTS customers_owner_delete ON customers;

CREATE POLICY customers_owner_delete ON customers
FOR DELETE
USING (
  -- admin権限
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid()
    AND p.role = 'admin'
  ) OR
  -- manager権限
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid()
    AND p.role = 'manager'
  )
  -- user権限は削除不可（所有者でも削除できない）
);

-- contacts テーブルのRLSポリシーも更新（個別ポリシーに分離）

DROP POLICY IF EXISTS contacts_via_customer ON contacts;

-- contacts: SELECT（全認証ユーザーが閲覧可能）
CREATE POLICY contacts_select_all ON contacts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM customers c
    WHERE c.id = contacts.customer_id
    AND c.deleted_at IS NULL
    AND auth.uid() IS NOT NULL
  )
);

-- contacts: INSERT（所有者/admin/managerのみ）
CREATE POLICY contacts_insert_owner ON contacts
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM customers c
    WHERE c.id = contacts.customer_id
    AND c.deleted_at IS NULL
    AND (
      c.owner_user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.user_id = auth.uid()
        AND p.role IN ('admin', 'manager')
      )
    )
  )
);

-- contacts: UPDATE（所有者/admin/managerのみ）
CREATE POLICY contacts_update_owner ON contacts
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM customers c
    WHERE c.id = contacts.customer_id
    AND c.deleted_at IS NULL
    AND (
      c.owner_user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.user_id = auth.uid()
        AND p.role IN ('admin', 'manager')
      )
    )
  )
);

-- contacts: DELETE（admin/managerのみ）
CREATE POLICY contacts_delete_admin_only ON contacts
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM customers c
    WHERE c.id = contacts.customer_id
    AND c.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND p.role IN ('admin', 'manager')
    )
  )
);

COMMENT ON POLICY customers_owner_read ON customers IS
'全認証ユーザーが顧客データを閲覧可能（削除済みを除く）';

COMMENT ON POLICY customers_owner_update ON customers IS
'所有者、admin、manager権限のユーザーが顧客データを更新可能';

COMMENT ON POLICY customers_owner_delete ON customers IS
'admin、manager権限のみが顧客データを削除可能（user権限は削除不可）';

COMMENT ON POLICY contacts_select_all ON contacts IS
'全認証ユーザーが担当者データを閲覧可能';

COMMENT ON POLICY contacts_insert_owner ON contacts IS
'親customerの所有者、admin、managerが担当者データを作成可能';

COMMENT ON POLICY contacts_update_owner ON contacts IS
'親customerの所有者、admin、managerが担当者データを更新可能';

COMMENT ON POLICY contacts_delete_admin_only ON contacts IS
'admin、manager権限のみが担当者データを削除可能';
