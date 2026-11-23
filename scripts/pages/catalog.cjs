/* Catalogue of the generated pages.
   Every route comes from data/*.json: zones (validated geography), services,
   guides and local (sourced local facts). Nothing here is written by hand per
   commune, and no page is ever created for an excluded locality. */
const fs = require("node:fs"),
  path = require("node:path");
const P = require("../partials.cjs");
const R = require("./render.cjs");
const Q = require("./quality.cjs");
const T = require("./stories.cjs");

const optional = (name, fallback) => {
  const file = path.join(P.root, "data", name);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : fallback;
};
function load() {
  const { zones, pro } = P.load();
  const data = {
    zones,
    pro,
    services: optional("services.json", { services: [] }).services,
    guides: optional("guides.json", { guides: [] }).guides,
    articles: optional("articles.json", { articles: [] }).articles,
    seasons: optional("seasons.json", null),
    local: optional("local.json", { communes: {} }),
    editorial: optional("editorial.json", {}),
    reviews: optional("reviews.json", {}),
  };
  validate(data);
  return data;
}
function validate({ zones, services, guides, local, articles = [], seasons }) {
  const slugs = new Set(["secteurs", "guides", "actualites", "estimation", "preparer-ma-vente", "plan-du-site", "assets", "vendor", "api"]);
  T.validate({ articles, guides, seasons });
  for (const s of services) {
    if (!/^[a-z]+(-[a-z]+)*$/.test(s.slug) || slugs.has(s.slug))
      throw Error("services.json : slug invalide ou déjà pris : " + s.slug);
    slugs.add(s.slug);
    for (const part of ["hub", "local"])
      for (const k of ["title", "h1", "description"])
        if (!s[part] || !s[part][k]) throw Error(`services.json, ${s.id} : ${part}.${k} manquant`);
  }
  const seen = new Set();
  for (const g of guides) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(g.slug) || seen.has(g.slug))
      throw Error("guides.json : slug invalide ou en double : " + g.slug);
    seen.add(g.slug);
  }
  /* Local facts may only describe a configured commune and a targeted locality. */
  for (const [id, L] of Object.entries(local.communes || {})) {
    const c = zones.communes.find((x) => x.id === id);
    if (!c) throw Error("local.json : commune inconnue : " + id);
    const names = new Set(P.targetedLocalities(c).map((l) => P.key(l.name)));
    for (const name of Object.keys(L.localities || {}))
      if (!names.has(P.key(name)))
        throw Error(`local.json, ${id} : ${name} n’est pas une localité ciblée`);
  }
  return true;
}

/* ── Wording of a place ────────────────────────────────────────────── */
const VOWEL = /^[aeiouyàâéèêëîïôöûü]/i;
const de = (n) => (VOWEL.test(n) ? "d’" + n : "de " + n);
function placeOfCommune(c) {
  if (c.publicLabel) {
    const low = c.publicLabel[0].toLowerCase() + c.publicLabel.slice(1);
    return { lieu: c.publicLabel, a: "dans les " + low, de: "des " + low };
  }
  return { lieu: c.commune, a: "à " + c.commune, de: de(c.commune) };
}
const placeOfLocality = (l) => ({ lieu: l.name, a: "à " + l.name, de: de(l.name) });
const fill = (text, place, c) =>
  String(text)
    .replaceAll("{lieu}", place.lieu)
    .replaceAll("{a}", place.a)
    .replaceAll("{de}", place.de)
    .replaceAll("{commune}", c ? c.commune : "")
    .replaceAll("{deCommune}", c ? de(c.commune) : "");

/* ── Local knowledge ───────────────────────────────────────────────── */
/* Covered communes adjoining `c`, from the sourced list of borders. */
function neighbours(data, c) {
  const L = data.local.communes[c.id];
  const names = new Set(((L && L.borders && L.borders.communes) || []).map(P.key));
  return P.activeCommunes(data.zones).filter((x) => x.id !== c.id && names.has(P.key(x.commune)));
}
const serviceApplies = (data, s, c) => {
  if (s.requires !== "apartments") return true;
  const m = (data.local.communes[c.id] || {}).market;
  return Boolean(m && m.apartmentsMedian);
};

/* ── Routes ────────────────────────────────────────────────────────── */
/* Hand-written pages (content/), which the data may link to. */
const STATIC = ["/", "/estimation/", "/preparer-ma-vente/", "/secteurs/"];
/* Keeps a title and a description within the length a result page shows:
   optional endings are dropped, the meaning is not. */
