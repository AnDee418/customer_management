/**
 * バリデーションスキーマ（Zod）
 * 顧客管理・外部連携データ
 */
import { z } from 'zod'

/**
 * 顧客タイプ
 */
export const customerTypeSchema = z.enum(['顧客', 'スタッフ', 'サポート', '社員', '代理店', 'その他'])

/**
 * 性別
 */
export const genderSchema = z.enum(['男性', '女性', 'その他', '未回答'])

/**
 * 顧客作成スキーマ
 */
export const createCustomerSchema = z.object({
  name: z.string().min(1, '名前は必須です'),
  name_kana: z.string().nullish(),
  type: customerTypeSchema.default('顧客'),
  gender: genderSchema.nullish(),
  contact: z.string().min(1, '連絡先は必須です'),
  // 詳細住所フィールド
  postal_code: z.string().nullish(),
  prefecture: z.string().nullish(),
  city: z.string().nullish(),
  address_line1: z.string().nullish(),
  address_line2: z.string().nullish(),
  code: z.string().nullish(),
  team_id: z.string().uuid().nullish(),
  age: z.number().int().min(0).max(150).nullish(),
  weight_kg: z.number().positive().max(500).nullish(),
  usual_shoe_size: z.string().nullish(),
  foot_length_right_cm: z.number().positive().max(50).nullish(),
  foot_length_left_cm: z.number().positive().max(50).nullish(),
  foot_width_right_cm: z.string().nullish(),
  foot_width_left_cm: z.string().nullish(),
  foot_arch_right_cm: z.number().positive().max(50).nullish(),
  foot_arch_left_cm: z.number().positive().max(50).nullish(),
  medical_conditions: z.array(z.string()).nullish(),
  tags: z.array(z.string()).nullish(),
})

/**
 * 顧客更新スキーマ
 */
export const updateCustomerSchema = createCustomerSchema.partial()

/**
 * 発注データupsertスキーマ
 */
export const upsertOrderSchema = z.object({
  customer_id: z.string().uuid(),
  external_order_id: z.string().min(1),
  source_system: z.string().min(1),
  title: z.string().optional(),
  status: z.string().optional(),
  ordered_at: z.string().datetime().optional(),
})

/**
 * 測定データupsertスキーマ
 */
export const upsertMeasurementSchema = z.object({
  customer_id: z.string().uuid(),
  order_id: z.string().uuid().optional(),
  external_measurement_id: z.string().min(1),
  source_system: z.string().min(1),
  summary: z.record(z.any()).optional(),
  measured_at: z.string().datetime().optional(),
})

/**
 * 担当者作成スキーマ
 */
export const createContactSchema = z.object({
  customer_id: z.string().uuid(),
  name: z.string().min(1, '担当者名は必須です'),
  email: z.string().email('有効なメールアドレスを入力してください').optional().or(z.literal('')),
  phone: z.string().optional(),
})

/**
 * 担当者更新スキーマ
 */
export const updateContactSchema = createContactSchema.partial().omit({ customer_id: true })

/**
 * バリデーションヘルパー
 */
export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data)
  
  if (result.success) {
    return { success: true, data: result.data }
  }
  
  return { success: false, errors: result.error }
}

