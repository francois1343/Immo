/* Explicit public export: legacy experiments and working files stay outside.
   Hand-written pages are copied, local pages are generated from data/*.json,
   then every page receives its metadata. Reports go to reports/, never to the
   public export. */
const fs = require("node:fs"),
  path = require("node:path");
const root = path.resolve(__dirname, ".."),
  out = path.join(root, "public-dist"),
  reports = path.join(root, "reports");
const files = [
  "index.html",
  "estimation/index.html",
  "preparer-ma-vente/index.html",
  "secteurs/index.html",
  "Back/estimation.html",
  "Back/formulaire.html",
  "mentions-legales.html",
  "politique-confidentialite.html",
  "site.css",
  "pages.css",
  "site.js",
  "estimation.css",
  "estimation.js",
  "inquiry-core.js",
  "inquiry-config.js",
  "legal.css",
  "footer.css",
  "fonts.css",
  "service-worker.js",
  "manifest.webmanifest",
  "robots.txt",
  "assets/ms.jpg",
  "assets/ms-960.webp",
  "assets/ms-560.webp",
  "assets/barbencon-aerien.jpg",
  "assets/barbencon-aerien-1120.webp",
  "assets/barbencon-aerien-640.webp",
  "assets/logo-connexion.png",
  "assets/favicon-32.png",
  "assets/apple-touch-icon.png",
  "assets/icon-192.png",
  "assets/icon-512.png",
  "assets/icon-maskable-192.png",
  "assets/icon-maskable-512.png",
  ...fs
    .readdirSync(path.join(root, "assets/fonts"))
    .filter((n) => /^[a-zA-Z0-9_.-]+\.(woff2|txt)$/.test(n))
    .map((n) => "assets/fonts/" + n),
];
/* Third-party browser bundle, copied from the installed package at build time. */
const vendor = {
  "vendor/libphonenumber-min.js":
    "node_modules/libphonenumber-js/bundle/libphonenumber-min.js",
};
for (const name of files) {
  const source = path.join(root, name);
  if (fs.lstatSync(source).isSymbolicLink() || !fs.statSync(source).isFile())
    throw Error("Unexpected source: " + name);
}
/* The export is rebuilt from nothing: a page removed from the data cannot
   survive from an earlier build. */
if (fs.existsSync(out)) {
  if (fs.lstatSync(out).isSymbolicLink()) throw Error("Unexpected symlink");
  fs.rmSync(out, { recursive: true, force: true });
}
for (const name of files) {
  const dest = path.join(out, name);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(root, name), dest);
}
for (const [name, from] of Object.entries(vendor)) {
  const dest = path.join(out, name);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(root, from), dest);
}
/* Shared blocks (navigation, footer, sectors, legal details) are rendered from
   data/*.json again here, so the export never depends on a page synced by hand. */
const partials = require("./partials.cjs"),
  rendered = partials.blocks(partials.load());
for (const page of partials.PAGES) {
  const dest = path.join(out, page);
  fs.writeFileSync(dest, partials.apply(fs.readFileSync(dest, "utf8"), rendered, page));
}
const S = require("./seo.cjs");
const h1Of = (file) =>
  (fs.readFileSync(path.join(out, file), "utf8").match(/<title>\s*([^<|]+?)\s*(?:\||<)/) || [])[1] || file;
const statics = Object.entries(S.routes)
  .filter(([file, [route]]) => !file.startsWith("Back/") && route !== "/")
  .map(([file, [route]]) => ({ route, h1: h1Of(file) }));
const generated = require("./pages/index.cjs").build(out, { statics });
const seo = S.build(root, out, generated);

/* ── Controls on the finished export ───────────────────────────────── */
const expected = new Set([...files, ...Object.keys(vendor), "sitemap.xml", ...generated.written]);
const html = [];
for (const entry of fs.readdirSync(out, { recursive: true, withFileTypes: true })) {
  if (entry.isSymbolicLink()) throw Error("Unexpected symlink");
  if (!entry.isFile()) continue;
  const relative = path.relative(out, path.join(entry.parentPath, entry.name)).replaceAll("\\", "/");
  if (!expected.has(relative)) throw Error("Unexpected output: " + relative);
  if (relative.endsWith(".html")) html.push(relative);
}
/* Internal links: each must reach a file of the export; a page nobody links
   to is reported as orphan. */
const routeOfFile = (f) => "/" + f.replace(/index\.html$/, "");
const inbound = new Map(html.map((f) => [routeOfFile(f), 0]));
const broken = [];
const metaErrors = [];
for (const f of html) {
  const source = fs.readFileSync(path.join(out, f), "utf8");
  for (const [tag, count] of [["<h1", 1], ['rel="canonical"', 1], ['name="description"', 1], ['name="robots"', 1], ["<main", 1]])
    if (source.split(tag).length - 1 !== count && !f.endsWith("-legales.html") && !f.endsWith("confidentialite.html"))
      metaErrors.push(`${f} : ${tag} attendu ${count} fois`);
  for (const m of source.matchAll(/<img\b[^>]*>/g))
    if (!/\balt="/.test(m[0]) || !/\bwidth="/.test(m[0])) metaErrors.push(`${f} : image sans alt ou sans dimensions`);
  const base = "https://x" + routeOfFile(f);
  for (const m of source.matchAll(/\bhref="([^"#]+)(?:#[^"]*)?"/g)) {
    const href = m[1].replace(/&amp;/g, "&");
    if (/^(https?:|mailto:|tel:)/.test(href)) continue;
    const pathname = decodeURIComponent(new URL(href, base).pathname);
    const target = pathname.endsWith("/") ? pathname.slice(1) + "index.html" : pathname.slice(1);
    if (!expected.has(target)) broken.push(`${f} → ${href}`);
    else if (routeOfFile(target) !== routeOfFile(f) && target.endsWith(".html"))
      inbound.set(routeOfFile(target), (inbound.get(routeOfFile(target)) || 0) + 1);
  }
}
const orphans = [...inbound]
  .filter(([route, n]) => n === 0 && route !== "/" && route !== "/404.html" && !route.startsWith("/Back/"))
  .map(([route]) => route);

/* ── Reports ───────────────────────────────────────────────────────── */
const rows = generated.quality.rows.map((r) => ({ ...r, inboundLinks: inbound.get(r.route) || 0 }));
const count = (fn) => rows.filter(fn).length;
const families = {};
for (const r of rows) {
  const f = (families[r.family] ||= { routes: 0, complete: 0, approved: 0, toReview: 0 });
  f.routes++;
  if (r.status === "complete") f.complete++;
  else f.toReview++;
  if (r.approved) f.approved++;
}
/* Pages set aside: never written to the export, listed with their parent. */
const aside = generated.setAside;
const phases = {};
for (const r of rows.filter((x) => x.phase)) phases[r.phase] = (phases[r.phase] || 0) + 1;
const summary = {
  builtOn: new Date().toISOString().slice(0, 10),
  mode: seo.mode,
  origin: seo.canonicalOrigin,
  handWrittenPages: Object.keys(S.routes).length,
  candidateRoutes: rows.length + aside.length,
  generatedRoutes: rows.length,
  editoriallyComplete: count((r) => r.status === "complete"),
  editoriallyApproved: count((r) => r.approved),
  allowedForIndexing: seo.indexablePages,
  toReview: count((r) => r.status !== "complete"),
  setAside: {
    consolidated: aside.filter((r) => r.decision === "consolidée").length,
    draft: aside.filter((r) => r.decision === "brouillon").length,
  },
  completeByPhase: phases,
  families,
  errors: generated.quality.errors,
  brokenLinks: broken,
  orphanPages: orphans,
  markupErrors: metaErrors,
};
fs.mkdirSync(reports, { recursive: true });
fs.writeFileSync(path.join(reports, "pages.json"), JSON.stringify({ pages: rows, setAside: aside }, null, 1));
const csv = (v) => `"${String(v).replaceAll('"', '""')}"`;
const line = (cells) => cells.map(csv).join(";");
fs.writeFileSync(
  path.join(reports, "pages.csv"),
  "\uFEFF" +
    ["route;famille;prestation;commune;localite;statut;phase;decision;approuvee;score;mots;reperes_locaux;similarite_pct;page_la_plus_proche;liens_entrants;titre;points_a_traiter"]
      .concat(
        rows.map((r) =>
          line([r.route, r.family, r.service, r.commune, r.locality, r.status, r.phase || "", r.decision, r.approved ? "oui" : "non", r.score, r.words, r.localFacts, r.similarity, r.closest, r.inboundLinks, r.title, r.issues.join(" | ")]),
        ),
        aside.map((r) =>
          line([r.route, r.family, r.service, r.commune, r.locality || "", "non publiée", "", `${r.decision} → ${r.into}`, "non", "", "", "", "", "", "", "", r.reason]),
        ),
      )
      .join("\r\n"),
);
fs.writeFileSync(path.join(reports, "summary.json"), JSON.stringify(summary, null, 1));
/* URLs to notify once the site is live: the complete, approved pages only. */
fs.writeFileSync(path.join(reports, "indexnow-urls.txt"), seo.indexable.map((r) => seo.canonicalOrigin + r).join("\n") + (seo.indexable.length ? "\n" : ""));

const fatal = [...summary.errors, ...broken, ...metaErrors];
console.log(
  JSON.stringify({
    files: files.length,
    output: "public-dist",
    automaticReception: false,
    indexing: seo.mode === "live",
    seo: { mode: seo.mode, canonicalOrigin: seo.canonicalOrigin, indexablePages: seo.indexablePages },
    pages: {
      generatedRoutes: summary.generatedRoutes,
      editoriallyComplete: summary.editoriallyComplete,
      allowedForIndexing: summary.allowedForIndexing,
      toReview: summary.toReview,
      setAside: aside.length,
      orphanPages: orphans.length,
    },
    reports: "reports/",
    errors: fatal.length,
  }),
);
if (fatal.length) {
  console.error(fatal.slice(0, 40).join("\n"));
  process.exit(1);
}
