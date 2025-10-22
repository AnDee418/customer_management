/**
 * 顧客コード解決ヘルパー
 * customer_code → customer_id 変換
 */
import { createServerClient } from '@/lib/supabase/server'
import { NotFoundError } from '@/lib/errors/handler'

/**
 * 顧客コードからIDを解決
 * 
 * @param code 顧客コード
 * @returns 顧客ID
 * @throws NotFoundError 顧客が見つからない場合
 */
export async function resolveCustomerIdByCode(code: string): Promise<string> {
  const supabase = createServerClient()
  
  const { data, error } = await supabase
    .from('customers')
    .select('id')
    .eq('code', code)
    .is('deleted_at', null)
    .single()

  if (error || !data) {
    throw new NotFoundError(`Customer not found with code: ${code}`)
  }

  return data.id
}

/**
 * 顧客コード（またはID）から確実にIDを取得
 * 
 * @param codeOrId 顧客コードまたはID
 * @returns 顧客ID
 */
export async function ensureCustomerId(codeOrId: string): Promise<string> {
  // UUID形式ならそのまま返す
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (uuidRegex.test(codeOrId)) {
    return codeOrId
  }

  // コードとして解決
  return await resolveCustomerIdByCode(codeOrId)
}

/**
 * 外部発注IDから発注IDを解決
 * 
 * @param externalOrderId 外部発注ID
 * @param sourceSystem ソースシステム識別子
 * @returns 発注ID（存在しない場合はnull）
 */
export async function resolveOrderId(
  externalOrderId: string,
  sourceSystem: string
): Promise<string | null> {
  const supabase = createServerClient()
  
  const { data } = await supabase
    .from('orders')
    .select('id')
    .eq('external_order_id', externalOrderId)
    .eq('source_system', sourceSystem)
    .single()

  return data?.id || null
}

