/* Durable reception: file store, guards and the host-independent server.
   Fictitious people only; every test writes in its own temporary directory. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createFileStore } from "../server/file-store.mjs";
import { createFileRateLimit, createTurnstileVerifier } from "../server/guards.mjs";
import { createSiteServer } from "../server/node-server.mjs";

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "immo-reception-"));
const id = (n) => `d1a0f3c2-000${n}-4000-8000-00000000000${n}`;
const record = (n = 1) => ({ id: id(n), receivedAt: "2026-11-17T09:00:00.000Z", status: "Nouvelle", commune: "Beaumont", type: "Maison", delai: "Plus tard", prenom: "Camille", telephone: "+32470123451", pays: "BE" });
const files = (dir, sub) => (fs.existsSync(path.join(dir, sub)) ? fs.readdirSync(path.join(dir, sub)) : []);

test("file store: a request is written once per key and survives a restart", async () => {
  const dir = tmp(), k = crypto.randomUUID();
  const first = await createFileStore(dir).put(k, record(1));
  assert.equal(first.created, true);
  const again = await createFileStore(dir).put(k, { ...record(2), prenom: "Autre" }); // new instance = after a restart
  assert.equal(again.created, false);
  assert.equal(again.record.id, id(1));
  assert.equal(again.record.prenom, "Camille");
  assert.deepEqual(files(dir, "demandes"), [id(1) + ".json"]);
  const onDisk = JSON.parse(fs.readFileSync(path.join(dir, "demandes", id(1) + ".json"), "utf8"));
  assert.deepEqual(onDisk, { schema: 1, version: 1, key: k, record: record(1) });
  assert.equal(files(dir, "demandes").some((n) => n.endsWith(".tmp")), false);
});
test("file store: simultaneous submissions with one key create a single request", async () => {
  const dir = tmp(), store = createFileStore(dir), k = crypto.randomUUID();
  const results = await Promise.all(Array.from({ length: 8 }, (_, i) => store.put(k, record((i % 8) + 1)).catch((e) => e)));
  const ok = results.filter((r) => r && r.record);
  assert.ok(ok.length >= 1);
  assert.equal(ok.filter((r) => r.created).length, 1);
  assert.equal(files(dir, "demandes").length, 1);
  assert.equal(files(dir, "cles").length, 1);
});
test("file store: an interrupted first attempt is finished, bad input and a broken disk are refused", async () => {
  const dir = tmp(), store = createFileStore(dir), k = crypto.randomUUID();
  fs.mkdirSync(path.join(dir, "cles"), { recursive: true });
  fs.writeFileSync(path.join(dir, "cles", k + ".json"), JSON.stringify({ id: id(3) })); // key reserved, request never written
  const r = await store.put(k, record(4));
  assert.equal(r.created, true);
  assert.equal(r.record.id, id(3));
  await assert.rejects(store.put("../evasion", record(1)));
  await assert.rejects(store.put(crypto.randomUUID(), { ...record(1), id: "../../x" }));
  assert.throws(() => createFileStore("relatif"));
  const blocked = tmp();
  fs.writeFileSync(path.join(blocked, "demandes"), "pas un dossier");
  await assert.rejects(createFileStore(blocked).put(crypto.randomUUID(), record(1)));
  assert.deepEqual(files(blocked, "cles"), [], "a failed write releases the key so the visitor can retry");
});
test("rate limit: kept on disk across restarts, without storing the visitor's address", async () => {
  const dir = tmp();
  let t = 1000;
  const make = () => createFileRateLimit({ dir, secret: "secret-de-test", max: 2, windowMs: 1000, now: () => t });
  assert.equal((await make()("203.0.113.7")).allowed, true);
  assert.equal((await make()("203.0.113.7")).allowed, true);
  const refused = await make()("203.0.113.7"); // third hit, new instance
  assert.equal(refused.allowed, false);
  assert.ok(refused.retryAfter >= 1);
  assert.equal((await make()("203.0.113.8")).allowed, true);
  t += 1001;
  assert.equal((await make()("203.0.113.7")).allowed, true);
  for (const name of files(dir, "debit")) assert.ok(!name.includes("203") && !fs.readFileSync(path.join(dir, "debit", name), "utf8").includes("203.0.113"));
  assert.throws(() => createFileRateLimit({ dir, secret: "" }));
});
test("Turnstile: the token is checked with the secret key; any doubt is a refusal", async () => {
  const calls = [];
  const reply = (data, ok = true) => async (url, init) => { calls.push([url, Object.fromEntries(init.body)]); return { ok, json: async () => data }; };
  const good = createTurnstileVerifier({ secret: "cle-secrete", hostname: "site.example", fetcher: reply({ success: true, hostname: "site.example" }) });
  assert.equal(await good("jeton", "203.0.113.7"), true);
  assert.deepEqual(calls[0], ["https://challenges.cloudflare.com/turnstile/v0/siteverify", { secret: "cle-secrete", response: "jeton", remoteip: "203.0.113.7" }]);
  const make = (fetcher) => createTurnstileVerifier({ secret: "s", hostname: "site.example", fetcher, timeoutMs: 30 });
  assert.equal(await make(reply({ success: false }))("jeton"), false);
  assert.equal(await make(reply({ success: true, hostname: "autre.example" }))("jeton"), false);
  assert.equal(await make(reply({ success: true, hostname: "site.example" }, false))("jeton"), false);
  assert.equal(await make(async () => { throw Error("réseau"); })("jeton"), false);
  assert.equal(await make((u, init) => new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(Error("délai")))))("jeton"), false);
  assert.throws(() => createTurnstileVerifier({ secret: "" }));
});

/* The server, on a free local port */
async function serve(options) {
  const server = createSiteServer(options);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { server, origin: "http://127.0.0.1:" + server.address().port, close: () => new Promise((r) => server.close(r)) };
}
const good = { commune: "Beaumont", type: "Maison", delai: "Dans les six mois", prenom: "Camille", telephone: "0470 12 34 51", website: "", turnstileToken: "ok" };
const post = (origin, body, { k = crypto.randomUUID(), from = origin } = {}) => fetch(origin + "/api/demande", { method: "POST", headers: { "Content-Type": "application/json", Origin: from, "Idempotency-Key": k }, body: JSON.stringify(body) });

