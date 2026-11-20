/* Catalogue of the generated pages.
   Every route comes from data/*.json: zones (validated geography), services,
   guides and local (sourced local facts). Nothing here is written by hand per
   commune, and no page is ever created for an excluded locality. */
const fs = require("node:fs"),
  path = require("node:path");
const P = require("../partials.cjs");
const R = require("./render.cjs");

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
    local: optional("local.json", { communes: {} }),
    editorial: optional("editorial.json", {}),
    reviews: optional("reviews.json", {}),
  };
  validate(data);
  return data;
}
function validate({ zones, services, guides, local }) {
  const slugs = new Set(["secteurs", "guides", "estimation", "preparer-ma-vente", "plan-du-site", "assets", "vendor", "Back"]);
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
function pages(data) {
  const out = [];
  const communes = P.activeCommunes(data.zones);
  const ctx = { data, communes, placeOfCommune, placeOfLocality, fill, neighbours, de };
  const add = (page) => out.push({ ...page, title: fitTitle(page.title), description: fitDescription(page.description) });
  const HOME = ["Accueil", "/"];

  for (const s of data.services) {
    add({
      route: `/${s.slug}/`,
      family: "service",
      service: s.id,
      title: s.hub.title,
      h1: s.hub.h1,
      description: s.hub.description,
      breadcrumbs: [HOME, [s.label, null]],
      main: R.serviceHub(ctx, s),
      ownFacts: null,
    });
  }
  for (const c of communes) {
    const place = placeOfCommune(c);
    const body = R.commune(ctx, c);
    add({
      route: P.communeRoute(c),
      family: "commune",
      commune: c.id,
      title: `Immobilier ${place.a} : estimation et vente | Martin Snauwaert`,
      h1: `Vendre ou faire estimer un bien ${place.a}`,
      description: `Estimation et vente immobilière ${place.a} : villages couverts, repères locaux, service d’urbanisme et démarches, avec Martin Snauwaert, agent immobilier agréé IPI.`,
      breadcrumbs: [HOME, ["Secteurs", "/secteurs/"], [place.lieu, null]],
      main: body.html,
      ownFacts: body.facts,
    });
    for (const l of P.targetedLocalities(c)) {
      if (!P.hasOwnPage(c, l)) continue;
      const lp = placeOfLocality(l);
      const lb = R.locality(ctx, c, l);
      add({
        route: P.localityRoute(c, l),
        family: "locality",
        commune: c.id,
        locality: l.name,
        title: `Immobilier ${lp.a} (${l.postalCode}) : estimation et vente | Martin Snauwaert`,
        h1: `Vendre ou faire estimer un bien ${lp.a}`,
        description: `Un bien ${lp.a} (${l.postalCode}, ${c.commune}) ? Repères du village, démarches auprès de la commune et accompagnement par Martin Snauwaert, agent immobilier agréé IPI.`,
        breadcrumbs: [HOME, ["Secteurs", "/secteurs/"], [place.lieu, P.communeRoute(c)], [l.name, null]],
        main: lb.html,
        ownFacts: lb.facts,
      });
    }
    for (const s of data.services) {
      const sb = R.serviceCommune(ctx, s, c);
      add({
        route: `/${s.slug}/${c.id}/`,
        family: "service-commune",
        service: s.id,
        commune: c.id,
        applies: serviceApplies(data, s, c),
        title: fill(s.local.title, place, c),
        h1: fill(s.local.h1, place, c),
        description: fill(s.local.description, place, c),
        breadcrumbs: [HOME, [s.label, `/${s.slug}/`], [place.lieu, null]],
        main: sb.html,
        ownFacts: sb.facts,
      });
      if (!s.localityPages) continue;
      for (const l of P.targetedLocalities(c)) {
        if (!P.hasOwnPage(c, l)) continue;
        const lp = placeOfLocality(l);
        const slb = R.serviceLocality(ctx, s, c, l);
        add({
          route: `/${s.slug}/${c.id}/${P.slug(l.name)}/`,
          family: "service-locality",
          service: s.id,
          commune: c.id,
          locality: l.name,
          applies: true,
          title: fill(s.local.title, lp, c),
          h1: fill(s.local.h1, lp, c),
          description: fill(s.local.description, lp, c),
          breadcrumbs: [HOME, [s.label, `/${s.slug}/`], [place.lieu, `/${s.slug}/${c.id}/`], [l.name, null]],
          main: slb.html,
          ownFacts: slb.facts,
        });
      }
    }
  }
  if (data.guides.length)
    add({
      route: "/guides/",
      family: "guide-index",
      title: "Guides pour vendre un bien en Wallonie | Martin Snauwaert",
      h1: "Guides pour préparer une vente immobilière en Wallonie",
      description: "Documents obligatoires, étapes de la vente, frais du vendeur, urbanisme : des guides pratiques et sourcés pour préparer une vente immobilière en Wallonie.",
      breadcrumbs: [HOME, ["Guides", null]],
      main: R.guideIndex(ctx),
      ownFacts: null,
    });
  for (const g of data.guides)
    add({
      route: `/guides/${g.slug}/`,
      family: "guide",
      guide: g.slug,
      title: g.title,
      h1: g.h1,
      description: g.description,
      breadcrumbs: [HOME, ["Guides", "/guides/"], [g.short || g.h1, null]],
      main: R.guide(ctx, g),
      ownFacts: null,
    });
  return out;
}
module.exports = { load, validate, pages, placeOfCommune, placeOfLocality, fill, neighbours, serviceApplies, de };
