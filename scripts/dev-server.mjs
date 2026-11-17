/* Local demonstration only: serves public-dist on 127.0.0.1 and, with --api,
   a mock reception endpoint backed by memory. Nothing is written to disk and
   nothing leaves the machine. Use fictitious data.
   Usage: node scripts/dev-server.mjs [--api] [--port 4173] */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import {
  createInquiryHandler,
  memoryStore,
  memoryRateLimit,
} from "../server/inquiry-handler.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public-dist");
const phoneLib = createRequire(import.meta.url)("libphonenumber-js");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".jpg": "image/png",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
};

export function start({ api = false, port = 4173, fail = () => false } = {}) {
  const origin = `http://127.0.0.1:${port}`;
  const store = memoryStore();
  const handler = createInquiryHandler({
    store,
    phoneLib,
    allowedOrigin: origin,
    rateLimit: memoryRateLimit({ max: 5 }),
    // Stands in for the server-side call to Cloudflare siteverify.
    verifyTurnstile: async (token) => token === "jeton-fictif-valide",
  });
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, origin);
    if (api && url.pathname === "/api/demande") {
      if (fail()) {
        res.writeHead(503, { "Content-Type": "application/json" });
        return res.end('{"ok":false}');
      }
      let body = "";
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 8192) break;
      }
      const out = await handler({
        method: req.method,
        headers: req.headers,
        body,
        ip: req.socket.remoteAddress,
      });
      res.writeHead(out.status, out.headers);
      return res.end(out.body);
    }
    if (api && url.pathname === "/inquiry-config.js") {
      res.writeHead(200, { "Content-Type": types[".js"], "Cache-Control": "no-store" });
      return res.end(
        'window.IMMO_INQUIRY=Object.freeze({endpoint:"/api/demande",turnstileSiteKey:"cle-fictive",turnstileScript:"/mock-turnstile.js"});',
      );
    }
    if (api && url.pathname === "/mock-turnstile.js") {
      res.writeHead(200, { "Content-Type": types[".js"], "Cache-Control": "no-store" });
      return res.end(
        'window.turnstile={render(el,o){this.o=o;el.textContent="Vérification anti-robot (simulation locale)";this.reset();},reset(){setTimeout(()=>this.o.callback("jeton-fictif-valide"),50);}};',
      );
    }
    let name = decodeURIComponent(url.pathname);
    if (name.endsWith("/")) name += "index.html";
    const file = path.resolve(root, "." + name);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Introuvable");
    }
    res.writeHead(200, {
      "Content-Type": types[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-store",
      // Same policy as production, so a blocked resource shows up locally.
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'",
    });
    res.end(fs.readFileSync(file));
  });
  return new Promise((resolve) =>
    server.listen(port, "127.0.0.1", () => resolve({ server, store, origin })),
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const port = Number(args[args.indexOf("--port") + 1]) || 4173;
  const { origin } = await start({ api: args.includes("--api"), port });
  console.log(`${origin}/estimation/  (${args.includes("--api") ? "réception simulée en mémoire" : "mode messagerie, aucun envoi"})`);
}
