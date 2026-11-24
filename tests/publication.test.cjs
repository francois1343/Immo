/* Progressive publication, rehearsed in a temporary folder: the site goes live
   with phase 1 approved page by page, and nothing else becomes indexable. */
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  Q = require("../scripts/pages/quality.cjs"),
  S = require("../scripts/seo.cjs"),
  G = require("../scripts/pages/index.cjs"),
  C = require("../scripts/pages/catalog.cjs"),
  config = require("../seo.config.json"),
  vercel = require("../vercel.json");

test("live with phase 1 approved: only those pages are indexable and in the sitemap", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "immo-live-")),
    out = path.join(root, "out");
  try {
    fs.mkdirSync(out);
    const checks = Object.fromEntries(Object.keys(config.publicationChecks).map((k) => [k, true]));
    fs.writeFileSync(
      path.join(root, "seo.config.json"),
      JSON.stringify({ ...config, origin: "https://exemple-immo.be", mode: "live", publicationChecks: checks }),
    );
    fs.writeFileSync(
      path.join(root, "vercel.json"),
      JSON.stringify({ ...vercel, headers: vercel.headers.map((h) => ({ ...h, headers: h.headers.filter((x) => x.key !== "X-Robots-Tag") })) }),
    );
    /* Two villages are left undocumented, to rehearse unfinished pages. */
    const data = structuredClone(C.load());
    for (const [commune, village] of [
      ["thuin", "Biercée"],
      ["walcourt", "Fraire"],
    ])
      data.local.communes[commune].localities[village].note = null;
    const generated = G.build(out, { data });
    const phase1 = generated.quality.rows.filter((r) => r.phase === 1).map((r) => r.route),
      weak = generated.quality.rows.filter((r) => r.status !== "complete").map((r) => r.route);
    assert.equal(phase1.length, 42);
    assert.equal(weak.length, 2);
    /* A reviewer approves phase 1, and by mistake two unfinished pages. */
    generated.quality = Q.evaluate(generated.pages, { approvedRoutes: [...phase1, ...weak.slice(0, 2)] });
    const seo = S.build(root, out, generated);

    assert.deepEqual([...seo.indexable].sort(), [...phase1].sort());
    const sitemap = fs.readFileSync(path.join(out, "sitemap.xml"), "utf8");
    assert.equal((sitemap.match(/<loc>/g) || []).length, 42);
    assert.ok(sitemap.includes("https://exemple-immo.be/secteurs/beaumont/"));
    const robotsOf = (route) => {
      const html = fs.readFileSync(path.join(out, route.slice(1), "index.html"), "utf8");
      assert.match(html, new RegExp(`rel="canonical" href="https://exemple-immo.be${route}"`), route);
      assert.ok(!html.includes('class="draft"'), route);
      return html.match(/name="robots" content="([^"]+)"/)[1];
    };
    for (const route of phase1) assert.equal(robotsOf(route), "index,follow", route);
    /* Unfinished pages, approved by mistake or not, stay out. */
    for (const route of weak) {
      assert.equal(robotsOf(route), "noindex,follow", route);
      assert.ok(!sitemap.includes(`https://exemple-immo.be${route}<`), route);
    }
    /* Complete pages of later phases wait for their own approval. */
    for (const r of generated.quality.rows.filter((x) => x.phase > 1)) assert.equal(robotsOf(r.route), "noindex,follow", r.route);
    assert.equal(robotsOf("/plan-du-site/"), "noindex,follow");
    assert.match(fs.readFileSync(path.join(out, "robots.txt"), "utf8"), /Sitemap: https:\/\/exemple-immo\.be\/sitemap\.xml/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("official prices are kept in the data and shown nowhere until agreed", () => {
  const data = C.load();
  assert.notEqual(data.editorial.showMarketStatistics, true);
  assert.ok(data.local.communes.froidchapelle.market.housesMedian > 0);
  const all = C.plan(data).pages.filter((p) => p.family !== "guide" && p.family !== "article").map((p) => p.main).join(" ");
  assert.ok(!/prix médian|\d[\d\s ]{2,}\s?€/.test(Q.text(all)), "un prix est affiché");
  const shown = C.plan({ ...data, editorial: { ...data.editorial, showMarketStatistics: true } }).pages.find((p) => p.route === "/secteurs/thuin/");
  assert.ok(/prix médian/.test(shown.main));
});
