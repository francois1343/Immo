/* Plans the generated pages and reports on them.
   Nothing is kept as an HTML source file: the pages are rendered by Next.js
   and rebuilt from data/*.json at every build. */
const fs = require("node:fs"),
  path = require("node:path");
const P = require("../partials.cjs");
const C = require("./catalog.cjs");
const Q = require("./quality.cjs");
const { esc } = P;

function breadcrumb(rows) {
  return `<nav class="breadcrumb" aria-label="Fil d’Ariane"><ol>${rows
    .map(([label, href]) => (href ? `<li><a href="${href}">${esc(label)}</a></li>` : `<li aria-current="page">${esc(label)}</li>`))
    .join("")}</ol></nav>`;
}
/* Shell shared with the hand-written pages: same head, header, footer, dock. */
function shell(page, rendered) {
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="theme-color" content="#00314a" />
    <title>${esc(page.title)}</title>
    <link rel="icon" href="/assets/favicon-32.png" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="stylesheet" href="/fonts.css" />
    <link rel="stylesheet" href="/site.css" />
    <link rel="stylesheet" href="/pages.css" />
    <link rel="stylesheet" href="/footer.css" />
    <script src="/site.js" defer></script>
  </head>
  <body class="has-dock">
    <a class="skip" href="#main">Aller au contenu</a>
    <div class="draft">
      Aperçu de travail · contenu à valider avant diffusion
    </div>
    <div class="shell">
      ${rendered.topbar}
      <header class="top">
        <a href="/" class="identity"
          ><img src="/assets/logo-connexion.png" width="595" height="285" alt="Connexion Immo" /><span>Martin<br />Snauwaert</span></a
        >
        ${rendered.nav(page.route)}
      </header>
      <main id="main"${page.mainClass ? ` class="${page.mainClass}"` : ""}>
        ${page.breadcrumbs ? breadcrumb(page.breadcrumbs) : ""}
${page.main}
      </main>
      ${rendered.footer}
    </div>
    <nav class="mobile-contact" aria-label="Contact rapide">
      <a class="button secondary" href="tel:+32493057184">Appeler Martin</a
      ><a class="button" href="/estimation/">Mon projet ↗</a>
    </nav>
  </body>
</html>
`;
}

/* HTML site map: every generated page is reachable from it. */
function siteMapPage(data, pages, statics) {
  const group = (title, rows) =>
    rows.length ? `<section class="block"><h2>${esc(title)}</h2>\n<ul class="plain-links">\n${rows.map((p) => `<li><a href="${p.route}">${esc(p.h1)}</a></li>`).join("\n")}\n</ul></section>` : "";
  const by = (f) => pages.filter((p) => p.family === f);
  const perService = data.services
    .map((s) => group(s.label, pages.filter((p) => p.service === s.id && p.family !== "service")))
    .join("\n");
  return {
    route: "/plan-du-site/",
    family: "utility",
    title: "Plan du site | Martin Snauwaert",
    h1: "Plan du site",
    description: "Toutes les pages du site de Martin Snauwaert, agent immobilier agréé IPI : prestations, secteurs, villages et guides vendeurs.",
    breadcrumbs: [["Accueil", "/"], ["Plan du site", null]],
    main: `<section class="page-intro"><p class="eyebrow">Plan du site</p><h1>Plan du site</h1><p class="intro">Toutes les pages, classées par rubrique.</p></section>
<div class="content wide">
${group("Pages principales", statics)}
${group("Prestations", by("service"))}
${group("Secteurs", by("commune"))}
${group("Villages", by("locality"))}
${perService}
${group("Guides", [...by("guide-index"), ...by("guide")])}
</div>`,
    ownFacts: null,
  };
}
const notFound = {
  route: "/404.html",
  file: "404.html",
  family: "utility",
  title: "Page introuvable | Martin Snauwaert",
  h1: "Cette page n’existe pas ou a été déplacée.",
  description: "La page demandée est introuvable. Retrouvez les prestations, les secteurs couverts et le formulaire de contact de Martin Snauwaert.",
  main: `<section class="page-intro"><p class="eyebrow">Erreur 404</p><h1>Cette page n’existe pas ou a été déplacée.</h1><p class="intro">Voici les entrées principales du site.</p>
<div class="actions"><a class="button" href="/">Accueil</a><a class="button secondary" href="/secteurs/">Secteurs couverts</a><a class="button secondary" href="/estimation/">Votre projet</a></div></section>`,
  ownFacts: null,
};

const fileOf = (page) => page.file || page.route.slice(1) + "index.html";

/* Everything the site publishes beyond the hand-written pages, in memory. */
function plan({ statics = [] } = {}) {
  const data = C.load();
  const rendered = P.blocks(data);
  const { pages, setAside } = C.plan(data);
  const quality = Q.evaluate(pages, data.editorial);
  const utility = [siteMapPage(data, pages, statics), notFound];
  return { data, rendered, pages, setAside, utility, quality, fileOf };
}
/* Writes the pages as plain files: used to rehearse a publication in a
   temporary folder. The site itself is rendered by Next.js from `plan`. */
function build(out, options) {
  const planned = plan(options);
  const written = [];
  for (const page of [...planned.pages, ...planned.utility]) {
    const file = fileOf(page),
      dest = path.join(out, file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, shell(page, planned.rendered));
    written.push(file);
  }
  return { ...planned, written };
}
module.exports = { plan, build, shell, fileOf, breadcrumb };
