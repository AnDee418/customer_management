/**
 * 外部システムへのリンク生成ユーティリティ
 */

/**
 * 発注システムの詳細ページURLを生成
 * @param externalOrderId 外部発注ID
 * @returns 発注詳細ページのURL、設定がない場合はnull
 */
export function getOrderDetailUrl(externalOrderId: string): string | null {
  const baseUrl = process.env.NEXT_PUBLIC_ORDERING_SYSTEM_URL
  const detailPath = process.env.NEXT_PUBLIC_ORDERING_DETAIL_PATH || '/orders/{id}'

  if (!baseUrl) {
    console.warn('NEXT_PUBLIC_ORDERING_SYSTEM_URL is not configured')
    return null
  }

  const path = detailPath.replace('{id}', externalOrderId)
  return `${baseUrl}${path}`
}

/**
 * 測定システムの詳細ページURLを生成
 * @param externalMeasurementId 外部測定ID
 * @returns 測定詳細ページのURL、設定がない場合はnull
 */
export function getMeasurementDetailUrl(externalMeasurementId: string): string | null {
  const baseUrl = process.env.NEXT_PUBLIC_MEASUREMENT_SYSTEM_URL
  const detailPath = process.env.NEXT_PUBLIC_MEASUREMENT_DETAIL_PATH || '/measurements/{id}'

  if (!baseUrl) {
    console.warn('NEXT_PUBLIC_MEASUREMENT_SYSTEM_URL is not configured')
    return null
  }

  const path = detailPath.replace('{id}', externalMeasurementId)
  return `${baseUrl}${path}`
}

/**
 * 外部システムへのリンクを新しいタブで開く
 * @param url 外部システムのURL
 */
export function openExternalSystem(url: string | null) {
  if (!url) {
    alert('外部システムのURLが設定されていません。管理者にお問い合わせください。')
    return
  }

  window.open(url, '_blank', 'noopener,noreferrer')
}
