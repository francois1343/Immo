const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm");
const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
test("the form page keeps the prepared-mail handoff, and the shared script sends nothing", () => {
  for (const f of [
    "content/estimation/index.html",
  ]) {
    const html = read(f);
    assert.ok(html.includes('id="send-mail"'));
    assert.ok(html.includes('id="message-preview"'));
    assert.ok(!html.includes("/api/submit-lead"));
    assert.ok(!/setTimeout/.test(html));
  }
  assert.ok(!/localStorage|sessionStorage|fetch\(/.test(read("public/site.js")));
});
test("preview is not indexable and exported pages have titles and local assets", () => {
  assert.ok(read("public/robots.txt").includes("Disallow: /"));
  for (const f of [
    "content/index.html",
    "content/estimation/index.html",
    "content/preparer-ma-vente/index.html",

  ]) {
    assert.ok(read(f).includes("noindex,nofollow"));
    assert.ok(read(f).includes("<title>"));
  }
  assert.ok(!read("public/site.css").includes("fonts.googleapis.com"));
});
test("service worker caches navigation by its own path and ignores unlisted requests", async () => {
  const handlers = {},
    writes = [],
    self = { addEventListener: (k, fn) => (handlers[k] = fn) },
    response = { ok: true, type: "basic", clone: () => ({ copy: true }) };
  const caches = {
    open: async () => ({ put: async (k) => writes.push(k) }),
    match: async () => null,
  };
  vm.runInNewContext(read("public/service-worker.js"), {
    self,
    caches,
    location: { origin: "https://immo.example" },
    URL,
    Response,
    fetch: async () => response,
  });
  const waits = [];
  let result;
  handlers.fetch({
    request: { method: "GET", url: "https://immo.example/estimation/" },
    respondWith: (p) => (result = p),
    waitUntil: (p) => waits.push(p),
  });
  await result;
  await Promise.all(waits);
  assert.deepEqual(writes, ["/estimation/"]);
  result = null;
  handlers.fetch({
    request: { method: "GET", url: "https://immo.example/private" },
    respondWith: (p) => (result = p),
  });
  assert.equal(result, null);
});
