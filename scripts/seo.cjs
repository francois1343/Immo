/* Metadata, structured data, robots and sitemap of the export.
   Two modes. `preview` (current): every page is noindex,nofollow, robots.txt
   closes the site, the sitemap is empty. `live`: refused until every
   publication check of seo.config.json is true and the global noindex header
   is gone from vercel.json; a page is then indexable only when it is complete
   and editorially approved. */
const fs = require("node:fs"),
  path = require("node:path");
/* Hand-written pages: [public path, description, indexable once live]. */
const routes = {
  "index.html": [
    "/",
    "Martin Snauwaert, agent immobilier agréé IPI à Barbençon : estimation, préparation et vente de votre bien à Beaumont, Thuin, Chimay, Walcourt et environs.",
    true,
  ],
  "estimation/index.html": [
    "/estimation/",
    "Préparez votre premier échange en deux étapes : commune, type de bien et calendrier, puis vos coordonnées pour que Martin vous rappelle.",
    true,
  ],
  "preparer-ma-vente/index.html": [
    "/preparer-ma-vente/",
    "Cinq premières étapes pour préparer votre vente : calendrier, documents, informations, photos et échange avec Martin.",
    true,
  ],
  "secteurs/index.html": [
    "/secteurs/",
    "Les secteurs où Martin Snauwaert est le plus présent : Beaumont, Barbençon et les communes voisines, village par village.",
    true,
  ],
  "mentions-legales.html": [
    "/mentions-legales.html",
    "Mentions légales du site de Martin Snauwaert, agent immobilier agréé IPI, membre du réseau Connexion Immo.",
    false,
  ],
  "politique-confidentialite.html": [
    "/politique-confidentialite.html",
    "Quelles données le formulaire d’estimation transmet à Martin Snauwaert, par quel moyen, et à qui écrire pour toute question à leur sujet.",
    false,
  ],
};
const MODES = ["preview", "live"];
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const hasNoindexHeader = (vercel) =>
  (vercel.headers || []).some(
    (x) =>
      x.source === "/(.*)" &&
      x.headers.some(
        (h) =>
          h.key.toLowerCase() === "x-robots-tag" && h.value.includes("noindex"),
      ),
  );
function validate(config, vercel) {
  const origin = new URL(config.origin);
  if (
    origin.protocol !== "https:" ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  )
    throw Error("Origin HTTPS exacte requise.");
  if (!MODES.includes(config.mode))
    throw Error("Mode inconnu : preview ou live.");
  if (!/^\/assets\/[a-zA-Z0-9_.-]+$/.test(config.socialImage))
    throw Error("Image sociale locale requise.");
  if (config.mode === "preview") {
    if (!hasNoindexHeader(vercel))
      throw Error("En-tête noindex manquant en aperçu.");
    return true;
  }
  /* Going live is one reviewed change: every check confirmed, and the global
     noindex header removed in the same commit. */
  const pending = Object.entries(config.publicationChecks || {})
    .filter(([, ok]) => ok !== true)
    .map(([k]) => k);
  if (!Object.keys(config.publicationChecks || {}).length || pending.length)
    throw Error(
      "Activation de l’indexation refusée, validations manquantes : " +
        (pending.join(", ") || "aucune validation déclarée"),
    );
  if (hasNoindexHeader(vercel))
    throw Error(
      "Mode live : retirer l’en-tête X-Robots-Tag noindex de vercel.json dans le même changement.",
    );
  return true;
}

/* ── Structured data ───────────────────────────────────────────────── */
/* Only verified values of data/professional.json are published. No rating,
   no review, no opening hours: none of them is established. */
function agentLd(config, pro, zones) {
  const P = require("./partials.cjs");
  const v = (k) => {
    const f = P.field(pro, k);
    return f && f.status === "verified" && f.value ? f : null;
  };
  if (!v("name")) return null;
  const ld = {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    "@id": config.origin + "/#agent",
    name: v("name").value,
    url: config.origin + "/",
    image: config.origin + config.socialImage,
  };
  if (v("phone")) ld.telephone = v("phone").href.replace("tel:", "");
  if (v("email")) ld.email = v("email").value;
  const m = v("address") && /^(.+),\s*(\d{4})\s+(.+)$/.exec(v("address").value);
  if (m)
    ld.address = {
      "@type": "PostalAddress",
      streetAddress: m[1],
      postalCode: m[2],
      addressLocality: m[3],
      addressCountry: "BE",
    };
  if (v("company") && v("company").vatId) ld.vatID = v("company").vatId;
  if (v("ipi"))
    ld.identifier = { "@type": "PropertyValue", propertyID: "IPI", value: v("ipi").value };
  if (v("network"))
    ld.memberOf = { "@type": "Organization", name: v("network").value, url: "https://connexionimmo.be/" };
  /* Served places: a commune by name, or its targeted villages when the
     centre is excluded. */
  ld.areaServed = P.activeCommunes(zones).flatMap((c) =>
    c.publicLabel
      ? P.targetedLocalities(c).map((l) => ({ "@type": "Place", name: l.name }))
      : [{ "@type": "AdministrativeArea", name: c.commune }],
  );
  return ld;
}
function breadcrumbLd(config, rows, route) {
  if (!rows || rows.length < 2) return null;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: rows.map(([name, href], i) => ({
      "@type": "ListItem",
      position: i + 1,
      name,
      item: config.origin + (href || route),
    })),
  };
}
/* A dated content. The modification date is given only when the content
   really changed, and no author is named before their role is validated. */
function articleLd(config, page) {
  if (!page.article) return null;
  const ld = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: page.h1,
    description: page.description,
    inLanguage: "fr-BE",
    datePublished: page.article.published,
    mainEntityOfPage: config.origin + page.route,
    publisher: { "@type": "Organization", name: "Martin Snauwaert · Connexion Immo", url: config.origin + "/" },
  };
  if (page.article.modified) ld.dateModified = page.article.modified;
  return ld;
}
const ldTag = (obj) =>
  `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script>`;

/* `page` is a key of `routes`, or { route, description, index, jsonld }. */
function enrich(html, page, config) {
  if (typeof page === "string") {
    if (!routes[page]) throw Error("Route SEO inconnue : " + page);
    const [route, description, index] = routes[page];
    page = { route, description, index };
  }
  const live = config.mode === "live",
    url = config.origin + page.route,
    title = html.match(/<title>\s*([^<]+?)\s*<\/title>/i)?.[1];
  if (!title) throw Error("Titre manquant : " + page.route);
  html = html
    .replace(/<link\b[^>]*rel=["']canonical["'][^>]*>\s*/gi, "")
    .replace(
      /<meta\b[^>]*(?:property=["']og:[^"']+["']|name=["'](?:description|robots|twitter:card)["'])[^>]*>\s*/gi,
      "",
    );
  if (live)
    html = html.replace(/<div class="draft">[\s\S]*?<\/div>\s*/, "");
  const robots = !live ? "noindex,nofollow" : page.index ? "index,follow" : "noindex,follow";
  const tags = [
    ["name", "description", page.description],
    ["name", "robots", robots],
    ["property", "og:type", "website"],
    ["property", "og:locale", "fr_BE"],
    ["property", "og:site_name", "Martin Snauwaert · Connexion Immo"],
    ["property", "og:title", title],
    ["property", "og:description", page.description],
    ["property", "og:url", url],
    ["property", "og:image", config.origin + config.socialImage],
    ["property", "og:image:alt", "Portrait de Martin Snauwaert"],
    ["name", "twitter:card", "summary_large_image"],
  ]
    .map(
      ([key, name, value]) =>
        `<meta ${key}="${name}" content="${escape(value)}">`,
    )
    .join("\n");
  const ld = (page.jsonld || []).filter(Boolean).map(ldTag).join("\n");
  /* The text font is needed for the first paint: fetched early, once. */
  const preload =
    '<link rel="preload" href="/assets/fonts/manrope-latin-variable.woff2" as="font" type="font/woff2" crossorigin>';
  return html.replace(
    "</head>",
    `${preload}\n<link rel="canonical" href="${escape(url)}">\n${tags}\n${ld ? ld + "\n" : ""}</head>`,
  );
}

function readConfig(root) {
  const config = JSON.parse(
      fs.readFileSync(path.join(root, "seo.config.json"), "utf8"),
    ),
    vercel = JSON.parse(
      fs.readFileSync(path.join(root, "vercel.json"), "utf8"),
    );
  validate(config, vercel);
  return config;
}
/* Every page with its metadata: the hand-written ones, then the generated
   ones when `generated` (scripts/pages/index.cjs) is given. */
function entries(config, generated) {
  const P = require("./partials.cjs"),
    { zones, pro } = P.load(),
    agent = agentLd(config, pro, zones);
  const list = Object.entries(routes).map(([file, [route, description, index]]) => ({
    file,
    route,
    description,
    index,
    jsonld: file === "index.html" ? [agent] : [],
  }));
  if (generated) {
    const status = new Map(generated.quality.rows.map((r) => [r.route, r]));
    for (const page of [...generated.pages, ...generated.utility]) {
      const q = status.get(page.route);
      list.push({
        file: generated.fileOf(page),
        route: page.route,
        description: page.description,
        index: Boolean(q && q.approved),
        jsonld: [
          breadcrumbLd(config, page.breadcrumbs, page.route),
          articleLd(config, page),
          page.family === "service" && page.service === "agent" ? agent : null,
        ],
      });
    }
  }
  return list;
}
const sitemap = (config, indexable) =>
  (
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemaps/0.9">' +
    indexable.map((r) => `\n  <url><loc>${escape(config.origin + r)}</loc></url>`).join("") +
    (indexable.length ? "\n" : "") +
    "</urlset>\n"
  ).replace("/schemas/sitemaps/", "/schemas/sitemap/");
const liveRobots = (config) =>
  `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${config.origin}/sitemap.xml\n`;
/* Applies the metadata to pages written as files in `out`. */
function build(root, out, generated) {
  const config = readConfig(root),
    live = config.mode === "live";
  const indexable = [];
  for (const entry of entries(config, generated)) {
    const p = path.join(out, entry.file);
    if (!fs.existsSync(p)) continue;
    fs.writeFileSync(p, enrich(fs.readFileSync(p, "utf8"), entry, config));
    if (entry.index && live) indexable.push(entry.route);
  }
  indexable.sort();
  fs.writeFileSync(path.join(out, "sitemap.xml"), sitemap(config, indexable));
  if (live) fs.writeFileSync(path.join(out, "robots.txt"), liveRobots(config));
  return {
    mode: config.mode,
    canonicalOrigin: config.origin,
    indexablePages: indexable.length,
    indexable,
  };
}
module.exports = { routes, validate, enrich, entries, sitemap, liveRobots, build, readConfig, agentLd, breadcrumbLd, articleLd, hasNoindexHeader };