test("server without reception: static pages only, nothing can be submitted", async () => {
  const s = await serve({});
  try {
    const home = await fetch(s.origin + "/");
    assert.equal(home.status, 200);
    assert.equal(home.headers.get("x-robots-tag"), "noindex, nofollow");
    assert.ok(home.headers.get("content-security-policy").includes("form-action 'none'"));
    assert.ok(!home.headers.get("content-security-policy").includes("cloudflare"));
    assert.equal((await post(s.origin, good)).status, 404);
    assert.ok(/endpoint:\s*""/.test(await (await fetch(s.origin + "/inquiry-config.js")).text()));
    assert.equal((await fetch(s.origin + "/", { method: "POST" })).status, 405);
    for (const p of ["/../package.json", "/%2e%2e/package.json", "/server/node-server.mjs", "/tests/reception.test.mjs"]) assert.equal((await fetch(s.origin + p)).status, 404, p);
  } finally { await s.close(); }
  assert.throws(() => createSiteServer({ reception: true }), /needs an origin/);
});
test("server with reception: stored on disk, once, and still there after a restart", async () => {
  const dir = tmp(), k = crypto.randomUUID();
  // The public origin is fixed by configuration; the listening port is free, so a restart never reuses a closed connection.
  const site = "https://site.example";
  const start = () => serve({ origin: site, reception: true, storeDir: dir, rateSecret: "secret-de-test", rateMax: 50, turnstile: { siteKey: "cle", script: "/mock.js", scriptBody: "", verify: async (t) => t === "ok" } });
  let s = await start(), reference;
  try {
    const first = await post(s.origin, good, { k, from: site });
    assert.equal(first.status, 201);
    reference = (await first.json()).reference;
    assert.equal((await post(s.origin, good, { k, from: site })).status, 200);
    assert.ok((await (await fetch(s.origin + "/inquiry-config.js")).text()).includes('"endpoint":"/api/demande"'));
    assert.equal((await post(s.origin, good, { from: "https://autre.example" })).status, 403);
    assert.equal((await post(s.origin, { ...good, turnstileToken: "faux" }, { from: site })).status, 403);
    assert.equal((await post(s.origin, { ...good, website: "spam" }, { from: site })).status, 200);
    assert.equal((await post(s.origin, { ...good, telephone: "+44 7911 123456" }, { from: site })).status, 422);
  } finally { await s.close(); }
  assert.equal(files(dir, "demandes").length, 1);
  s = await start(); // restart: new process state, same directory
  try {
    const after = await post(s.origin, good, { k, from: site });
    assert.equal(after.status, 200);
    assert.equal((await after.json()).reference, reference);
  } finally { await s.close(); }
  assert.equal(files(dir, "demandes").length, 1);
  const saved = JSON.parse(fs.readFileSync(path.join(dir, "demandes", files(dir, "demandes")[0]), "utf8")).record;
  assert.equal(saved.telephone, "+32470123451");
  assert.equal(saved.status, "Nouvelle");
  assert.deepEqual(Object.keys(saved).sort(), ["commune", "delai", "id", "origine", "pays", "prenom", "receivedAt", "status", "telephone", "type"]);
  assert.equal(saved.origine, "/estimation/"); // no campaign: neutral origin
});
test("server: the commercial origin is checked again before it is stored", async () => {
  const dir = tmp(), site = "https://site.example";
  const s = await serve({ origin: site, reception: true, storeDir: dir, rateSecret: "secret-de-test", rateMax: 50, turnstile: { siteKey: "cle", script: "/mock.js", scriptBody: "", verify: async (t) => t === "ok" } });
  const sent = async (prenom, origine) => {
    assert.equal((await post(s.origin, { ...good, prenom, ...(origine === undefined ? {} : { origine }) }, { from: site })).status, 201, prenom);
  };
  try {
    await sent("Alice", "/estimation/qr-commerce.qr.estimation-2027-01.beaumont-p01");
    await sent("Bruno", undefined);
    await sent("Chloé", "/estimation/flyer.print.estimation-2027-01.bruxelles"); // unknown sector
    await sent("David", "/estimation/newsletter.email.promo.beaumont"); // unknown support
    assert.equal((await post(s.origin, { ...good, prenom: "Emma", origine: "/estimation/<b>" }, { from: site })).status, 422);
  } finally { await s.close(); }
  const byName = Object.fromEntries(files(dir, "demandes").map((f) => JSON.parse(fs.readFileSync(path.join(dir, "demandes", f), "utf8")).record).map((r) => [r.prenom, r.origine]));
  assert.deepEqual(byName, {
    Alice: "/estimation/qr-commerce.qr.estimation-2027-01.beaumont-p01",
    Bruno: "/estimation/",
    Chloé: "/estimation/",
    David: "/estimation/",
  });
});

