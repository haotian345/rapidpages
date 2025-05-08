/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
await import("./src/env.mjs");
import { createProxyMiddleware } from 'http-proxy-middleware'

/** @type {import("next").NextConfig} */
const config = {
  reactStrictMode: true,

  // 配置本地开发代理
  async rewrites() {
    return [
      {
        source: '/api/proxy/:path*',
        destination: 'https://api.github.com/:path*',
      },
    ]
  },

  // 强制 Node.js 使用系统代理
  serverRuntimeConfig: {
    proxy: {
      enabled: true,
      host: process.env.HTTP_PROXY,
    }
  },
  
  // 全局请求代理
  async serverMiddleware() {
    const proxy = createProxyMiddleware({
      target: 'https://api.github.com',
      changeOrigin: true,
      pathRewrite: { '^/api/proxy': '' },
      secure: false,
    });
    return [
      (req, res, next) => {
        if (req.url.startsWith('/api/proxy')) {
          proxy(req, res, next);
        } else {
          next();
        }
      }
    ];
  },

  /**
   * If you are using `appDir` then you must comment the below `i18n` config out.
   *
   * @see https://github.com/vercel/next.js/issues/41980
   */
  i18n: {
    locales: ["en"],
    defaultLocale: "en",
  },

  experimental: {
    swcPlugins: [
      [
        "next-superjson-plugin",
        {
          excluded: [],
        },
      ],
    ],
  },
};

export default config;
