/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // リアルタイム最優先・キャッシュ常用禁止
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig

