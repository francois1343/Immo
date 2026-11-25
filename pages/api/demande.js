/* POST /api/demande/ : receives the estimate form and sends it by e-mail
   through the SMTP server of the business (lib/inquiry-mail.mjs). The only
   server-side code of the site. Without SMTP_PASSWORD it answers 503 and the
   page offers the phone and the prepared e-mail instead. */
import nodemailer from "nodemailer";
import * as phoneLib from "libphonenumber-js";
import { createInquiryHandler, memoryRateLimit } from "../../lib/inquiry-handler.mjs";
import { mailSettings, mailConfigured, mailStore, transportOptions } from "../../lib/inquiry-mail.mjs";
import { recaptchaSettings, recaptchaConfigured, recaptchaVerifier } from "../../lib/recaptcha.mjs";

/* The handler reads the raw text itself, with its own size limit. */
export const config = { api: { bodyParser: false } };

const MAX_BODY = 12288;
/* Five requests per ten minutes and per address, on each running instance. */
const rateLimit = memoryRateLimit({ max: 5 });
let store;

async function rawBody(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > MAX_BODY) break;
  }
  return body;
}
/* The form may only be posted from the site that serves it. */
function ownOrigin(req) {
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "");
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  return `${req.headers["x-forwarded-proto"] || (local ? "http" : "https")}://${host}`;
}

export default async function demande(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex");
  if (!mailConfigured()) return res.status(503).json({ ok: false, error: "unavailable" });
  const settings = mailSettings();
  store ||= mailStore({ transport: nodemailer.createTransport(transportOptions(settings)), settings });
  const origin = ownOrigin(req);
  /* reCAPTCHA v3 is checked here whenever its two keys are configured. */
  const verifyChallenge = recaptchaConfigured()
    ? recaptchaVerifier({
        ...recaptchaSettings(),
        hostname: new URL(origin).hostname,
        /* Server log: the reason only, never the token, the address or the request. */
        report: (reason) => console.warn("reCAPTCHA: request refused (" + reason + ")"),
      })
    : null;
  const handle = createInquiryHandler({ store, rateLimit, verifyChallenge, phoneLib, allowedOrigin: origin });
  const out = await handle({
    method: req.method,
    headers: req.headers,
    body: req.method === "POST" ? await rawBody(req) : "",
    /* nginx sets X-Real-IP to the address it saw; the first entry of
       X-Forwarded-For is written by the visitor and could dodge the limit. */
    ip: String(req.headers["x-real-ip"] || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim(),
  });
  for (const [name, value] of Object.entries(out.headers)) res.setHeader(name, value);
  res.status(out.status).send(out.body);
}
