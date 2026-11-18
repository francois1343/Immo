const fs = require("node:fs"),
  path = require("node:path");
const routes = {
  "index.html": [
    "/",
    "Préparez votre projet immobilier à Beaumont, Barbençon et dans les environs avec Martin Snauwaert.",
  ],
  "estimation/index.html": [
    "/estimation/",
    "Préparez votre premier échange : commune, type de bien et calendrier, puis envoyez votre message depuis votre messagerie.",
  ],
  "Back/estimation.html": [
    "/estimation/",
    "Préparez votre premier échange immobilier avec Martin Snauwaert.",
  ],
  "Back/formulaire.html": [
    "/estimation/",
    "Préparez votre premier échange immobilier avec Martin Snauwaert.",
  ],
  "preparer-ma-vente/index.html": [
    "/preparer-ma-vente/",
    "Cinq premières étapes pour préparer votre vente : calendrier, documents, informations, photos et échange avec Martin.",
  ],
  "vendre-beaumont-barbencon/index.html": [
    "/vendre-beaumont-barbencon/",
    "Un projet de vente à Beaumont ou Barbençon ? Préparez les premières questions et les informations utiles avec Martin.",
  ],
  "secteurs/index.html": [
    "/secteurs/",
    "Les secteurs où Martin Snauwaert est le plus présent : Beaumont, Barbençon et les communes voisines, village par village.",
  ],
  "mentions-legales.html": [
    "/mentions-legales.html",
    "Mentions du site Immo de Martin Snauwaert. Aperçu de travail à compléter avant diffusion commerciale.",
  ],
  "politique-confidentialite.html": [
    "/politique-confidentialite.html",
    "Comment le site prépare votre message sur votre appareil et vous laisse choisir son envoi depuis votre messagerie.",
  ],
};
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
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
  if (config.mode !== "preview")
    throw Error(
      "Activation de l’indexation non autorisée par ce lot. Valider la diffusion et la configuration Vercel ensemble.",
    );
  if (!/^\/assets\/[a-zA-Z0-9_.-]+$/.test(config.socialImage))
    throw Error("Image sociale locale requise.");
  if (
    !vercel.headers.some(
      (x) =>
        x.source === "/(.*)" &&
        x.headers.some(
          (h) =>
            h.key.toLowerCase() === "x-robots-tag" &&
            h.value.includes("noindex"),
        ),
    )
  )
    throw Error("En-tête noindex manquant en aperçu.");
  return true;
}
function enrich(html, file, config) {
  if (!routes[file]) throw Error("Route SEO inconnue : " + file);
  const [route, description] = routes[file],
    url = config.origin + route,
    title = html.match(/<title>([^<]+)<\/title>/i)?.[1];
  if (!title) throw Error("Titre manquant : " + file);
  html = html
    .replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi, "")
    .replace(
      /<meta\b[^>]*(?:property=["']og:[^"']+["']|name=["'](?:description|robots|twitter:card)["'])[^>]*>/gi,
      "",
    );
  const tags = [
    ["name", "description", description],
    ["name", "robots", "noindex,nofollow"],
    ["property", "og:type", "website"],
    ["property", "og:locale", "fr_BE"],
    ["property", "og:site_name", "Martin · Connexion Immo"],
    ["property", "og:title", title],
    ["property", "og:description", description],
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
  return html.replace(
    "</head>",
    `<link rel="canonical" href="${escape(url)}">\n${tags}\n</head>`,
  );
}
function build(root, out) {
  const config = JSON.parse(
      fs.readFileSync(path.join(root, "seo.config.json"), "utf8"),
    ),
    vercel = JSON.parse(
      fs.readFileSync(path.join(root, "vercel.json"), "utf8"),
    );
  validate(config, vercel);
  for (const file of Object.keys(routes)) {
    const p = path.join(out, file);
    fs.writeFileSync(p, enrich(fs.readFileSync(p, "utf8"), file, config));
  }
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n';
  fs.writeFileSync(path.join(out, "sitemap.xml"), xml);
  return {
    mode: config.mode,
    canonicalOrigin: config.origin,
    indexablePages: 0,
  };
}
module.exports = { routes, validate, enrich, build };
