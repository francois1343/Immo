/* Google reCAPTCHA v3, checked by the server for every estimate request.
   Switched on by two variables of the environment, never written in the
   repository: RECAPTCHA_SITE_KEY (public, given to the page at build time)
   and RECAPTCHA_SECRET_KEY (server only). Without both, no check is made and
   the page loads nothing from Google: the trap field and the rate limit are
   then the only protections. */
const VERIFY = "https://www.google.com/recaptcha/api/siteverify";
/* Name of the action the page declares; a token made for another one is refused. */
export const ACTION = "estimation";
export const SITE_KEY = /^[A-Za-z0-9_-]{20,100}$/;
/* Google keeps a token valid for two minutes; a little slack for clocks. */
const MAX_AGE_MS = 150000;

export function recaptchaSettings(env = process.env) {
  const score = Number(env.RECAPTCHA_MIN_SCORE);
  return {
    siteKey: env.RECAPTCHA_SITE_KEY || "",
    secret: env.RECAPTCHA_SECRET_KEY || "",
    /* 0 is a robot for Google, 1 a person; 0.5 is the threshold Google suggests. */
    minScore: score > 0 && score < 1 ? score : 0.5,
  };
}
export const recaptchaConfigured = (env = process.env) => {
  const s = recaptchaSettings(env);
  return SITE_KEY.test(s.siteKey) && Boolean(s.secret);
};

/* Reads the answer of Google. `success` alone is not enough: the token must
   have been made on this site, for this form, recently, by a visitor Google
   scores as a person. Returns { ok, reason }; the reason names no visitor. */
export function judge(data, { minScore = 0.5, hostname, now = Date.now() }) {
  const no = (reason) => ({ ok: false, reason });
  if (!data || typeof data !== "object") return no("unreadable-answer");
  if (data.success !== true) {
    const codes = Array.isArray(data["error-codes"]) ? data["error-codes"].filter((c) => typeof c === "string") : [];
    return no("refused:" + (codes.join(",") || "no-code").slice(0, 120));
  }
  if (data.action !== ACTION) return no("action");
  if (!hostname || data.hostname !== hostname) return no("hostname");
  const made = Date.parse(data.challenge_ts);
  if (!Number.isFinite(made) || now - made > MAX_AGE_MS || made - now > 60000) return no("expired");
  if (typeof data.score !== "number" || !(data.score >= minScore)) return no("score");
  return { ok: true, reason: "" };
}

/* async (token, ip) -> boolean. Anything but a clear yes from Google is a no,
   including an unreachable or failing verification service: the page then
   offers the phone and the prepared e-mail. `report` receives the reason of a
   refusal, for the server log; it never receives the token or the address. */
export function recaptchaVerifier({ secret, minScore = 0.5, hostname, fetch = globalThis.fetch, now = Date.now, report = () => {} }) {
  if (!secret || !hostname) throw Error("reCAPTCHA: secret and hostname are required");
  return async (token, ip) => {
    let verdict;
    try {
      const form = new URLSearchParams({ secret, response: token });
      if (ip) form.set("remoteip", ip);
      const res = await fetch(VERIFY, { method: "POST", body: form, signal: AbortSignal.timeout(5000) });
      verdict = res.ok ? judge(await res.json(), { minScore, hostname, now: now() }) : { ok: false, reason: "http-" + res.status };
    } catch (error) {
      verdict = { ok: false, reason: error && error.name === "TimeoutError" ? "timeout" : "unreachable" };
    }
    if (!verdict.ok) report(verdict.reason);
    return verdict.ok;
  };
}
