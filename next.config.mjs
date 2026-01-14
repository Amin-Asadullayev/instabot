/** @type {import('next').NextConfig} */
const nextConfig = {
  // Turbopack configuration for Next.js 16+
  turbopack: {
    rules: {
      '*.node': {
        loaders: ['node-loader'],
      },
    },
  },
  
  // Webpack configuration (fallback for production builds)
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('canvas');
    }
    return config;
  },
}

export default nextConfig;