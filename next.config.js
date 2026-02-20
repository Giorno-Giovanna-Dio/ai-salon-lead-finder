/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'instagram.com',
      },
      {
        protocol: 'https',
        hostname: '**.cdninstagram.com',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb', // 支援較大的圖片上傳
    },
  },
};

module.exports = nextConfig;
