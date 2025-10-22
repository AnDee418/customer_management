/**
 * 郵便番号から住所を取得するユーティリティ
 * zipcloud API (https://zipcloud.ibsnet.co.jp/doc/api) を使用
 */

export interface PostalCodeResult {
  prefecture: string
  city: string
  town: string
}

/**
 * 郵便番号を正規化（ハイフンを除去）
 */
export function normalizePostalCode(postalCode: string): string {
  return postalCode.replace(/[^0-9]/g, '')
}

/**
 * 郵便番号をフォーマット（123-4567形式）
 */
export function formatPostalCode(postalCode: string): string {
  const normalized = normalizePostalCode(postalCode)
  if (normalized.length === 7) {
    return `${normalized.slice(0, 3)}-${normalized.slice(3)}`
  }
  return postalCode
}

/**
 * 郵便番号から住所を検索
 * @param postalCode 郵便番号（ハイフンあり・なし両対応）
 * @returns 住所情報または null
 */
export async function searchAddressByPostalCode(
  postalCode: string
): Promise<PostalCodeResult | null> {
  try {
    const normalized = normalizePostalCode(postalCode)

    if (normalized.length !== 7) {
      throw new Error('郵便番号は7桁で入力してください')
    }

    // 内部API Route経由で郵便番号を検索（CORS回避）
    const response = await fetch(
      `/api/postal-code?postal_code=${normalized}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      if (response.status === 404) {
        return null
      }
      throw new Error('郵便番号検索APIへのアクセスに失敗しました')
    }

    const data = await response.json()

    if (!data.found || !data.data) {
      return null
    }

    return {
      prefecture: data.data.prefecture || '',
      city: data.data.city || '',
      town: data.data.town || '',
    }
  } catch (error) {
    console.error('郵便番号検索エラー:', error)
    throw error
  }
}

