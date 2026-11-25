const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  P = require("../scripts/partials.cjs"),
  C = require("../scripts/pages/catalog.cjs"),
  Q = require("../scripts/pages/quality.cjs"),
  S = require("../scripts/seo.cjs"),
  I = require("../scripts/indexnow.cjs"),
  config = require("../seo.config.json"),
  server = require("../server.config.json");

const data = C.load(),
  { pages, setAside } = C.plan(data),
  quality = Q.evaluate(pages, data.editorial);
const text = (p) => Q.text(p.main);
/* The same site with one village left undocumented: its sourced note is missing. */
const sparse = structuredClone(data);
sparse.local.communes.thuin.localities["Biercée"].note = null;
sparse.local.communes.thuin.landmarks = sparse.local.communes.thuin.landmarks.filter((x) => x.locality !== "Biercée");
const sparsePages = C.plan(sparse).pages,
  sparseQuality = Q.evaluate(sparsePages, {});

test("the catalogue produces every family of pages, each with a unique address, title and H1", () => {
  const count = (f) => pages.filter((p) => p.family === f).length;
  assert.equal(count("service"), data.services.length);
  assert.equal(count("commune"), 13);
  assert.equal(count("locality"), 90);
  assert.equal(count("guide"), data.guides.length);
  /* Volume is not a goal: a declination that would repeat its parent is set
     aside, with the parent it is consolidated into. */
  assert.ok(pages.length >= 120 && pages.length <= 500, String(pages.length));
  assert.equal(pages.length + setAside.length, 377);
  const published = new Set(pages.map((p) => p.route));
  for (const r of setAside) {
    assert.ok(!published.has(r.route), r.route);
    assert.ok(["consolidée", "brouillon"].includes(r.decision) && r.reason, r.route);
    assert.ok(published.has(r.into), `${r.route} → ${r.into}`);
  }
  /* No page links to a page that was set aside. */
  for (const p of pages)
    for (const m of p.main.matchAll(/href="(\/[^"#?]*)"/g))
      assert.ok(!setAside.some((r) => r.route === m[1]), `${p.route} → ${m[1]}`);
  /* Every published village declination passed the quality gate. */
  for (const r of quality.rows.filter((x) => x.family === "service-locality")) assert.equal(r.status, "complete", r.route);
  assert.deepEqual(quality.errors, []);
  for (const p of pages) {
    assert.match(p.route, /^\/[a-z0-9-]+(\/[a-z0-9-]+)*\/$/, p.route);
    assert.ok(p.title.length <= 70, `${p.route} : titre de ${p.title.length} caractères`);
    assert.ok(p.description.length >= 70 && p.description.length <= 170, `${p.route} : description`);
    assert.equal((p.main.match(/<h1/g) || []).length, 1, p.route);
  }
});

test("no generated page presents an excluded centre as a sector or claims an office there", () => {
  const banned = P.excludedNames(data.zones);
  for (const p of pages) {
    for (const name of banned) {
      assert.ok(!new RegExp(`/${P.slug(name)}/$`).test(p.route) || p.family !== "locality", p.route);
      for (const field of [p.title, p.h1, p.description, text(p)])
        assert.ok(!new RegExp(`\\bà ${name}\\b`).test(field), `${p.route} : « à ${name} »`);
    }
    /* Martin has one address, in Barbençon. No page may give him another. */
    assert.ok(!/(bureau|agence) (de Martin |situé |située )?à (?!Barbençon)/i.test(text(p)), p.route);
    /* Wording agreed on 2026-11-21: no defensive sentence, no question about an office. */
    assert.ok(!/n’a pas (de bureau|à)|a-t-il un(e)? (bureau|agence)/i.test(text(p)), p.route);
  }
  const names = new Set(P.targets(data.zones).map((t) => P.key(t.locality)));
  for (const p of pages.filter((x) => x.locality)) assert.ok(names.has(P.key(p.locality)), p.route);
});

test("local emblems: a known pictogram, a sourced landmark, never a place outside the targeted villages", () => {
  const E = require("../scripts/pages/emblems.cjs");
  assert.ok(E.validate(data.local));
  const broken = structuredClone(data.local);
  broken.communes.beaumont.landmarks[0].emblem = { icon: "inconnu", label: "x" };
  assert.throws(() => E.validate(broken));
  const targeted = new Set(P.targets(data.zones).map((x) => P.key(x.locality)));
  const banned = P.excludedNames(data.zones);
  const marks = new Map();
  for (const p of pages) {
    const m = /<p class="local-mark">.*?<strong>(.*?)<\/strong>(?:<span>(.*?)<\/span>)?/.exec(p.main);
    if (!m) continue;
    assert.ok(["commune", "locality", "service-commune", "service-locality"].includes(p.family), p.route);
    if (m[2]) assert.ok(targeted.has(P.key(m[2])) && !banned.includes(m[2]), `${p.route} : ${m[2]}`);
    if (p.family === "commune") marks.set(p.route, m[1]);
  }
  /* Every commune page has its own mark: Beaumont does not look like Chimay or Thuin. */
  assert.equal(marks.size, data.zones.communes.filter((c) => c.active).length);
  assert.equal(new Set(marks.values()).size, marks.size);
  assert.equal(marks.get("/secteurs/beaumont/"), "Tour Salamandre");
});

test("a local page without enough sourced facts stays to review, and nothing is approved by default", () => {
  const rows = quality.rows;
  assert.ok(rows.some((r) => r.status === "complete"));
  assert.equal(sparseQuality.rows.find((r) => r.route === "/secteurs/thuin/biercee/").status, "to-review");
  assert.equal(Q.evaluate(pages, {}).rows.filter((r) => r.approved).length, 0);
  /* Without local data every local page falls back to review, and no village
     declination is published at all. */
  const bare = C.plan({ ...data, local: { communes: {} } });
  const q = Q.evaluate(bare.pages, {});
  for (const r of q.rows.filter((x) => ["commune", "locality", "service-commune"].includes(x.family)))
    assert.equal(r.status, "to-review", r.route);
  assert.equal(bare.pages.filter((p) => p.family === "service-locality").length, 0);
  /* An apartment page needs official apartment sales in the commune. */
  for (const p of pages.filter((x) => x.service === "vendre-appartement" && x.family === "service-commune"))
    assert.ok(data.local.communes[p.commune].market.apartmentsMedian, p.route);
  /* Complete pages carry a publication phase; the others none. */
  for (const r of rows) assert.equal(Boolean(r.phase), r.status === "complete", r.route);
});

test("approval needs a complete page, and a held page is never approved", () => {
  const complete = sparseQuality.rows.find((r) => r.family === "commune" && r.status === "complete"),
    weak = sparseQuality.rows.find((r) => r.status === "to-review");
  const q = Q.evaluate(sparsePages, { approvedFamilies: ["commune"], approvedRoutes: [weak.route], heldRoutes: [complete.route] });
  const row = (route) => q.rows.find((r) => r.route === route);
  assert.equal(row(weak.route).approved, false);
  assert.equal(row(complete.route).approved, false);
  assert.ok(q.rows.some((r) => r.family === "commune" && r.approved));
});

test("near copies are detected", () => {
  const a = Q.shingles(Q.words("vendre une maison à Beaumont avec Martin Snauwaert agent immobilier agréé")),
    b = Q.shingles(Q.words("vendre une maison à Chimay avec Martin Snauwaert agent immobilier agréé"));
  assert.ok(Q.jaccard(a, a) === 1);
  assert.ok(Q.jaccard(a, b) < 0.6);
});

test("local data only describes configured places, and every displayed fact has a source", () => {
  assert.throws(() => C.validate({ ...data, local: { communes: { nowhere: {} } } }));
  assert.throws(() => C.validate({ ...data, local: { communes: { couvin: { localities: { Couvin: {} } } } } }));
  for (const [id, L] of Object.entries(data.local.communes)) {
    if (L.population) assert.match(L.population.source, /^https:\/\/statbel\.fgov\.be\//, id);
    if (L.market) assert.match(L.market.source, /^https:\/\/statbel\.fgov\.be\//, id);
    for (const s of [...(L.stations || []), ...(L.landmarks || [])]) assert.match(s.source, /^https:\/\//, id);
  }
  /* A station of an excluded centre never reaches a page. */
  const couvin = pages.filter((p) => p.commune === "couvin").map(text).join(" ");
  assert.ok(!/gare[^.]*\bCouvin\b/i.test(couvin.replace(/villages de Couvin/gi, "")));
});

test("going live is refused until every check is confirmed and the noindex header removed", () => {
  const checks = Object.fromEntries(Object.keys(config.publicationChecks).map((k) => [k, true]));
  const pending = { ...checks, finalDomainConfirmed: false };
  const closed = { ...server, headers: server.headers.map((h, i) => (i ? h : { ...h, headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }, ...h.headers] })) };
  assert.throws(() => S.validate({ ...config, mode: "live", publicationChecks: pending }, server), /validations manquantes : finalDomainConfirmed/);
  assert.throws(() => S.validate({ ...config, mode: "live", publicationChecks: {} }, server), /validations manquantes/);
  assert.throws(() => S.validate({ ...config, mode: "live", publicationChecks: checks }, closed), /X-Robots-Tag/);
  assert.equal(S.validate({ ...config, mode: "live", publicationChecks: checks }, server), true);
  const html = '<head><title>T</title></head><body><div class="draft">Aperçu</div></body>';
  const live = { ...config, mode: "live" };
  assert.match(S.enrich(html, { route: "/x/", description: "d", index: true }, live), /content="index,follow"/);
  assert.match(S.enrich(html, { route: "/x/", description: "d", index: false }, live), /content="noindex,follow"/);
  assert.ok(!S.enrich(html, { route: "/x/", description: "d", index: true }, live).includes('class="draft"'));
  assert.match(S.enrich(html, { route: "/x/", description: "d", index: true }, { ...config, mode: "preview" }), /content="noindex,nofollow"/);
});

test("structured data carries verified details only: no rating, no review", () => {
  const ld = S.agentLd(config, data.pro, data.zones);
  assert.equal(ld["@type"], "RealEstateAgent");
  assert.equal(ld.address.addressLocality, "Barbençon");
  const raw = JSON.stringify(ld);
  for (const word of ["aggregateRating", "review", "ratingValue", "priceRange", "openingHours"]) assert.ok(!raw.includes(word), word);
  for (const name of P.excludedNames(data.zones)) assert.ok(!ld.areaServed.some((a) => a.name === name), name);
  const pending = structuredClone(data.pro);
  pending.fields.find((f) => f.key === "address").status = "to-confirm";
  assert.equal(S.agentLd(config, pending, data.zones).address, undefined);
  const crumbs = S.breadcrumbLd(config, [["Accueil", "/"], ["Secteurs", "/secteurs/"], ["Thuin", null]], "/secteurs/thuin/");
  assert.equal(crumbs.itemListElement[2].item, config.origin + "/secteurs/thuin/");
});

test("reviews: no rating without a dated reading, no quote without consent, nothing copied by default", () => {
  const r = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "reviews.json"), "utf8"));
  /* The rating shown is the one read on the listing, with its date; no quote. */
  assert.ok(r.rating >= 1 && r.rating <= 5 && r.count >= 1);
  assert.match(r.ratingCheckedOn, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(r.quotes.length, 0);
  const html = P.reviews(r);
  assert.ok(html.includes("Voir nos avis") && html.includes(r.googleUrl));
  assert.ok(html.includes(`${String(r.rating).replace(".", ",")}/5`) && html.includes(`${r.count} avis Google, relevé le`));
  const unrated = P.reviews({ ...r, rating: null, count: null, ratingCheckedOn: "" });
  assert.ok(!/\d\/5|étoile/.test(unrated));
  assert.throws(() => P.validateReviews({ ...r, ratingCheckedOn: "" }));
  assert.throws(() => P.validateReviews({ ...r, rating: 4.9, count: null }));
  assert.throws(() => P.validateReviews({ ...r, quotes: [{ text: "Très bien", author: "A." }] }));
  assert.throws(() => P.validateReviews({ ...r, googleUrl: "https://exemple.test/avis" }));
  assert.match(P.reviews({ ...r, rating: 4.8, count: 12, ratingCheckedOn: "2026-12-01" }), /4,8/);
});

test("IndexNow sends nothing from a preview, a foreign address or without a key", () => {
  const url = [config.origin + "/"];
  assert.equal(I.plan({ ...config, mode: "preview" }, url).allowed, false);
  const live = { ...config, mode: "live", indexNow: { key: "abcdef0123456789" } };
  const real = { ...live, origin: "https://exemple-immo.be" };
  assert.equal(I.plan(live, ["https://exemple-immo.be/"]).allowed, false, "URL outside the configured origin");
  assert.equal(I.plan(real, ["https://exemple-immo.be/"]).allowed, true);
  assert.equal(I.plan(real, ["https://autre.be/"]).allowed, false);
  assert.equal(I.plan(real, []).allowed, false);
  assert.equal(I.plan({ ...real, indexNow: { key: "" } }, ["https://exemple-immo.be/"]).allowed, false);
});

test("the catalogue link and the main navigation are on every page shell", () => {
  const nav = P.nav("/secteurs/thuin/");
  assert.ok(nav.includes('href="https://connexionimmo.be/fr/nos-biens/"'));
  assert.ok(nav.includes('rel="noopener noreferrer"'));
  assert.match(nav, /href="\/secteurs\/" aria-current="page"/);
  const home = fs.readFileSync(path.join(__dirname, "..", "content", "index.html"), "utf8");
  for (const id of ["why-title", "journey-title", "catalogue-title", "reviews-title", "faq-title"]) assert.ok(home.includes(`id="${id}"`), id);
  assert.ok(!/gratuit/i.test(home), "gratuité non confirmée");
});
