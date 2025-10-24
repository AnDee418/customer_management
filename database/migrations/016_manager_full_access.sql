-- Migration 016: Manager権限に全顧客アクセス権を付与
--
-- 変更内容:
-- - manager権限はすべての顧客データにアクセス可能（adminと同等）
-- - 監査ログは引き続きlocation_idベースで制限（現在のまま）
--
-- 理由:
-- - manager権限は監査ログページで利用するためのロール
-- - 顧客管理においてはadminと同等の権限が必要
--
-- 作成日: 2025-10-24

-- customers テーブルのRLSポリシーを更新

-- 既存のREADポリシーを削除して再作成
DROP POLICY IF EXISTS customers_owner_read ON customers;

CREATE POLICY customers_owner_read ON customers
FOR SELECT
USING (
  deleted_at IS NULL AND (
    -- 所有者本人
    auth.uid() = owner_user_id OR
    -- admin権限
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND p.role = 'admin'
    ) OR
    -- manager権限（全顧客アクセス可能）
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND p.role = 'manager'
    )
  )
);

-- 既存のUPDATEポリシーを削除して再作成
DROP POLICY IF EXISTS customers_owner_update ON customers;

CREATE POLICY customers_owner_update ON customers
FOR UPDATE
USING (
  -- 所有者本人
  auth.uid() = owner_user_id OR
  -- admin権限
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid()
    AND p.role = 'admin'
  ) OR
  -- manager権限（全顧客更新可能）
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid()
    AND p.role = 'manager'
  )
);

-- DELETEポリシーも追加（ソフトデリート用のUPDATEと同等）
DROP POLICY IF EXISTS customers_owner_delete ON customers;

CREATE POLICY customers_owner_delete ON customers
FOR DELETE
USING (
  -- 所有者本人
  auth.uid() = owner_user_id OR
  -- admin権限
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid()
    AND p.role = 'admin'
  ) OR
  -- manager権限（全顧客削除可能）
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid()
    AND p.role = 'manager'
  )
);

-- contacts テーブルのRLSポリシーも更新（親customerのポリシーに従う）
DROP POLICY IF EXISTS contacts_via_customer ON contacts;

CREATE POLICY contacts_via_customer ON contacts
FOR ALL
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
        AND p.role = 'admin'
      ) OR
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.user_id = auth.uid()
        AND p.role = 'manager'
      )
    )
  )
);

COMMENT ON POLICY customers_owner_read ON customers IS
'所有者、admin、manager権限のユーザーが顧客データを参照可能';

COMMENT ON POLICY customers_owner_update ON customers IS
'所有者、admin、manager権限のユーザーが顧客データを更新可能';

COMMENT ON POLICY customers_owner_delete ON customers IS
'所有者、admin、manager権限のユーザーが顧客データを削除可能';

COMMENT ON POLICY contacts_via_customer ON contacts IS
'親customerの所有者、admin、manager権限のユーザーが担当者データにアクセス可能';
