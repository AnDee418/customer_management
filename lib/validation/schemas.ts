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
 * ユーザーロール
 */
export const userRoleSchema = z.enum(['admin', 'manager', 'user', 'viewer'])

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
 * 管理者によるユーザー作成スキーマ
 */
const optionalUuidSchema = z.preprocess(
  (value) => {
    if (value === '' || value === undefined || value === null) {
      return null
    }
    return value
  },
  z.string().uuid().nullable()
)

const optionalTextSchema = z.preprocess(
  (value) => {
    if (value === undefined) return undefined
    if (value === null) return null
    if (typeof value === 'string' && value.trim() === '') {
      return null
    }
    return typeof value === 'string' ? value : undefined
  },
  z.string().min(1).nullable().optional()
)

export const createAdminUserSchema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください'),
  display_name: z.string().min(1, '表示名は必須です'),
  department: optionalTextSchema,
  role: userRoleSchema.default('user'),
  team_id: optionalUuidSchema.optional(),
  location_id: optionalUuidSchema.optional(),
  password: z.string().min(12, 'パスワードは12文字以上で入力してください'),
})

/**
 * 管理者によるユーザー更新スキーマ
 */
export const updateAdminUserSchema = z.object({
  display_name: z.string().min(1, '表示名は必須です').optional(),
  department: optionalTextSchema,
  role: userRoleSchema.optional(),
  team_id: optionalUuidSchema.optional(),
  location_id: optionalUuidSchema.optional(),
})

const sortOrderSchema = z.preprocess(
  (value) => {
    if (value === undefined || value === null || value === '') return undefined
    if (typeof value === 'string') {
      const parsed = Number(value)
      return Number.isNaN(parsed) ? value : parsed
    }
    return value
  },
  z.number().int().min(0).max(10000)
)

/**
 * 所属地スロット作成スキーマ
 */
export const createLocationSlotSchema = z.object({
  name: z.string().min(1, '名称は必須です'),
  description: optionalTextSchema,
  sort_order: sortOrderSchema.default(100),
  is_active: z.boolean().default(true),
})

/**
 * 所属地スロット更新スキーマ
 */
export const updateLocationSlotSchema = createLocationSlotSchema.partial()

/**
 * 所属チーム作成スキーマ
 */
export const createTeamSchema = z.object({
  name: z.string().min(1, 'チーム名は必須です'),
})

/**
 * 所属チーム更新スキーマ
 */
export const updateTeamSchema = z.object({
  name: z.string().min(1, 'チーム名は必須です').optional(),
})

/**
 * バリデーションヘルパー
 */
export function validate<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; errors: z.ZodError<z.input<T>> } {
  const result = schema.safeParse(data)
  
  if (result.success) {
    return { success: true, data: result.data }
  }
  
  return { success: false, errors: result.error }
}

