/**
 * 統一エラーハンドリング
 * 4xx/5xx分岐、リトライ判定
 */
import { NextResponse } from 'next/server'
import { structuredLog } from '@/lib/audit/logger'

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public isOperational = true
  ) {
    super(message)
    Object.setPrototypeOf(this, AppError.prototype)
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) {
    super(400, message)
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(401, message)
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(403, message)
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Not found') {
    super(404, message)
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message)
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(429, message)
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error') {
    super(500, message, false)
  }
}

/**
 * エラーレスポンス生成（オーバーロード）
 */
export function errorResponse(error: unknown, requestId?: string): NextResponse
export function errorResponse(message: string, statusCode: number, details?: any): NextResponse
export function errorResponse(
  errorOrMessage: unknown,
  statusCodeOrRequestId?: number | string,
  details?: any
): NextResponse {
  const isDev = process.env.NODE_ENV === 'development'

  // オーバーロード1: errorResponse(message, statusCode, details?)
  if (typeof errorOrMessage === 'string' && typeof statusCodeOrRequestId === 'number') {
    const message = errorOrMessage
    const statusCode = statusCodeOrRequestId

    structuredLog('error', message, {
      statusCode,
      details,
    })

    return NextResponse.json(
      {
        error: message,
        ...(details ? { details } : {})
      },
      {
        status: statusCode,
        headers: { 'Cache-Control': 'no-store' }
      }
    )
  }

  // オーバーロード2: errorResponse(error, requestId?)
  const error = errorOrMessage
  const requestId = typeof statusCodeOrRequestId === 'string' ? statusCodeOrRequestId : undefined

  if (error instanceof AppError) {
    structuredLog('error', error.message, {
      statusCode: error.statusCode,
      requestId,
    })

    return NextResponse.json(
      { error: error.message },
      {
        status: error.statusCode,
        headers: { 'Cache-Control': 'no-store' }
      }
    )
  }

  // 未知のエラー
  const errorMessage = error instanceof Error ? error.message : String(error)
  const errorStack = error instanceof Error ? error.stack : undefined

  structuredLog('error', 'Unhandled error', {
    error: errorMessage,
    stack: errorStack,
    requestId,
  })

  // 開発環境では詳細なエラーを返す
  return NextResponse.json(
    {
      error: isDev ? errorMessage : 'Internal server error',
      ...(isDev && errorStack ? { stack: errorStack } : {})
    },
    {
      status: 500,
      headers: { 'Cache-Control': 'no-store' }
    }
  )
}

/**
 * リトライ可能かどうかの判定
 */
export function isRetryable(error: unknown): boolean {
  if (error instanceof AppError) {
    // 5xx、429はリトライ可能
    return error.statusCode >= 500 || error.statusCode === 429
  }
  
  // ネットワークエラー等もリトライ可能
  if (error instanceof Error) {
    return (
      error.message.includes('fetch failed') ||
      error.message.includes('timeout') ||
      error.message.includes('ECONNREFUSED')
    )
  }

  return false
}

