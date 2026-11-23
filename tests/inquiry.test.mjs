/* Estimate request: shared rules, reference handler and publication guards.
   Every name, number and address below is fictitious. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import {
  createInquiryHandler,
  memoryStore,
  memoryRateLimit,
} from "../lib/inquiry-handler.mjs";

import { mailSettings, mailConfigured, mailStore, inquiryMail } from "../lib/inquiry-mail.mjs";
import { recaptchaConfigured, recaptchaSettings, recaptchaVerifier } from "../lib/recaptcha.mjs";
const require = createRequire(import.meta.url);
const { inquiryConfig, ENDPOINT } = require("../scripts/prepare.cjs");
const core = require("../public/inquiry-core.js");
const lib = require("libphonenumber-js");
const read = (f) => fs.readFileSync(new URL("../" + f, import.meta.url), "utf8");

const good = {
  commune: "Beaumont",
  type: "Maison",
  delai: "Dans les six mois",
  prenom: "Camille",
  telephone: "0470 12 34 56",
  email: "camille@example.org",
  rappel: "Soirée",
  message: "Maison quatre façades.",
  origine: "/estimation/",
};

test("a complete fictitious request is accepted and normalised", () => {
  const r = core.validate({ ...good, commune: "  beaumont  ", inconnu: "x" }, lib);
  assert.equal(r.ok, true);
  assert.equal(r.value.telephone, "+32470123456");
  assert.equal(r.value.pays, "BE");
  assert.equal(r.value.commune, "beaumont");
  assert.equal("inconnu" in r.value, false);
});
test("Belgian and French numbers are accepted in every usual format", () => {
  for (const [raw, e164] of [
    ["0470123456", "+32470123456"],
    ["0470/12.34.56", "+32470123456"],
    ["+32 470 12 34 56", "+32470123456"],
    ["0032470123456", "+32470123456"],
    ["071 12 34 56", "+3271123456"],
    ["+33 6 12 34 56 78", "+33612345678"],
    ["06 12 34 56 78", "+33612345678"],
    ["0033612345678", "+33612345678"],
  ]) {
    assert.equal(core.parsePhone(raw, lib)?.e164, e164, raw);
    assert.equal(core.parsePhone(raw, null)?.e164, e164, raw + " (repli)");
  }
});
test("invalid or foreign numbers are refused, with or without the library", () => {
  for (const raw of [
    "",
    "12345",
    "0470 12 34",
    "0470 12 34 56 78 90",
    "+31 6 12345678",
    "+44 7911 123456",
    "+1 202 555 0143",
    "appelez-moi",
    "0470123456<script>",
    "0000000000",
  ]) {
    assert.equal(core.parsePhone(raw, lib), null, raw);
    assert.equal(core.parsePhone(raw, null), null, raw + " (repli)");
  }
});
test("each required field is checked and reported by name", () => {
  const r = core.validate({}, lib);
  assert.deepEqual(Object.keys(r.errors).sort(), [
    "commune",
    "delai",
    "prenom",
    "telephone",
    "type",
  ]);
  for (const [k, bad] of [
    ["commune", "x".repeat(81)],
    ["commune", "<b>Beaumont</b>"],
    ["type", "Château"],
    ["delai", "Hier"],
    ["prenom", "http://spam.example"],
    ["email", "pas-un-email"],
    ["rappel", "Demain 14h"],
    ["message", "x".repeat(301)],
    ["origine", "javascript:alert(1)"],
  ])
    assert.ok(core.validate({ ...good, [k]: bad }, lib).errors[k], k + " " + bad);
  assert.equal(core.validate({ ...good, email: "", rappel: "", message: "" }, lib).ok, true);
});
test("the prepared mail contains only what the visitor typed", () => {
  const text = core.mailText(core.validate({ ...good, email: "" }, lib).value);
  assert.ok(text.includes("Beaumont") && text.includes("+32470123456"));
  assert.ok(!text.includes("E-mail"));
  assert.ok(text.includes("Préférence de rappel : Soirée"));
});

/* Reference handler */
const origin = "https://site.example";
const key = () => crypto.randomUUID();
function fixture(overrides = {}) {
  const store = memoryStore(),
    alerts = [],
    challenges = [];
  const handle = createInquiryHandler({
    store,
    phoneLib: lib,
    allowedOrigin: origin,
    rateLimit: memoryRateLimit({ max: 3 }),
    verifyChallenge: async (token, ip) => {
      challenges.push([token, ip]);
      return token === "ok";
    },
    notify: async (a) => alerts.push(a),
    ...overrides,
  });
  const post = (body, { k = key(), headers = {}, ip = "203.0.113.7" } = {}) =>
    handle({
      method: "POST",
      ip,
      headers: {
        origin,
        "content-type": "application/json",
        "idempotency-key": k,
        ...headers,
      },
      body: typeof body === "string" ? body : JSON.stringify({ captchaToken: "ok", website: "", ...body }),
    });
  return { store, alerts, challenges, handle, post };
}
const json = (r) => JSON.parse(r.body);

