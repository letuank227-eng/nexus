import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ['@prisma/client', 'prisma', '@google/generative-ai'],
  experimental: {
    serverActions: { bodySizeLimit: '100mb' },
    optimizePackageImports: ['socket.io-client'],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400,
    unoptimized: true, // using local /uploads, skip CDN optimization
  },
  compress: true,
  webpack: (config, { dev }) => {
    config.externals.push({
      'utf-8-validate': 'commonjs utf-8-validate',
      'bufferutil': 'commonjs bufferutil',
    })
    // Minimize bundle in dev for faster HMR
    if (dev) {
      config.optimization = { ...config.optimization, moduleIds: 'named' }
    }
    return config
  }
};

export default nextConfig;
