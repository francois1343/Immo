/* « Actualités & conseils » : dated contents, their cards, the seasonal tip. */
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm"),
  P = require("../scripts/partials.cjs"),
  C = require("../scripts/pages/catalog.cjs"),
  Q = require("../scripts/pages/quality.cjs"),
  S = require("../scripts/seo.cjs"),
  T = require("../scripts/pages/stories.cjs"),
  config = require("../seo.config.json");
const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const data = C.load(),
  { pages } = C.plan(data),
  quality = Q.evaluate(pages, data.editorial);
const page = (route) => pages.find((p) => p.route === route);

test("every news article is dated, sourced on an official site, and names no author yet", () => {
  assert.ok(data.articles.length >= 2);
  for (const a of data.articles) {
    assert.match(a.publishedOn, /^\d{4}-\d{2}-\d{2}$/, a.slug);
    assert.ok(a.publishedOn <= new Date().toISOString().slice(0, 10), a.slug + " : date de publication dans le futur");
    assert.equal(a.updatedOn, null, a.slug + " : pas de date de modification sans changement de fond");
    assert.equal(a.author, null, a.slug);
    assert.ok(a.sources.some(([, url]) => /^https:\/\/(www\.)?wallonie\.be\//.test(url)), a.slug);
    const p = page(T.articleRoute(a));
    assert.ok(p, a.slug);
    assert.ok(p.main.includes(`<time datetime="${a.publishedOn}">`), a.slug);
    assert.ok(p.main.includes("Sources officielles"), a.slug);
    assert.equal((p.main.match(/<time /g) || []).length, 1, a.slug + " : une seule date, celle de la publication");
    /* No promise of an individual aid, no market forecast. */
    assert.ok(!/vous (avez droit|bénéficierez|obtiendrez)|aide garantie|les prix vont/i.test(Q.text(p.main)), a.slug);
  }
  assert.throws(() => T.validate({ articles: [{ ...data.articles[0], sources: [] }] }));
  assert.throws(() => T.validate({ articles: [{ ...data.articles[0], author: "Martin Snauwaert" }] }));
  assert.throws(() => T.validate({ articles: [{ ...data.articles[0], updatedOn: "2020-01-01" }] }));
});

test("the new pages are complete, in phase 1, and approved by nobody", () => {
  const routes = [T.INDEX, ...data.articles.map(T.articleRoute), "/guides/vendre-maison-hiver/"];
  for (const route of routes) {
    const row = quality.rows.find((r) => r.route === route);
    assert.ok(row, route);
    assert.equal(row.status, "complete", route + " : " + row.issues.join(" ; "));
    assert.equal(row.phase, 1, route);
    assert.equal(row.approved, false, route);
  }
  /* A news article does not repeat a permanent guide. */
  const peb = Q.shingles(Q.words(Q.text(page("/guides/certificat-peb-vente/").main))),
    news = Q.shingles(Q.words(Q.text(page("/actualites/nouveau-certificat-peb-wallonie-2026/").main)));
  assert.ok(Q.jaccard(peb, news) < 0.3);
});

test("a dated page is announced as an Article, without author, with a modification date only when it changed", () => {
  const news = page(T.articleRoute(data.articles[0])),
    ld = S.articleLd(config, news);
  assert.equal(ld["@type"], "Article");
  assert.equal(ld.datePublished, data.articles[0].publishedOn);
  assert.ok(!("dateModified" in ld) && !("author" in ld));
  assert.equal(S.articleLd(config, { ...news, article: { published: "2026-11-23", modified: "2027-01-10" } }).dateModified, "2027-01-10");
  assert.equal(S.articleLd(config, page("/guides/certificat-peb-vente/")), null);
  assert.ok(S.articleLd(config, page("/guides/vendre-maison-hiver/")));
});

test("the seasonal tip follows the calendar, links to existing pages and never describes the weather", () => {
  assert.equal(T.seasonOf(new Date(2026, 10, 23)), "automne");
  assert.equal(T.seasonOf(new Date(2026, 11, 1)), "hiver");
  assert.equal(T.seasonOf(new Date(2027, 1, 28)), "hiver");
  assert.equal(T.seasonOf(new Date(2027, 2, 1)), "printemps");
  assert.equal(T.seasonOf(new Date(2027, 5, 1)), "ete");
  assert.equal(T.seasonOf(new Date(2027, 8, 1)), "automne");
  const routes = new Set([...pages.map((p) => p.route), "/", "/estimation/", "/preparer-ma-vente/", "/secteurs/"]);
  for (const id of T.SEASONS) {
    const t = data.seasons.tips[id];
    assert.ok(routes.has(t.href), id + " : " + t.href);
    assert.ok(!T.WEATHER.test(t.title + " " + t.text), id);
  }
  const snow = structuredClone(data.seasons);
  snow.tips.hiver.text = "Il neige à Beaumont : pensez à dégager l’allée.";
  assert.throws(() => T.validate({ seasons: snow }));
  /* One block, four tips, and the build stamps the season of its day. */
  const block = T.seasonBlock(data.seasons);
  assert.equal((block.match(/class="season-tip"/g) || []).length, 4);
  assert.ok(T.stamp(block, new Date(2026, 11, 24)).includes('data-season="hiver"'));
  assert.ok(!T.stamp(block).includes('data-season="auto"'));
  /* The script of the page uses the same months as the build. */
  const run = (month) => {
    const el = { dataset: { season: "auto" } };
    vm.runInNewContext(read("public/site.js"), {
      location: { pathname: "/", hash: "" },
      navigator: {},
      window: { addEventListener() {} },
      document: { querySelector: () => el },
      Date: class {
        getMonth() {
          return month;
        }
      },
    });
    return el.dataset.season;
  };
  for (let m = 0; m < 12; m++) assert.equal(run(m), T.SEASON_OF_MONTH[m], "mois " + m);
});

test("the home page shows the seasonal tip and three stories at most, in sync with the data", () => {
  const home = read("content/index.html"),
    rendered = P.blocks(P.load());
  assert.equal(P.apply(home, rendered, "index.html").replace(/\r\n/g, "\n"), home.replace(/\r\n/g, "\n"));
  assert.ok(home.includes("<!-- gen:season -->") && home.includes("<!-- gen:news -->"));
  const stories = rendered.news.match(/<li class="story">/g) || [];
  assert.ok(stories.length >= 2 && stories.length <= 3);
  const routes = new Set(pages.map((p) => p.route));
  for (const [, href] of rendered.news.matchAll(/<a href="([^"]+)"/g)) assert.ok(routes.has(href), href);
  /* A card is one link, with its category and its date. */
  assert.equal((rendered.news.match(/<a /g) || []).length, stories.length);
  assert.equal((rendered.news.match(/<time datetime="\d{4}-\d{2}-\d{2}">/g) || []).length, stories.length);
  /* No inline style or script: the content security policy stays strict. */
  assert.ok(!/style=|<script|onclick/i.test(rendered.news + rendered.season));
});

test("the editorial lot leaves the reception, reCAPTCHA and IndexNow settings alone", () => {
  const server = require("../server.config.json");
  assert.ok(S.hasNoindexHeader(server));
  assert.equal(config.mode, "preview");
  assert.ok(read("public/robots.txt").includes("Disallow: /"));
});
