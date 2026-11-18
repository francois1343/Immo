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
} from "../server/inquiry-handler.mjs";

const require = createRequire(import.meta.url);
const core = require("../inquiry-core.js");
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
    verifyTurnstile: async (token, ip) => {
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
      body: typeof body === "string" ? body : JSON.stringify({ turnstileToken: "ok", website: "", ...body }),
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
  assert.equal("website" in saved || "turnstileToken" in saved, false);
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
  for (const token of ["", "faux", undefined, 42, "x".repeat(3000)]) {
    const r = await f.post({ ...good, turnstileToken: token }, { ip: "198.51.100." + f.challenges.length });
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
  assert.equal((await f.post("{" + " ".repeat(5000) + "}", { ip: "a" })).status, 413);
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
test("no reception is connected: empty endpoint and key, in sources and in the build", () => {
  for (const f of ["inquiry-config.js", "public-dist/inquiry-config.js"]) {
    const window = {};
    new Function("window", read(f))(window);
    assert.equal(window.IMMO_INQUIRY.endpoint, "", f);
    assert.equal(window.IMMO_INQUIRY.turnstileSiteKey, "", f);
  }
  const out = fs.readdirSync(new URL("../public-dist/", import.meta.url), { recursive: true }).map(String);
  assert.ok(!out.some((n) => /(^|[\\/])(server|api|scripts|tests)[\\/]|inquiry-handler|dev-server/.test(n)));
  assert.ok(out.some((n) => n.replaceAll("\\", "/") === "vendor/libphonenumber-min.js"));
  const config = JSON.parse(read("vercel.json"));
  assert.equal(config.functions, undefined);
  const csp = config.headers[0].headers.find((h) => h.key === "Content-Security-Policy").value;
  assert.ok(csp.includes("connect-src 'self'") && csp.includes("script-src 'self';"));
  assert.ok(!csp.includes("challenges.cloudflare.com"));
});
test("the page keeps answers in memory only and names the callback as a preference", () => {
  const js = read("estimation.js"),
    html = read("estimation/index.html");
  assert.ok(!/localStorage|sessionStorage|indexedDB|document\.cookie|caches\./.test(js));
  assert.ok(!/innerHTML|insertAdjacentHTML|eval\(/.test(js));
  assert.ok(js.includes('credentials: "omit"') && js.includes('cache: "no-store"'));
  assert.ok(html.includes("C’est une préférence, pas un rendez-vous"));
  assert.ok(!/rendez-vous confirmé|créneau réservé/i.test(html));
  assert.ok(html.includes('name="website"') && html.includes('tabindex="-1"'));
  for (const name of ["commune", "prenom", "telephone", "email", "message"])
    assert.ok(html.includes(`aria-describedby="${name === "telephone" ? "hint-telephone " : ""}err-${name}"`), name);
  assert.ok(!/ style="/.test(html), "inline styles would be blocked by the CSP");
  const sw = read("service-worker.js");
  assert.ok(!sw.includes("/api/") && !sw.includes("vendor/"));
});
test("page and shared rules offer exactly the same choices", () => {
  const html = read("estimation/index.html");
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

test("campaign origin: known support, strict format and known sector, or a direct visit", () => {
  const sectors = require("../data/zones.json").communes.map((c) => c.id);
  const from = (query) => core.originFromParams((k) => new URLSearchParams(query).get(k), sectors);
  const flyer = "utm_source=flyer&utm_medium=print&utm_campaign=estimation-2027-01&utm_content=beaumont";
  assert.equal(from(flyer), "/estimation/flyer.print.estimation-2027-01.beaumont");
  /* Case and spaces are normalised; a partner number is kept. */
  assert.equal(
    from("utm_source=QR-Commerce&utm_medium=QR&utm_campaign=Estimation-2027-01&utm_content=%20walcourt-p03"),
    "/estimation/qr-commerce.qr.estimation-2027-01.walcourt-p03",
  );
  /* Anything else is a direct visit: no parameter, a missing part, an unknown
     support, a medium that does not belong to the support, an unknown sector,
     free text, a person's name or e-mail, an overlong value. */
  for (const query of [
    "",
    "commune=Beaumont",
    "utm_source=flyer&utm_medium=print&utm_campaign=estimation-2027-01",
    flyer.replace("flyer", "newsletter"),
    flyer.replace("print", "paid-social"),
    flyer.replace("beaumont", "bruxelles"),
    flyer.replace("beaumont", "couvin-centre"),
    flyer.replace("estimation-2027-01", "Promo d'été !"),
    flyer.replace("beaumont", "camille.dupont@example.org"),
    flyer.replace("estimation-2027-01", "x".repeat(33)),
    flyer.replace("beaumont", "beaumont.extra"),
  ])
    assert.equal(from(query), core.NEUTRAL_ORIGIN, query);
  /* What validate() stores is always neutral or canonical, never the raw input. */
  const store = (origine) => core.validate({ ...good, origine }, lib, { sectors });
  assert.equal(store(undefined).value.origine, "/estimation/");
  assert.equal(store("/estimation/FLYER.print.estimation-2027-01.beaumont").value.origine, "/estimation/flyer.print.estimation-2027-01.beaumont");
  assert.equal(store("/une/autre/page").value.origine, "/estimation/");
  assert.equal(store("/estimation/flyer.print.estimation-2027-01.bruxelles").value.origine, "/estimation/");
  assert.ok(store("/estimation/<script>").errors.origine);
  /* Every link the generator prints is recognised, and excluded centres get a
     link by sector id only. */
  const { links } = require("../scripts/campaign-links.cjs");
  const rows = links(require("../data/zones.json"), "estimation-2027-01", "https://exemple.test");
  assert.equal(rows.length, 65);
  for (const row of rows) {
    const origin = from(new URL(row.url).search.slice(1));
    assert.notEqual(origin, core.NEUTRAL_ORIGIN, row.url);
    assert.equal(core.parseOrigin(origin).source, row.support);
  }
});