test("handler stores a valid request once and never echoes personal data", async () => {
  const f = fixture(),
    k = key();
  const first = await f.post(good, { k });
  assert.equal(first.status, 201);
  assert.equal(first.headers["Cache-Control"], "no-store");
  assert.match(json(first).reference, /^[0-9a-f]{8}$/);
  assert.ok(!first.body.includes("Camille") && !first.body.includes("470"));
  const again = await f.post(good, { k });
  assert.equal(again.status, 200);
  assert.equal(json(again).reference, json(first).reference);
  assert.equal(f.store.all().length, 1);
  const saved = f.store.all()[0];
  assert.equal(saved.status, "Nouvelle");
  assert.equal(saved.telephone, "+32470123456");
  assert.equal("website" in saved || "captchaToken" in saved, false);
  assert.equal(f.alerts.length, 1);
  assert.deepEqual(Object.keys(f.alerts[0]), ["id"]);
});
test("handler: a filled trap field looks like a success and stores nothing", async () => {
  const f = fixture();
  const r = await f.post({ ...good, website: "https://spam.example" });
  assert.equal(r.status, 200);
  assert.equal(json(r).ok, true);
  assert.equal(f.store.all().length, 0);
  assert.equal(f.challenges.length, 0);
});
test("handler: the anti-bot token is verified by the server, every time", async () => {
  const f = fixture();
  for (const token of ["", "faux", undefined, 42, "x".repeat(5000)]) {
    const r = await f.post({ ...good, captchaToken: token }, { ip: "198.51.100." + f.challenges.length });
    assert.equal(r.status, 403);
  }
  assert.equal(f.store.all().length, 0);
  await f.post(good, { ip: "198.51.100.200" });
  assert.deepEqual(f.challenges.at(-1), ["ok", "198.51.100.200"]);
});
test("handler: invalid input is refused with field errors and nothing is stored", async () => {
  const f = fixture();
  const r = await f.post({ ...good, telephone: "+44 7911 123456", type: "Château" });
  assert.equal(r.status, 422);
  assert.deepEqual(Object.keys(json(r).errors).sort(), ["telephone", "type"]);
  assert.equal(f.store.all().length, 0);
});
test("handler: wrong method, origin, type, size, JSON or key are refused", async () => {
  const f = fixture();
  assert.equal((await f.handle({ method: "GET", headers: {} })).status, 405);
  assert.equal((await f.post(good, { headers: { origin: "https://autre.example" } })).status, 403);
  assert.equal((await f.post(good, { headers: { "content-type": "text/plain" } })).status, 415);
  assert.equal((await f.post("{" + " ".repeat(9000) + "}", { ip: "a" })).status, 413);
  assert.equal((await f.post("{oups", { ip: "b" })).status, 400);
  assert.equal((await f.post("[1]", { ip: "c" })).status, 400);
  assert.equal((await f.post(good, { k: "pas-une-cle", ip: "d" })).status, 400);
  assert.equal(f.store.all().length, 0);
});
test("handler: rate limit per address, with Retry-After", async () => {
  const f = fixture();
  for (let i = 0; i < 3; i++) assert.equal((await f.post(good)).status, 201);
  const r = await f.post(good);
  assert.equal(r.status, 429);
  assert.ok(Number(r.headers["Retry-After"]) > 0);
  assert.equal((await f.post(good, { ip: "203.0.113.99" })).status, 201);
  assert.equal(f.store.all().length, 4);
});
test("handler: a storage failure is reported, an alert failure is not", async () => {
  const broken = fixture({ store: { put: async () => { throw Error("disque"); } } });
  assert.equal((await broken.post(good)).status, 503);
  const quiet = fixture({ notify: async () => { throw Error("mail"); } });
  assert.equal((await quiet.post(good)).status, 201);
  assert.equal(quiet.store.all().length, 1);
});

/* Publication guards */
test("reception is switched on by the SMTP password alone, and the secret stays out of the site", () => {
  const settings = (env) => {
    const window = {};
    new Function("window", inquiryConfig(env))(window);
    return window.IMMO_INQUIRY;
  };
  assert.equal(settings({}).endpoint, "");
  assert.equal(settings({ SMTP_PASSWORD: "secret-fictif" }).endpoint, ENDPOINT);
  assert.ok(!inquiryConfig({ SMTP_PASSWORD: "secret-fictif" }).includes("secret-fictif"));
  assert.equal(mailConfigured({}), false);
  assert.equal(mailConfigured({ SMTP_PASSWORD: "x" }), true);
  /* The password is read from the environment only: no tracked file holds one. */
  const m = mailSettings({});
  assert.deepEqual([m.host, m.user, m.to, m.password], ["mail.immobiliermartin.be", "no-reply@immobiliermartin.be", "info@immobiliermartin.be", ""]);
  for (const f of ["lib/inquiry-mail.mjs", "pages/api/demande.js", "scripts/prepare.cjs", "next.config.js", "vercel.json"])
    assert.ok(!/SMTP_PASSWORD\s*[:=]\s*["'][^"']/.test(read(f)), f);
  assert.ok(read(".gitignore").split(/\r?\n/).includes(".env*"));
  const out = fs.readdirSync(new URL("../public/", import.meta.url), { recursive: true }).map(String);
  assert.ok(!out.some((n) => /(^|[\\/])(lib|api|scripts|tests)[\\/]|inquiry-handler|inquiry-mail|\.env/.test(n)));
  const config = JSON.parse(read("vercel.json"));
  const csp = config.headers[0].headers.find((h) => h.key === "Content-Security-Policy").value;
  assert.ok(csp.includes("connect-src 'self'") && csp.includes("script-src 'self';"));
  assert.ok(!csp.includes("challenges.cloudflare.com") && !csp.includes("google"));
});
test("reCAPTCHA v3 is switched on by its two keys, loaded on the form page only, and judged by the server", async () => {
  const settings = (env) => {
    const window = {};
    new Function("window", inquiryConfig(env))(window);
    return window.IMMO_INQUIRY;
  };
  const site = "6Lfictif-cle-de-site_0123456789abcdefghij",
    env = { SMTP_PASSWORD: "x", RECAPTCHA_SITE_KEY: site, RECAPTCHA_SECRET_KEY: "secret-fictif" };
  assert.equal(settings(env).recaptchaSiteKey, site);
  assert.ok(!inquiryConfig(env).includes("secret-fictif"));
  /* One key alone, a malformed key or no reception: nothing is loaded from Google. */
  for (const partial of [{ ...env, RECAPTCHA_SECRET_KEY: "" }, { ...env, RECAPTCHA_SITE_KEY: "" }, { ...env, RECAPTCHA_SITE_KEY: 'x"y' }, { ...env, SMTP_PASSWORD: "" }])
    assert.equal(settings(partial).recaptchaSiteKey, "");
  assert.equal(recaptchaConfigured(env), true);
  assert.equal(recaptchaConfigured({ RECAPTCHA_SITE_KEY: site }), false);
  assert.equal(recaptchaSettings({}).minScore, 0.5);
  assert.equal(recaptchaSettings({ RECAPTCHA_MIN_SCORE: "0.7" }).minScore, 0.7);

  /* Every answer below is simulated: nothing is asked of Google. */
  const calls = [],
    reasons = [],
    clock = Date.parse("2026-11-23T10:00:00Z");
  const verifier = (answer, { ok = true, minScore = 0.5 } = {}) =>
    recaptchaVerifier({
      secret: "secret-fictif",
      minScore,
      hostname: "site.example",
      now: () => clock,
      report: (reason) => reasons.push(reason),
      fetch: async (url, init) => {
        calls.push([url, Object.fromEntries(init.body)]);
        if (answer instanceof Error) throw answer;
        return { ok, status: ok ? 200 : 500, json: async () => answer };
      },
    });
  const yes = { success: true, action: "estimation", score: 0.9, hostname: "site.example", challenge_ts: "2026-11-23T09:59:30Z" };
  assert.equal(await verifier(yes)("jeton", "203.0.113.7"), true);
  assert.deepEqual(calls[0], ["https://www.google.com/recaptcha/api/siteverify", { secret: "secret-fictif", response: "jeton", remoteip: "203.0.113.7" }]);
  assert.equal(reasons.length, 0);
  /* `success: true` is not enough: score, action, site and age are all read. */
  const refusals = [
    [{ ...yes, success: false, "error-codes": ["timeout-or-duplicate"] }, "refused:timeout-or-duplicate"],
    [{ ...yes, success: false, "error-codes": ["invalid-input-secret"] }, "refused:invalid-input-secret"],
    [{ ...yes, success: false }, "refused:no-code"],
    [{ ...yes, score: 0.3 }, "score"],
    [{ ...yes, score: undefined }, "score"],
    [{ ...yes, score: "0.9" }, "score"],
    [{ ...yes, action: "autre" }, "action"],
    [{ ...yes, action: undefined }, "action"],
    [{ ...yes, hostname: "ailleurs.example" }, "hostname"],
    [{ ...yes, hostname: undefined }, "hostname"],
    [{ ...yes, challenge_ts: "2026-11-23T09:55:00Z" }, "expired"],
    [{ ...yes, challenge_ts: "2026-11-23T10:05:00Z" }, "expired"],
    [{ ...yes, challenge_ts: undefined }, "expired"],
    [null, "unreadable-answer"],
    [Error("réseau"), "unreachable"],
  ];
  for (const [answer, reason] of refusals) {
    assert.equal(await verifier(answer)("jeton", ""), false, reason);
    assert.equal(reasons.at(-1), reason);
  }
  assert.equal(await verifier(yes, { ok: false })("jeton", ""), false);
  assert.equal(reasons.at(-1), "http-500");
  /* The threshold is a setting. */
  assert.equal(await verifier({ ...yes, score: 0.6 }, { minScore: 0.7 })("jeton", ""), false);
  assert.equal(await verifier({ ...yes, score: 0.7 }, { minScore: 0.7 })("jeton", ""), true);
  /* A refusal is logged by its reason only: neither the token nor the address. */
  assert.ok(reasons.every((r) => !r.includes("jeton") && !r.includes("203.0.113")));
  assert.throws(() => recaptchaVerifier({ secret: "x" }));
  /* The rate limit comes first and does not depend on the challenge. */
  const limited = fixture({ rateLimit: memoryRateLimit({ max: 1 }) });
  assert.equal((await limited.post(good, { ip: "192.0.2.9" })).status, 201);
  assert.equal((await limited.post(good, { ip: "192.0.2.9" })).status, 429);
  assert.equal(limited.challenges.length, 1);

  /* Google is allowed by the policy of the form page, and nowhere else. */
  const rules = JSON.parse(read("vercel.json")).headers;
  const withCsp = rules.filter((r) => r.headers.some((h) => h.key === "Content-Security-Policy"));
  assert.deepEqual(withCsp.map((r) => r.source), ["/(.*)", "/estimation(/?)"]);
  const strict = withCsp[0].headers.find((h) => h.key === "Content-Security-Policy").value,
    form = withCsp[1].headers.find((h) => h.key === "Content-Security-Policy").value;
  const directives = (csp) => Object.fromEntries(csp.split("; ").map((d) => [d.split(" ")[0], d.split(" ").slice(1).join(" ")]));
  const a = directives(strict),
    b = directives(form);
  for (const name of Object.keys(a))
    if (!["script-src", "connect-src"].includes(name)) assert.equal(b[name], a[name], name);
  assert.equal(b["script-src"], "'self' https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/");
  assert.equal(b["connect-src"], "'self' https://www.google.com/recaptcha/");
  assert.equal(b["frame-src"], "https://www.google.com/recaptcha/ https://recaptcha.google.com/recaptcha/");
  assert.ok(!form.includes("unsafe") && !form.includes("*"));
  const js = read("public/estimation.js"),
    html = read("content/estimation/index.html");
  assert.ok(js.includes('"https://www.google.com/recaptcha/api.js?render="') && js.includes('action: "estimation"'));
  assert.ok(html.includes('id="captcha-note" hidden') && html.includes("policies.google.com/privacy"));
  assert.ok(read("content/politique-confidentialite.html").includes("reCAPTCHA v3"));
});
test("the request is sent once to the business inbox, from the no-reply address, with the visitor as reply-to", async () => {
  const sent = [];
  const settings = mailSettings({ SMTP_PASSWORD: "x" });
  const store = mailStore({ transport: { sendMail: async (m) => sent.push(m) }, settings });
  const f = fixture({ store, verifyChallenge: null });
  const k = key();
  assert.equal((await f.post(good, { k })).status, 201);
  assert.equal((await f.post(good, { k })).status, 200);
  assert.equal(sent.length, 1);
  const mail = sent[0];
  assert.equal(mail.to, "info@immobiliermartin.be");
  assert.equal(mail.from.address, "no-reply@immobiliermartin.be");
  assert.equal(mail.replyTo, "camille@example.org");
  assert.equal(mail.subject, "Demande d’estimation — Beaumont — Camille");
  for (const expected of ["Commune : Beaumont", "Type de bien : Maison", "Téléphone : +32470123456", "Précision : Maison quatre façades."])
    assert.ok(mail.text.includes(expected), expected);
  assert.ok(!("html" in mail));
  /* A header cannot be forged through a field. */
  const forged = inquiryMail({ id: "12345678-aaaa", receivedAt: "2026-11-22T10:00:00Z", commune: "Thuin\r\nBcc: x@example.org", prenom: "A", telephone: "+32470123456" }, settings);
  assert.ok(!/[\r\n]/.test(forged.subject));
  /* A delivery failure is reported to the page, which then offers the phone and the prepared e-mail. */
  const down = fixture({ store: mailStore({ transport: { sendMail: async () => { throw Error("smtp"); } }, settings }), verifyChallenge: null });
  assert.equal((await down.post(good)).status, 503);
});
test("the page keeps answers in memory only and names the callback as a preference", () => {
  const js = read("public/estimation.js"),
    html = read("content/estimation/index.html");
  assert.ok(!/localStorage|sessionStorage|indexedDB|document\.cookie|caches\./.test(js));
  assert.ok(!/innerHTML|insertAdjacentHTML|eval\(/.test(js));
  assert.ok(js.includes('credentials: "omit"') && js.includes('cache: "no-store"'));
  assert.ok(html.includes("C’est une préférence, pas un rendez-vous"));
  assert.ok(!/rendez-vous confirmé|créneau réservé/i.test(html));
  assert.ok(html.includes('name="website"') && html.includes('tabindex="-1"'));
  for (const name of ["commune", "prenom", "telephone", "email", "message"])
    assert.ok(html.includes(`aria-describedby="${name === "telephone" ? "hint-telephone " : ""}err-${name}"`), name);
  assert.ok(!/ style="/.test(html), "inline styles would be blocked by the CSP");
  const sw = read("public/service-worker.js");
  assert.ok(!sw.includes("/api/") && !sw.includes("vendor/"));
});
test("page and shared rules offer exactly the same choices", () => {
  const html = read("content/estimation/index.html");
  const options = (name) => [...html.matchAll(new RegExp(`name="${name}" value="([^"]+)"`, "g"))].map((m) => m[1]);
  assert.deepEqual(options("type"), core.TYPES);
  assert.deepEqual(options("delai"), core.DELAYS);
  assert.deepEqual(options("rappel"), core.CALLBACKS);
});

/* Contract shared with the cockpit: the same file lives in its tests, where the
   inbox model must accept it. Fictitious person. */
test("contract: the stored request is exactly the shape the cockpit expects", async () => {
  const expected = JSON.parse(read("tests/fixtures/demande-contrat.json"));
  const f = fixture({
    newId: () => expected.id,
    now: () => new Date(expected.receivedAt),
  });
  const r = await f.post({
    commune: "Beaumont",
    type: "Maison",
    delai: "Dans les six mois",
    prenom: "Camille",
    telephone: "0470 12 34 51",
    email: "camille@example.org",
    rappel: "Soirée",
    message: "Maison quatre façades, je réfléchis à vendre au printemps.",
    origine: "/estimation/",
  });
  assert.equal(r.status, 201);
  assert.deepEqual(f.store.all()[0], expected);
  assert.deepEqual(Object.keys(expected), [
    "id",
    "receivedAt",
    "status",
    "commune",
    "type",
    "delai",
    "prenom",
    "telephone",
    "pays",
    "email",
    "rappel",
    "message",
    "origine",
  ]);
});
