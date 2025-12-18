/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Don't bundle Node.js modules for client-side
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };

      // Exclude ONNX Runtime node files from client bundle
      config.module.rules.push({
        test: /\.node$/,
        use: 'ignore-loader',
      });

      config.module.rules.push({
        test: /ort\.node\.min\.mjs$/,
        type: 'javascript/auto',
        use: 'ignore-loader',
      });
    }

    return config;
  },
  // Add headers for WASM and WebGPU support
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
