/* Security headers and redirects are declared once, in vercel.json: Vercel
   applies them in production, and the same rules are loaded here when the
   site runs anywhere else (next start, local checks). */
const vercel = require("./vercel.json");
/* next dev serves its own overlay and hot-reload scripts, which the strict
   policy would block: the headers apply to the built site only. */
const dev = process.env.NODE_ENV === "development";

/** @type {import('next').NextConfig} */
module.exports = {
  trailingSlash: true,
  poweredByHeader: false,
  reactStrictMode: true,
  turbopack: { root: __dirname },
  ...(process.env.VERCEL
    ? {}
    : {
        headers: async () => (dev ? [] : vercel.headers),
        redirects: async () => vercel.redirects,
      }),
};
