/** @type {import('next').NextConfig} */
const API_URL = process.env.API_URL ?? 'http://localhost:3000';

const nextConfig = {
  // Proxy /api/* → backend so the browser never makes cross-origin requests.
  // The frontend reads NEXT_PUBLIC_API_URL; in dev set it to '/api' and
  // set API_URL=http://localhost:3000 (server-side only).
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_URL}/:path*`,
      },
    ];
  },

  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

module.exports = nextConfig;
