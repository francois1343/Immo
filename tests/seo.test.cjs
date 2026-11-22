const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  S = require("../scripts/seo.cjs"),
  config = require("../seo.config.json"),
  vercel = require("../vercel.json");
test("release stays preview and cannot silently enable indexing", () => {
  assert.equal(S.validate(config, vercel), true);
  assert.throws(() => S.validate({ ...config, mode: "public" }, vercel));
  assert.throws(() => S.validate(config, { headers: [] }));
  assert.throws(() =>
    S.validate({ ...config, origin: "https://u:p@example.com" }, vercel),
  );
});
test("canonical aliases and absolute sharing metadata are deterministic", () => {
  const html =
    '<head><title>Estimation</title><meta name="robots" content="index"><meta name="description" content="old"></head>';
  const result = S.enrich(html, "estimation/index.html", config);
  assert.match(
    result,
    /rel="canonical" href="https:\/\/martin-immo.vercel.app\/estimation\/"/,
  );
  assert.equal((result.match(/name="robots"/g) || []).length, 1);
  assert.match(result, /noindex,nofollow/);
  assert.match(result, /og:image/);
  assert.equal((result.match(/name="description"/g) || []).length, 1);
  assert.throws(() => S.enrich(html, "unknown.html", config));
});
