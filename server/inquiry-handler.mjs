/* Reference reception handler for an estimate request. NOT deployed.
   It depends on no hosting provider: the caller passes a plain request
   {method, headers, body, ip} and gets back {status, headers, body}.
   Storage, anti-bot check, rate limit and alert are injected, so the same code
   runs behind a Vercel function, a Node HTTP server or Passenger. */
import { createRequire } from "node:module";
const core = createRequire(import.meta.url)("../public/inquiry-core.js");

const KEY =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY = 4096;

export function createInquiryHandler({
  store, // {put(key, record) -> {created, record}}: durable and atomic per key
  verifyTurnstile, // async (token, ip) -> boolean, checked against Cloudflare by the server
  rateLimit, // async (ip) -> {allowed, retryAfter}
  phoneLib, // libphonenumber-js
  allowedOrigin, // exact origin of the public site
  notify = async () => {}, // alert without personal data; a failure never loses the request
  now = () => new Date(),
  newId = () => crypto.randomUUID(),
}) {
  for (const [name, dep] of Object.entries({
    store,
    verifyTurnstile,
    rateLimit,
    phoneLib,
    allowedOrigin,
  }))
    if (!dep) throw Error("Missing dependency: " + name);
  const reply = (status, data, extra = {}) => ({
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extra,
    },
    body: JSON.stringify(data),
  });
  const header = (headers, name) => {
    const v = headers?.[name] ?? headers?.[name.toLowerCase()];
    return typeof v === "string" ? v : "";
  };

  return async function inquiry(request) {
    try {
      if (request.method !== "POST")
        return reply(405, { ok: false, error: "method" }, { Allow: "POST" });
      if (header(request.headers, "Origin") !== allowedOrigin)
        return reply(403, { ok: false, error: "origin" });
      if (
        !/^application\/json\b/i.test(header(request.headers, "Content-Type"))
      )
        return reply(415, { ok: false, error: "type" });
      const body = typeof request.body === "string" ? request.body : "";
      if (!body || Buffer.byteLength(body) > MAX_BODY)
        return reply(413, { ok: false, error: "size" });
      let input;
      try {
        input = JSON.parse(body);
      } catch {
        return reply(400, { ok: false, error: "json" });
      }
      if (!input || typeof input !== "object" || Array.isArray(input))
        return reply(400, { ok: false, error: "json" });

      const limit = await rateLimit(request.ip || "unknown");
      if (!limit.allowed)
        return reply(
          429,
          { ok: false, error: "rate" },
          { "Retry-After": String(limit.retryAfter || 600) },
        );

      // A filled trap field is answered like a success, and nothing is kept.
      if (typeof input.website === "string" && input.website.trim() !== "")
        return reply(200, { ok: true });

      const key = header(request.headers, "Idempotency-Key");
      if (!KEY.test(key)) return reply(400, { ok: false, error: "key" });
      if (
        typeof input.turnstileToken !== "string" ||
        !input.turnstileToken ||
        input.turnstileToken.length > 2048 ||
        !(await verifyTurnstile(input.turnstileToken, request.ip || ""))
      )
        return reply(403, { ok: false, error: "challenge" });

      const check = core.validate(input, phoneLib);
      if (!check.ok) return reply(422, { ok: false, errors: check.errors });

      const record = {
        id: newId(),
        receivedAt: now().toISOString(),
        status: "Nouvelle",
        ...check.value,
      };
      const saved = await store.put(key.toLowerCase(), record);
      if (saved.created) {
        try {
          await notify({ id: saved.record.id });
        } catch {
          /* The request is stored; the alert can be retried separately. */
        }
      }
      // Never echo personal data back.
      return reply(saved.created ? 201 : 200, {
        ok: true,
        reference: saved.record.id.slice(0, 8),
      });
    } catch {
      return reply(503, { ok: false, error: "unavailable" });
    }
  };
}

/* In-memory adapters for tests and the local demonstration only. */
export function memoryStore() {
  const byKey = new Map();
  return {
    async put(key, record) {
      if (byKey.has(key)) return { created: false, record: byKey.get(key) };
      byKey.set(key, record);
      return { created: true, record };
    },
    all: () => [...byKey.values()],
  };
}
export function memoryRateLimit({ max = 5, windowMs = 600000, now = Date.now } = {}) {
  const hits = new Map();
  return async (ip) => {
    const t = now(),
      list = (hits.get(ip) || []).filter((x) => t - x < windowMs);
    if (list.length >= max) {
      hits.set(ip, list);
      return {
        allowed: false,
        retryAfter: Math.ceil((windowMs - (t - list[0])) / 1000),
      };
    }
    list.push(t);
    hits.set(ip, list);
    return { allowed: true };
  };
}
