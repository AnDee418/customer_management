/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // リアルタイム最優先・キャッシュ常用禁止
  async headers() {
    return [
      {
        // APIルート: キャッシュ無効化
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
      {
        // すべてのルート: セキュリティヘッダー
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN', // クリックジャッキング攻撃を防止
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff', // MIMEタイプスニッフィング攻撃を防止
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin', // リファラー情報を安全に制御
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()', // ブラウザ機能を制限
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://ka-f.fontawesome.com", // Font Awesome + Next.js
              "style-src 'self' 'unsafe-inline' https://ka-f.fontawesome.com", // Font Awesome
              "img-src 'self' data: https:",
              "font-src 'self' data: https://ka-f.fontawesome.com",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://ka-f.fontawesome.com", // Supabase + Font Awesome
              "frame-src 'none'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
            ].join('; '), // XSS攻撃を防止
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig

