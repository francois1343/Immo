/* Builds the site with Next.js and controls what it publishes.
   1. scripts/prepare.cjs: pages (hand-written in content/, local pages from
      data/*.json) with their metadata, sitemap, vendor bundle.
   2. next build: every page rendered as static HTML.
   3. Controls on the rendered pages and on public/, then reports in reports/
      (never published). */
const fs = require("node:fs"),
  path = require("node:path"),
  { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, ".."),
  pub = path.join(root, "public"),
  rendered = path.join(root, ".next", "server", "pages"),
  reports = path.join(root, "reports");
/* Explicit list of the public files: legacy experiments and working files
   stay outside, and an unlisted file in public/ stops the build. */
const files = [
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
    .readdirSync(path.join(pub, "assets/fonts"))
    .filter((n) => /^[a-zA-Z0-9_.-]+\.(woff2|txt)$/.test(n))
    .map((n) => "assets/fonts/" + n),
];
const walk = (dir) =>
  fs.readdirSync(dir, { recursive: true, withFileTypes: true }).flatMap((entry) => {
    if (entry.isSymbolicLink()) throw Error("Unexpected symlink");
    return entry.isFile() ? [path.relative(dir, path.join(entry.parentPath, entry.name)).replaceAll("\\", "/")] : [];
  });

const S = require("./seo.cjs");
const { prepare, generatedPublic } = require("./prepare.cjs");
const { generated, addresses, seo } = prepare();
const publicFiles = new Set([...files, ...generatedPublic]);
for (const name of walk(pub)) if (!publicFiles.has(name)) throw Error("Unexpected public file: " + name);
for (const name of publicFiles) if (!fs.existsSync(path.join(pub, name))) throw Error("Missing public file: " + name);

/* The rendered pages are rebuilt from nothing: a page removed from the data
   cannot survive from an earlier build. */
fs.rmSync(path.join(root, ".next"), { recursive: true, force: true });
const next = spawnSync(process.execPath, [require.resolve("next/dist/bin/next"), "build"], { cwd: root, stdio: "inherit" });
if (next.status !== 0) process.exit(next.status || 1);

/* ── Controls on the finished export ───────────────────────────────── */
/* Published file of an address, and where Next.js wrote its HTML. */
const fileOfAddress = (address) => (address.endsWith("/") ? address.slice(1) + "index.html" : address.slice(1));
const renderedFile = (address) =>
  address === "/" ? "index.html" : address === "/404.html" ? "404.html" : address.replace(/^\/|\/$/g, "") + ".html";
const html = addresses.map(fileOfAddress);
const expected = new Set([...publicFiles, ...html]);
const renderedPath = new Map(addresses.map((address) => [fileOfAddress(address), path.join(rendered, renderedFile(address))]));
/* Next.js must have rendered exactly the prepared pages (500.html is its own
   error page). */
const wanted = new Set(addresses.map(renderedFile));
for (const name of walk(rendered).filter((n) => n.endsWith(".html")))
  if (!wanted.has(name) && name !== "500.html") throw Error("Unexpected page: " + name);
for (const name of wanted) if (!fs.existsSync(path.join(rendered, name))) throw Error("Page not rendered: " + name);
/* Internal links: each must reach a file of the export; a page nobody links
   to is reported as orphan. */
const routeOfFile = (f) => "/" + f.replace(/index\.html$/, "");
const inbound = new Map(html.map((f) => [routeOfFile(f), 0]));
const broken = [];
const metaErrors = [];
for (const f of html) {
  const source = fs.readFileSync(renderedPath.get(f), "utf8");
  /* Static pages only: the strict Content-Security-Policy allows no inline
     script, and nothing of the Next.js client runtime may be shipped. */
  if (/_next\/|__NEXT_DATA__|<script(?![^>]*\b(?:src=|type="application\/ld\+json"))/.test(source))
    metaErrors.push(`${f} : script en ligne ou runtime Next.js dans la page`);
  if (/<body[\s\S]*<link\b/.test(source)) metaErrors.push(`${f} : balise link dans le corps de page`);
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
    output: ".next",
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
