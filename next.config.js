/* Security headers and redirects are declared once, in server.config.json,
   and applied by the Next.js server itself (next start, behind nginx). */
const server = require("./server.config.json");
/* next dev serves its own overlay and hot-reload scripts, which the strict
   policy would block: the headers apply to the built site only. */
const dev = process.env.NODE_ENV === "development";

/** @type {import('next').NextConfig} */
module.exports = {
  trailingSlash: true,
  poweredByHeader: false,
  reactStrictMode: true,
  turbopack: { root: __dirname },
  headers: async () => (dev ? [] : server.headers),
  redirects: async () => server.redirects,
};
