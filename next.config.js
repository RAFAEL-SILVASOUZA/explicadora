/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3', 'pdf-parse', 'sharp'],
    // Ruling KK: on Next 14.2.5 the hook is gated by this flag (config-shared.js:134
    // defaults it to false; next-server.js:472 calls register() only when it is true
    // and !dev). Without it the hook never runs in production.
    instrumentationHook: true,
  },
};

module.exports = nextConfig;
