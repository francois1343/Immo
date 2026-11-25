const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  S = require("../scripts/seo.cjs"),
  config = require("../seo.config.json"),
  server = require("../server.config.json");
/* A preview of the same site: closed by its mode and by the noindex header. */
const preview = { ...config, mode: "preview" },
  closed = { ...server, headers: server.headers.map((h, i) => (i ? h : { ...h, headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }, ...h.headers] })) };
test("the release is live and open, and a preview can never be served without its noindex header", () => {
  assert.equal(config.mode, "live");
  assert.equal(config.origin, "https://immobiliermartin.be");
  assert.equal(S.validate(config, server), true);
  assert.ok(!S.hasNoindexHeader(server));
  assert.equal(S.validate(preview, closed), true);
  assert.throws(() => S.validate(preview, server));
  assert.throws(() => S.validate(config, closed));
  assert.throws(() => S.validate({ ...config, mode: "public" }, server));
  assert.throws(() =>
    S.validate({ ...config, origin: "https://u:p@example.com" }, server),
  );
});
test("canonical aliases and absolute sharing metadata are deterministic", () => {
  const html =
    '<head><title>Estimation</title><meta name="robots" content="index"><meta name="description" content="old"></head>';
  const result = S.enrich(html, "estimation/index.html", config);
  assert.match(
    result,
    /rel="canonical" href="https:\/\/immobiliermartin.be\/estimation\/"/,
  );
  assert.equal((result.match(/name="robots"/g) || []).length, 1);
  assert.match(result, /content="index,follow"/);
  assert.match(S.enrich(html, "estimation/index.html", preview), /noindex,nofollow/);
  assert.match(S.enrich(html, "mentions-legales.html", config), /content="noindex,follow"/);
  assert.match(result, /og:image/);
  assert.equal((result.match(/name="description"/g) || []).length, 1);
  assert.throws(() => S.enrich(html, "unknown.html", config));
});
test("every page carries one structured-data graph: site, page, and the questions it shows", () => {
  const html =
    '<head><title>Estimation</title></head><body><main><details><summary>Une question ?</summary><p>Une <a href="/x/">réponse</a> &amp; rien d’autre.</p></details></main></body>';
  const result = S.enrich(html, "estimation/index.html", config);
  const scripts = [...result.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1);
  const graph = JSON.parse(scripts[0][1])["@graph"];
  assert.deepEqual(graph.map((n) => n["@type"]), ["WebSite", "ContactPage", "FAQPage"]);
  assert.equal(graph[1].url, config.origin + "/estimation/");
  assert.equal(graph[2].mainEntity[0].acceptedAnswer.text, "Une réponse & rien d’autre.");
  /* A page without question announces none. */
  assert.equal(S.faqLd("<main><p>Texte</p></main>", "https://x/"), null);
  /* The sitemap dates a page only when a real date is known. */
  const map = S.sitemap(config, ["/a/", "/b/"], { "/b/": "2026-11-23" });
  assert.ok(map.includes("/a/</loc></url>") && map.includes("/b/</loc><lastmod>2026-11-23</lastmod>"));
});
