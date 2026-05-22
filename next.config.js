/**
 * Next.js configuration — مركز الغزلان ERP
 * Production-ready for Vercel / Netlify / Render / Railway / Docker / VPS
 */
const nextConfig = {
  // App Router (no /pages directory)
  // NOTE: `output: 'standalone'` is enabled only when explicitly building for Docker
  // because it conflicts with App-Router-only projects during page-data collection
  // on Next.js 14 (PageNotFoundError: /_document). Enable via env if needed.
  ...(process.env.BUILD_STANDALONE === 'true' ? { output: 'standalone' } : {}),

  reactStrictMode: false,
  poweredByHeader: false,

  // ============ OOM MITIGATION + PERFORMANCE ============
  // Reduce per-icon import overhead — each lucide icon becomes its own module
  // Big win for compile memory when many icons are used (page.js has 50+)
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{kebabCase member}}',
      skipDefaultConversion: true,
    },
  },

  // SWC minifier is much faster + uses less memory than Terser
  swcMinify: true,

  // Skip type collection during dev (saves memory)
  productionBrowserSourceMaps: false,

  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },

  // mongodb is a server-only package — keep it external
  experimental: {
    serverComponentsExternalPackages: ['mongodb', 'bcryptjs', 'otpauth', 'qrcode'],
    // Cache for faster Hot Module Reload + less memory churn
    optimisticClientCache: true,
    // Reduce parallelism in dev to lower peak memory
    workerThreads: false,
    cpus: 1,
  },

  // Skip ESLint blocking on production builds (we lint separately)
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },

  webpack(config, { dev, isServer }) {
    if (dev) {
      config.watchOptions = {
        poll: 2000,
        aggregateTimeout: 300,
        ignored: ['**/node_modules'],
      };
    }
    // Avoid bundling fs/net for browser builds (leaflet etc.)
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },

  onDemandEntries: {
    maxInactiveAge: 10000,
    pagesBufferLength: 2,
  },

  async headers() {
    const corsOrigin = process.env.CORS_ORIGINS || '*';
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: corsOrigin },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, PATCH, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, X-Requested-With' },
          { key: 'Access-Control-Max-Age', value: '86400' },
        ],
      },
      // Service Worker: must not be cached aggressively and must be served at root scope
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
      // Manifest: short cache
      {
        source: '/manifest.json',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600' },
          { key: 'Content-Type', value: 'application/manifest+json; charset=utf-8' },
        ],
      },
      // PWA icons: long cache (immutable filenames)
      {
        source: '/icons/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=604800' },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
          { key: 'Content-Security-Policy', value: 'frame-ancestors *;' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
