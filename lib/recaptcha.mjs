/* Google reCAPTCHA v3, checked by the server for every estimate request.
   Switched on by two variables of the environment, never written in the
   repository: RECAPTCHA_SITE_KEY (public, given to the page at build time)
   and RECAPTCHA_SECRET_KEY (server only). Without both, no check is made and
   the page loads nothing from Google. */
const VERIFY = "https://www.google.com/recaptcha/api/siteverify";
/* Name of the action the page declares; a token made for another one is refused. */
export const ACTION = "estimation";
export const SITE_KEY = /^[A-Za-z0-9_-]{20,100}$/;

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

/* async (token, ip) -> boolean. Anything but a clear yes from Google is a no:
   the page then offers the phone and the prepared e-mail. */
export function recaptchaVerifier({ secret, minScore = 0.5, hostname = "", fetch = globalThis.fetch }) {
  return async (token, ip) => {
    try {
      const form = new URLSearchParams({ secret, response: token });
      if (ip) form.set("remoteip", ip);
      const res = await fetch(VERIFY, { method: "POST", body: form, signal: AbortSignal.timeout(5000) });
      if (!res.ok) return false;
      const data = await res.json();
      return (
        data.success === true &&
        data.action === ACTION &&
        typeof data.score === "number" &&
        data.score >= minScore &&
        (!hostname || data.hostname === hostname)
      );
    } catch {
      return false;
    }
  };
}
