/* Host-independent envelope: one Node HTTP server that serves the built site with
   the production headers and, only when reception is switched on, the endpoint
   that stores estimate requests. NOT used by the current Vercel deployment, which
   serves static files only and collects nothing.

   Reception stays off unless INQUIRY_RECEPTION=on, and then it needs a private
   storage directory, a rate-limit secret and an anti-bot mode. */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { createInquiryHandler } from "./inquiry-handler.mjs";
import { createFileStore } from "./file-store.mjs";
import { createFileRateLimit, createTurnstileVerifier } from "./guards.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".jpg": "image/png", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml" };

/* The security headers come from vercel.json, so there is one source for every host. */
function siteHeaders(root) {
  const config = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
  return Object.fromEntries(config.headers[0].headers.map((h) => [h.key, h.value]));
}

export function createSiteServer({
  root = path.join(here, ".."),
  origin, // exact public origin of the site, for the Origin check
  reception = false,
  storeDir = "",
  rateSecret = "",
  rateMax = 5,
  turnstile = null, // {siteKey, verify, script?}: verify is the server-side check
  trustProxy = false,
  store = null, // test hook: replaces the file store
  notify = undefined,
} = {}) {
  const out = path.join(root, "public-dist"),
    headers = siteHeaders(root);
  let handler = null,
    config = null;
  if (reception) {
    if (!origin || !storeDir || !rateSecret || !turnstile?.siteKey || typeof turnstile.verify !== "function")
      throw Error("Reception needs an origin, a storage directory, a rate-limit secret and an anti-bot check.");
    handler = createInquiryHandler({
      store: store || createFileStore(storeDir),
      phoneLib: require("libphonenumber-js"),
      allowedOrigin: origin,
      rateLimit: createFileRateLimit({ dir: storeDir, secret: rateSecret, max: rateMax }),
      verifyTurnstile: turnstile.verify,
      ...(notify ? { notify } : {}),
    });
    config = "window.IMMO_INQUIRY=Object.freeze(" + JSON.stringify({ endpoint: "/api/demande", turnstileSiteKey: turnstile.siteKey, ...(turnstile.script ? { turnstileScript: turnstile.script } : {}) }) + ");";
    // The anti-bot service needs these two sources; without reception the policy is unchanged.
    if (!turnstile.script) headers["Content-Security-Policy"] = headers["Content-Security-Policy"].replace("script-src 'self'", "script-src 'self' https://challenges.cloudflare.com").replace("; form-action", "; frame-src https://challenges.cloudflare.com; form-action");
  }
  return http.createServer(async (req, res) => {
    let url;
    try {
      url = new URL(req.url, "http://localhost");
    } catch {
      res.writeHead(400).end();
      return;
    }
    if (url.pathname === "/api/demande") {
      if (!handler) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }).end("Introuvable");
        return;
      }
      let body = "";
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 8192) break;
      }
      const forwarded = trustProxy ? String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() : "";
      const reply = await handler({ method: req.method, headers: req.headers, body, ip: forwarded || req.socket.remoteAddress });
      res.writeHead(reply.status, reply.headers).end(reply.body);
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { Allow: "GET, HEAD" }).end();
      return;
    }
    if (config && url.pathname === "/inquiry-config.js") {
      res.writeHead(200, { ...headers, "Content-Type": TYPES[".js"], "Cache-Control": "no-store" }).end(config);
      return;
    }
    if (turnstile?.script && turnstile.scriptBody && url.pathname === turnstile.script) {
      res.writeHead(200, { ...headers, "Content-Type": TYPES[".js"], "Cache-Control": "no-store" }).end(turnstile.scriptBody);
      return;
    }
    let name;
    try {
      name = decodeURIComponent(url.pathname);
    } catch {
      res.writeHead(400).end();
      return;
    }
    if (name.endsWith("/")) name += "index.html";
    const file = path.resolve(out, "." + name);
    if (!file.startsWith(out + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404, { ...headers, "Content-Type": "text/plain; charset=utf-8" }).end("Introuvable");
      return;
    }
    res.writeHead(200, { ...headers, "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(req.method === "HEAD" ? undefined : fs.readFileSync(file));
  });
}

/* Started directly: configuration comes from the environment. */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const env = process.env,
    port = Number(env.PORT) || 4173,
    host = env.HOST || "127.0.0.1",
    on = env.INQUIRY_RECEPTION === "on";
  const origin = env.SITE_ORIGIN || `http://${host}:${port}`;
  let turnstile = null;
  if (on && env.TURNSTILE_MODE === "local-stub") {
    // Local essays only: no call leaves the machine. Refused on anything but a local address.
    if (!["127.0.0.1", "localhost"].includes(host)) throw Error("The local anti-bot stub is refused outside a local address.");
    turnstile = { siteKey: "cle-locale", script: "/mock-turnstile.js", scriptBody: 'window.turnstile={render(el,o){this.o=o;el.textContent="Vérification anti-robot (simulation locale)";this.reset();},reset(){setTimeout(()=>this.o.callback("jeton-local-valide"),50);}};', verify: async (token) => token === "jeton-local-valide" };
  } else if (on) {
    turnstile = { siteKey: env.TURNSTILE_SITE_KEY, verify: createTurnstileVerifier({ secret: env.TURNSTILE_SECRET_KEY, hostname: new URL(origin).hostname }) };
  }
  createSiteServer({ origin, reception: on, storeDir: env.INQUIRY_STORE_DIR || "", rateSecret: env.INQUIRY_RATE_SECRET || "", turnstile, trustProxy: env.TRUST_PROXY === "1" }).listen(port, host, () =>
    console.log(`${origin}/  ·  réception des demandes : ${on ? "activée, stockage " + env.INQUIRY_STORE_DIR : "désactivée (aucune collecte)"}`),
  );
}