test("server: a storage failure is never confirmed to the visitor; the rate limit holds", async () => {
  const dir = tmp();
  const base = { reception: true, storeDir: dir, rateSecret: "secret-de-test", rateMax: 2, turnstile: { siteKey: "cle", script: "/mock.js", scriptBody: "", verify: async () => true } };
  const site = "https://site.example";
  const s = await serve({ ...base, origin: site, store: { put: async () => { throw Error("disque plein"); } } });
  try {
    const broken = await post(s.origin, good, { from: site });
    assert.equal(broken.status, 503);
    assert.equal((await broken.json()).ok, false);
    assert.equal((await post(s.origin, good, { from: site })).status, 503);
    assert.equal((await post(s.origin, good, { from: site })).status, 429);
  } finally { await s.close(); }
  assert.equal(files(dir, "demandes").length, 0);
});
test("the deployed build still collects nothing", () => {
  const read = (f) => fs.readFileSync(new URL("../" + f, import.meta.url), "utf8");
  assert.ok(/endpoint:\s*""/.test(read("inquiry-config.js")));
  assert.equal(JSON.parse(read("vercel.json")).functions, undefined);
  assert.ok(!fs.existsSync(new URL("../api", import.meta.url)));
  const out = fs.readdirSync(new URL("../public-dist/", import.meta.url), { recursive: true }).map(String);
  assert.ok(!out.some((n) => /node-server|file-store|guards|inquiry-handler/.test(n)));
});
