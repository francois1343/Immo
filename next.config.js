/* Security headers and redirects are declared once, in vercel.json: Vercel
   applies them in production, and the same rules are loaded here when the
   site runs anywhere else (next start, local checks). */
const vercel = require("./vercel.json");

/** @type {import('next').NextConfig} */
module.exports = {
  trailingSlash: true,
  poweredByHeader: false,
  reactStrictMode: true,
  turbopack: { root: __dirname },
  ...(process.env.VERCEL
    ? {}
    : {
        headers: async () => vercel.headers,
        redirects: async () => vercel.redirects,
      }),
};
