/**
 * 郵便番号検索API（プロキシ）
 * CORS回避のためサーバーサイドから外部APIを呼び出す
 */
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const postalCode = searchParams.get('postal_code')

    if (!postalCode) {
      return NextResponse.json(
        { error: '郵便番号を指定してください' },
        { status: 400 }
      )
    }

    // 郵便番号を正規化（ハイフンを除去）
    const normalized = postalCode.replace(/[^0-9]/g, '')

    if (normalized.length !== 7) {
      return NextResponse.json(
        { error: '郵便番号は7桁で入力してください' },
        { status: 400 }
      )
    }

    // zipcloud APIを呼び出し
    const response = await fetch(
      `https://zipcloud.ibsnet.co.jp/api/search?zipcode=${normalized}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      throw new Error('郵便番号検索APIへのアクセスに失敗しました')
    }

    const data = await response.json()

    if (data.status !== 200 || !data.results || data.results.length === 0) {
      return NextResponse.json(
        {
          found: false,
          message: '該当する住所が見つかりませんでした'
        },
        { status: 404 }
      )
    }

    // 最初の結果を返す
    const result = data.results[0]

    return NextResponse.json({
      found: true,
      data: {
        prefecture: result.address1 || '', // 都道府県
        city: result.address2 || '', // 市区町村
        town: result.address3 || '', // 町域
      }
    })
  } catch (error) {
    console.error('郵便番号検索エラー:', error)
    return NextResponse.json(
      { error: '郵便番号検索に失敗しました' },
      { status: 500 }
    )
  }
}