const fitTitle = (t) => (t.length > 65 ? t.replace(" | Martin Snauwaert", "") : t);
function fitDescription(d) {
  for (const tail of [", agent immobilier agréé IPI", ", avec Martin Snauwaert", " et accompagnement jusqu’à l’acte"]) {
    if (d.length <= 160) break;
    d = d.replace(tail, "");
  }
  return d;
}
/* Builds the list of pages. `held` holds the village pages a first pass found
   too thin: they are set aside, and no page links to them.
   A page is set aside rather than published when its content would only
   repeat a parent page: the reason and the parent are kept for the report. */
function build(data, held) {
  const specs = [],
    setAside = [];
  const communes = P.activeCommunes(data.zones);
  const HOME = ["Accueil", "/"];
  const aside = (row) => setAside.push(row);

  for (const s of data.services)
    specs.push({
      route: `/${s.slug}/`,
      family: "service",
      service: s.id,
      title: s.hub.title,
      h1: s.hub.h1,
      description: s.hub.description,
      breadcrumbs: [HOME, [s.label, null]],
      render: (ctx) => ({ html: R.serviceHub(ctx, s), facts: null }),
    });
  for (const c of communes) {
    const place = placeOfCommune(c);
    specs.push({
      route: P.communeRoute(c),
      family: "commune",
      commune: c.id,
      title: `Immobilier ${place.a} : estimation et vente | Martin Snauwaert`,
      h1: `Vendre ou faire estimer un bien ${place.a}`,
      description: `Estimation et vente immobilière ${place.a} : villages couverts, repères locaux, service d’urbanisme et démarches, avec Martin Snauwaert, agent immobilier agréé IPI.`,
      breadcrumbs: [HOME, ["Secteurs", "/secteurs/"], [place.lieu, null]],
      render: (ctx) => R.commune(ctx, c),
    });
    for (const l of P.targetedLocalities(c)) {
      if (!P.hasOwnPage(c, l)) continue;
      const lp = placeOfLocality(l);
      specs.push({
        route: P.localityRoute(c, l),
        family: "locality",
        commune: c.id,
        locality: l.name,
        title: `Immobilier ${lp.a} (${l.postalCode}) : estimation et vente | Martin Snauwaert`,
        h1: `Vendre ou faire estimer un bien ${lp.a}`,
        description: `Un bien ${lp.a} (${l.postalCode}, ${c.commune}) ? Repères du village, démarches auprès de la commune et accompagnement par Martin Snauwaert, agent immobilier agréé IPI.`,
        breadcrumbs: [HOME, ["Secteurs", "/secteurs/"], [place.lieu, P.communeRoute(c)], [l.name, null]],
        render: (ctx) => R.locality(ctx, c, l),
      });
    }
    for (const s of data.services) {
      const route = `/${s.slug}/${c.id}/`;
      const base = { family: "service-commune", service: s.id, commune: c.id };
      if (s.communePages === "none") aside({ ...base, route, decision: "consolidée", into: P.communeRoute(c), reason: s.consolidation });
      else if (!serviceApplies(data, s, c))
        aside({ ...base, route, decision: "brouillon", into: `/${s.slug}/`, reason: "Statbel ne publie aucun prix d’appartement pour cette commune : prestation non étayée" });
      else
        specs.push({
          ...base,
          route,
          title: fill(s.local.title, place, c),
          h1: fill(s.local.h1, place, c),
          description: fill(s.local.description, place, c),
          breadcrumbs: [HOME, [s.label, `/${s.slug}/`], [place.lieu, null]],
          render: (ctx) => R.serviceCommune(ctx, s, c),
        });
      if (s.communePages === "none") continue;
      for (const l of P.targetedLocalities(c)) {
        if (!P.hasOwnPage(c, l)) continue;
        const lroute = `/${s.slug}/${c.id}/${P.slug(l.name)}/`,
          lbase = { family: "service-locality", service: s.id, commune: c.id, locality: l.name },
          lp = placeOfLocality(l);
        if (!s.localityPages) {
          if (s.villageConsolidation) aside({ ...lbase, route: lroute, decision: "consolidée", into: P.localityRoute(c, l), reason: s.villageConsolidation });
        } else if (held.has(lroute))
          aside({ ...lbase, route: lroute, decision: "brouillon", into: route, reason: "repères propres au village insuffisants : à enrichir avant toute publication" });
        else
          specs.push({
            ...lbase,
            route: lroute,
            title: fill(s.local.title, lp, c),
            h1: fill(s.local.h1, lp, c),
            description: fill(s.local.description, lp, c),
            breadcrumbs: [HOME, [s.label, `/${s.slug}/`], [place.lieu, route], [l.name, null]],
            render: (ctx) => R.serviceLocality(ctx, s, c, l),
          });
      }
    }
  }
  if (data.guides.length)
    specs.push({
      route: "/guides/",
      family: "guide-index",
      title: "Guides pour vendre un bien en Wallonie | Martin Snauwaert",
      h1: "Guides pour préparer une vente immobilière en Wallonie",
      description: "Documents obligatoires, étapes de la vente, frais du vendeur, urbanisme : des guides pratiques et sourcés pour préparer une vente immobilière en Wallonie.",
      breadcrumbs: [HOME, ["Guides", null]],
      render: (ctx) => ({ html: R.guideIndex(ctx), facts: null }),
    });
  for (const g of data.guides)
    specs.push({
      route: `/guides/${g.slug}/`,
      family: "guide",
      guide: g.slug,
      title: g.title,
      h1: g.h1,
      description: g.description,
      breadcrumbs: [HOME, ["Guides", "/guides/"], [g.short || g.h1, null]],
      /* A guide with a publication date is announced as an article. */
      article: g.publishedOn ? { published: g.publishedOn, modified: g.updatedOn > g.publishedOn ? g.updatedOn : null } : null,
      render: (ctx) => ({ html: R.guide(ctx, g), facts: null }),
    });
  /* « Actualités & conseils » : dated news, and the index of every dated content. */
  const articles = data.articles || [];
  if (articles.length)
    specs.push({
      route: T.INDEX,
      family: "article-index",
      title: "Actualités immobilières et conseils de saison | Martin Snauwaert",
      h1: "Actualités immobilières et conseils de saison en Wallonie",
      description: "Ce qui change pour les propriétaires en Wallonie, et des conseils pratiques au fil des saisons : des contenus datés, appuyés sur des sources officielles.",
      breadcrumbs: [HOME, ["Actualités & conseils", null]],
      render: (ctx) => ({ html: R.articleIndex(ctx), facts: null }),
    });
  for (const a of articles)
    specs.push({
      route: T.articleRoute(a),
      family: "article",
      articleSlug: a.slug,
      title: a.title,
      h1: a.h1,
      description: a.description,
      breadcrumbs: [HOME, ["Actualités & conseils", T.INDEX], [a.short || a.h1, null]],
      article: { published: a.publishedOn, modified: a.updatedOn || null },
      render: (ctx) => ({ html: R.article(ctx, a), facts: null }),
    });

  /* A link only ever points to a page of this build. */
  const routes = new Set(specs.map((x) => x.route));
  const has = (route) => routes.has(route);
  const best = (s, c, l) =>
    [l && `/${s.slug}/${c.id}/${P.slug(l.name)}/`, `/${s.slug}/${c.id}/`, `/${s.slug}/`].find((r) => r && has(r));
  /* An internal link written in the data: a page of this build or a hand-written page. */
  const internal = (href) => {
    if (!has(href) && !STATIC.includes(href)) throw Error("Lien interne vers une page absente : " + href);
    return href;
  };
  if (data.seasons) Object.values(data.seasons.tips).forEach((t) => internal(t.href));
  const ctx = { data, communes, placeOfCommune, placeOfLocality, fill, neighbours, de, has, best, internal };
  const pages = specs.map(({ render, ...page }) => {
    const body = render(ctx);
    return { ...page, title: fitTitle(page.title), description: fitDescription(page.description), main: body.html, ownFacts: body.facts };
  });
  return { pages, setAside };
}
/* Two passes: the first measures every candidate village page, the second
   leaves out those that did not reach the quality gate. */
function plan(data) {
  const first = build(data, new Set());
  const held = new Set(
    Q.evaluate(first.pages, {})
      .rows.filter((r) => r.family === "service-locality" && r.status !== "complete")
      .map((r) => r.route),
  );
  return build(data, held);
}
const pages = (data) => plan(data).pages;
module.exports = { load, validate, plan, pages, placeOfCommune, placeOfLocality, fill, neighbours, serviceApplies, de };
