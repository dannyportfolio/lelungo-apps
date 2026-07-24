if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_ENABLE_QA === 'true') {
  throw new Error("❌ CRITICAL: QA must be disabled in production! (NEXT_PUBLIC_ENABLE_QA=true)");
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'source.unsplash.com' },
    ],
  },
};

module.exports = nextConfig;
