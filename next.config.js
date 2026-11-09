/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse', 'sharp'],
    // Ruling KK: on Next 14.2.5 the hook is gated by this flag (config-shared.js:134
    // defaults it to false; next-server.js:472 calls register() only when it is true
    // and !dev). Without it the hook never runs in production.
    instrumentationHook: true,
    // O instrumentation.ts roda aplicarMigracoes() no boot, que faz fs.readdir('migrations')
    // e fs.readFile de cada .sql. O file-tracing (@vercel/nft) só rastreia imports estáticos;
    // um readdir dinâmico de pasta não é detectado, então migrations/ fica fora do bundle
    // serverless e dá ENOENT em runtime (Vercel /var/task/migrations). No Next 14.2.5 as
    // chaves de trace ficam em experimental (na raiz só a partir de versões maiores).
    outputFileTracingIncludes: {
      '/**': ['./migrations/**/*'],
    },
  },
};

module.exports = nextConfig;
