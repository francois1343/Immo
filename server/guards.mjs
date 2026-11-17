/* Server-side guards for the reception endpoint: anti-bot verification and a
   rate limit that survives a restart. Both are independent of the host. */
import { createHmac } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/* Cloudflare Turnstile: the token sent by the browser is never trusted; it is
   checked here, with the secret key, against Cloudflare's siteverify service.
   Any doubt (network failure, timeout, wrong hostname) is a refusal. */
export function createTurnstileVerifier({ secret, hostname = "", fetcher = fetch, timeoutMs = 5000 }) {
  if (!secret) throw Error("A Turnstile secret key is required.");
  return async function verify(token, ip) {
    try {
      const body = new URLSearchParams({ secret, response: token });
      if (ip) body.set("remoteip", ip);
      const r = await fetcher("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!r.ok) return false;
      const d = await r.json();
      return d?.success === true && (!hostname || d.hostname === hostname);
    } catch {
      return false;
    }
  };
}

/* Rate limit kept on disk. The visitor's address is never written: only a keyed
   hash of it, so the files cannot be turned back into addresses. */
export function createFileRateLimit({ dir, secret, max = 5, windowMs = 600000, now = Date.now }) {
  if (!dir || !path.isAbsolute(dir) || !secret) throw Error("A directory and a secret are required.");
  const folder = path.join(dir, "debit");
  let ready;
  return async function rateLimit(ip) {
    await (ready ||= mkdir(folder, { recursive: true, mode: 0o700 }));
    const file = path.join(folder, createHmac("sha256", secret).update(String(ip)).digest("hex").slice(0, 40) + ".json");
    let hits = [];
    try {
      hits = JSON.parse(await readFile(file, "utf8"));
      if (!Array.isArray(hits)) hits = [];
    } catch {
      hits = [];
    }
    const t = now();
    hits = hits.filter((x) => Number.isFinite(x) && t - x < windowMs);
    if (hits.length >= max) return { allowed: false, retryAfter: Math.ceil((windowMs - (t - hits[0])) / 1000) };
    hits.push(t);
    await writeFile(file, JSON.stringify(hits), { mode: 0o600 });
    return { allowed: true };
  };
}
