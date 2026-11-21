/* HTML of the generated pages. Every local sentence is built from a value of
   data/zones.json or data/local.json; when a value is missing the sentence is
   left out, never replaced by a guess. */
const P = require("../partials.cjs");
const E = require("./emblems.cjs");
const { esc } = P;
const nf = new Intl.NumberFormat("fr-BE");
const TEL = { href: "tel:+32493057184", label: "0493 05 71 84" };
const GEOPORTAL = "https://geoportail.wallonie.be/walonmap";

/* ── Small components ──────────────────────────────────────────────── */
const ext = (href, label) =>
  `<a href="${esc(href)}" rel="noopener noreferrer" target="_blank">${esc(label)} <span aria-hidden="true">↗</span></a>`;
const list = (items, cls = "") =>
  items.length ? `<ul${cls ? ` class="${cls}"` : ""}>\n${items.map((i) => `<li>${i}</li>`).join("\n")}\n</ul>` : "";
const paragraphs = (ps = []) => ps.map((p) => `<p>${esc(p)}</p>`).join("\n");
const steps = (rows) =>
  `<ol class="step-list">\n${rows
    .map(([t, d], i) => `<li><span class="step-n" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span><div><strong>${esc(t)}</strong><p>${esc(d)}</p></div></li>`)
    .join("\n")}\n</ol>`;
const faq = (rows, title = "Questions fréquentes") =>
  rows.length
    ? `<section class="block faq"><h2>${esc(title)}</h2>\n${rows
        .map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${a}</p></details>`)
        .join("\n")}\n</section>`
    : "";
const linkGrid = (links, cls = "") =>
  `<ul class="link-grid${cls ? " " + cls : ""}">\n${links.map(([href, label, sub]) => `<li><a href="${href}"><strong>${esc(label)}</strong>${sub ? `<span>${esc(sub)}</span>` : ""}</a></li>`).join("\n")}\n</ul>`;
const chips = (links) =>
  `<ul class="zone-chips">\n${links.map(([href, label]) => `<li><a href="${href}">${esc(label)}</a></li>`).join("\n")}\n</ul>`;
function sections(rows = []) {
  return rows
    .map(
      (s) => `<section class="block"><h2>${esc(s.h2)}</h2>
${paragraphs(s.p)}
${s.steps ? steps(s.steps) : ""}
${s.list ? list(s.list.map(esc)) : ""}
${s.after ? `<p>${esc(s.after)}</p>` : ""}${s.link ? `
<p class="section-more">${ext(s.link[1], s.link[0])}</p>` : ""}
</section>`,
    )
    .join("\n");
}
/* `mark` is the local emblem of a commune or village page, when a sourced landmark carries one. */
const intro = ({ eyebrow, h1, lead, mark = "" }) => `<section class="page-intro${mark ? " has-mark" : ""}">
<div>
<p class="eyebrow">${esc(eyebrow)}</p>
<h1>${esc(h1)}</h1>
<p class="intro">${esc(lead)}</p>
</div>${mark ? "\n" + mark : ""}
</section>`;
const localMark = (ctx, c, l) => E.mark(E.pick(knowledge(ctx, c).landmarks, l && l.name, P.key));
function cta(title, text, href, label) {
  return `<section class="callout">
<div><h2>${esc(title)}</h2><p class="intro">${esc(text)}</p></div>
<div class="callout-actions"><a class="button" href="${href}">${esc(label)} <span aria-hidden="true">↗</span></a><a class="button ghost" href="${TEL.href}">${TEL.label}</a></div>
</section>`;
}
const estimateLocality = (l) => "/estimation/?commune=" + encodeURIComponent(l.name);

/* ── Sourced local facts ───────────────────────────────────────────── */
const host = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};
class Sources {
  constructor(collectedOn) {
    this.rows = new Map();
    this.collectedOn = collectedOn;
  }
  add(url, label) {
    /* One line per kind of fact and per site, whatever the number of pages read. */
    if (!url || !/^https:\/\//.test(url)) return;
    const seen = [...this.rows].some(([u, l]) => l === label && host(u) === host(url));
    if (!seen) this.rows.set(host(url) === "fr.wikipedia.org" ? "https://fr.wikipedia.org/" + "#" + label : url, label);
  }
  html() {
    if (!this.rows.size) return "";
    const items = [...this.rows].map(([url, label]) => `<li>${esc(label)} : ${ext(url.split("#")[0], host(url) === "fr.wikipedia.org" ? "Wikipédia" : host(url))}</li>`);
    const date = this.collectedOn ? ` Informations relevées le ${esc(frDate(this.collectedOn))}.` : "";
    return `<section class="block sources"><h2>Sources</h2>\n<ul>\n${items.join("\n")}\n</ul>\n<p class="quiet">Ces repères proviennent de sources publiques.${date} Signalez-nous une information devenue inexacte.</p></section>`;
  }
}
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
function frDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!m) return iso || "";
  return `${m[3] === "01" ? "1er" : Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}
/* What is known and sourced about a commune, restricted to targeted
   localities: a station or a landmark of an excluded centre is never shown. */
function knowledge(ctx, c) {
  const L = ctx.data.local.communes[c.id] || {};
  const targeted = new Set(P.targetedLocalities(c).map((l) => P.key(l.name)));
  const inScope = (loc) => (loc ? targeted.has(P.key(loc)) : !c.publicLabel);
  return {
    L,
    stations: (L.stations || []).filter((s) => inScope(s.locality)),
    landmarks: (L.landmarks || []).filter((s) => inScope(s.locality)),
    beaux: (L.beauxVillages || []).filter((n) => targeted.has(P.key(n))),
    locality: (name) => {
      const hit = Object.entries(L.localities || {}).find(([n]) => P.key(n) === P.key(name));
      return hit ? hit[1] || {} : {};
    },
  };
}
function factRows(ctx, c, src) {
  const k = knowledge(ctx, c),
    L = k.L,
    rows = [];
  let facts = 0;
  const codes = c.postalCodes.filter((p) => P.targetedLocalities(c).some((l) => l.postalCode === p));
  rows.push(["Province", esc(c.province) + (L.arrondissement ? ` · arrondissement ${esc(ctx.de(L.arrondissement))}` : "")]);
  rows.push([codes.length > 1 ? "Codes postaux" : "Code postal", codes.join(" · ")]);
  if (L.population && L.population.value) {
    rows.push(["Population de la commune", `${nf.format(L.population.value)} habitants${L.population.date ? ` au ${esc(frDate(L.population.date))}` : ""}`]);
    src.add(L.population.source, "Population");
    facts++;
  }
  if (k.stations.length) {
    rows.push([k.stations.length > 1 ? "Gares SNCB" : "Gare SNCB", k.stations.map((s) => esc(s.name) + (s.line ? ` (ligne ${esc(String(s.line))})` : "")).join(", ")]);
    k.stations.forEach((s) => src.add(s.source, "Gares"));
    facts++;
  }
  if (k.beaux.length) {
    rows.push(["Plus Beaux Villages de Wallonie", k.beaux.map(esc).join(", ")]);
    facts++;
  }
  return { rows, facts, k };
}
const dl = (rows) => `<dl class="facts">\n${rows.map(([t, d]) => `<div><dt>${esc(t)}</dt><dd>${d}</dd></div>`).join("\n")}\n</dl>`;

function adminBlock(ctx, c, src, title) {
  const L = ctx.data.local.communes[c.id] || {};
  if (!L.adminAddress && !L.urbanismeUrl && !L.website) return { html: "", facts: 0 };
  const parts = [];
  if (L.adminAddress) parts.push(`<p><strong>Administration communale ${esc(ctx.de(c.commune))}</strong><br />${esc(L.adminAddress)}</p>`);
  const links = [];
  if (L.urbanismeUrl) links.push(ext(L.urbanismeUrl, "Service d’urbanisme de la commune"));
  if (L.website) links.push(ext(L.website, "Site officiel de la commune"));
  if (links.length) parts.push(`<p class="inline-links">${links.join(" ")}</p>`);
  src.add(L.urbanismeUrl || L.website, "Administration communale");
  return {
    html: `<section class="block"><h2>${esc(title)}</h2>
<p>Les renseignements urbanistiques d’un bien sont délivrés par la commune où il se situe. Ils indiquent notamment l’affectation au plan de secteur et les permis délivrés ; le notaire ou l’agent immobilier les demande en vue du compromis.</p>
<div class="note-card">${parts.join("\n")}</div>
</section>`,
    facts: (L.adminAddress ? 1 : 0) + (L.urbanismeUrl ? 1 : 0),
  };
}
function marketBlock(ctx, c, src, kind = "houses") {
  /* Official prices stay in data/local.json but are shown only once Martin has
     agreed: a commune-wide median must not be read as a personal estimate. */
  if (ctx.data.editorial.showMarketStatistics !== true) return { html: "", facts: 0 };
  const m = (ctx.data.local.communes[c.id] || {}).market;
  if (!m) return { html: "", facts: 0 };
  const rows = [];
  if (kind !== "apartments" && m.housesMedian)
    rows.push(["Maisons · prix médian", `${nf.format(m.housesMedian)} €${m.housesTransactions ? ` · ${nf.format(m.housesTransactions)} ventes` : ""}`]);
  if (kind !== "houses-only" && m.apartmentsMedian)
    rows.push(["Appartements · prix médian", `${nf.format(m.apartmentsMedian)} €${m.apartmentsTransactions ? ` · ${nf.format(m.apartmentsTransactions)} ventes` : ""}`]);
  if (!rows.length) return { html: "", facts: 0 };
  src.add(m.source, "Prix de l’immobilier (Statbel)");
  return {
    html: `<section class="block"><h2>Les chiffres officiels pour la commune ${esc(ctx.de(c.commune))}</h2>
<p>Statbel, l’office belge de statistique, publie les prix des ventes enregistrées par commune${m.period ? ` (${esc(m.period)})` : ""}.</p>
${dl(rows)}
<p class="quiet">Un prix médian sépare les ventes en deux moitiés : il décrit la commune entière, pas votre bien. Seule une visite permet d’estimer une adresse précise.</p>
</section>`,
    facts: rows.length,
  };
}
const presence = (c, l) =>
  l && P.key(l.name) === "barbençon"
    ? "Martin Snauwaert est installé à Barbençon : c’est ici son point d’attache."
    : c.anchor
      ? "Martin Snauwaert est installé à Barbençon, dans l’entité de Beaumont : c’est son secteur d’attache."
      : `Martin Snauwaert est installé à Barbençon (Beaumont), à proximité ${l ? near(l.name) : c.publicLabel ? "de ces villages" : near(c.commune)}, et se déplace chez vous sur rendez-vous.`;
/* « de Thuin », « d’Erquelinnes », « du Roux ». */
const near = (n) => (/^Le /.test(n) ? "du " + n.slice(3) : /^Les /.test(n) ? "des " + n.slice(4) : /^[aeiouyàâéèêëîïôöûü]/i.test(n) ? "d’" + n : "de " + n);

/* ── Service pages ─────────────────────────────────────────────────── */
function serviceHub(ctx, s) {
  const links = ctx.communes.map((c) => [ctx.has(`/${s.slug}/${c.id}/`) ? `/${s.slug}/${c.id}/` : P.communeRoute(c), P.publicName(c), c.province]);
  const others = ctx.data.services.filter((x) => x.id !== s.id).map((x) => [`/${x.slug}/`, x.label]);
  const guides = ctx.data.guides.filter((g) => (g.related || []).includes(s.id)).map((g) => [`/guides/${g.slug}/`, g.short || g.h1]);
  return `${intro({ eyebrow: s.hub.eyebrow, h1: s.hub.h1, lead: s.hub.intro })}
<div class="content wide">
${sections(s.hub.sections)}
<section class="block"><h2>${esc(s.label)} : par commune</h2>
<p>Martin est installé à Barbençon et se déplace dans les communes ci-dessous. Chaque page reprend les villages couverts et les repères utiles.</p>
${linkGrid(links)}
</section>
${faq(s.hub.faq)}
${guides.length ? `<section class="block"><h2>Pour aller plus loin</h2>\n${chips(guides)}\n</section>` : ""}
<section class="block"><h2>Autres prestations</h2>\n${chips(others)}\n</section>
${cta("Parlons de votre bien", "Un premier échange, sans document à préparer.", "/estimation/", "Votre projet")}
</div>`;
}

/* Local angle of a service: each line needs the matching local value. */
function angle(ctx, s, c, l, src) {
  const k = knowledge(ctx, c),
    L = k.L,
    items = [];
  const names = P.targetedLocalities(c).map((x) => x.name);
  const here = l ? "à " + l.name : c.publicLabel ? "dans ces villages" : "à " + c.commune;
  const loc = l ? k.locality(l.name) : null;
  const stations = l ? k.stations.filter((x) => P.key(x.locality || "") === P.key(l.name)) : k.stations;
  let facts = 0;
  const station = () => {
    if (!stations.length) return;
    stations.forEach((x) => src.add(x.source, "Gares"));
    facts++;
    return stations.map((x) => esc(x.name)).join(", ");
  };
  if (loc && loc.note) {
    items.push(`<strong>${esc(l.name)}</strong> : ${esc(loc.note)}.`);
    src.add(loc.source, "Repères du village");
    facts++;
  }
  const urb = L.urbanismeUrl ? ext(L.urbanismeUrl, `service d’urbanisme de la commune ${ctx.de(c.commune)}`) : `service d’urbanisme de la commune ${esc(ctx.de(c.commune))}`;
  if (L.urbanismeUrl) {
    src.add(L.urbanismeUrl, "Administration communale");
    facts++;
  }
  if (s.id === "estimation") {
    if (!l && names.length > 1)
      items.push(`L’adresse précise, parmi les ${names.length} villages couverts (${names.map(esc).join(", ")}). La demande n’est pas la même de l’un à l’autre.`);
    if (l) items.push(`L’adresse précise ${here} : rue, voisinage, accès et environnement immédiat.`);
    const st = station();
    if (st) items.push(`La proximité d’une gare SNCB (${st}), relevée parmi les éléments de situation.`);
    items.push(`La situation urbanistique, vérifiée auprès du ${urb}.`);
    items.push("L’état du bien, ses surfaces, son certificat PEB et les travaux à prévoir, constatés lors de la visite.");
  } else if (s.id === "vendre-maison") {
    items.push(`Les renseignements urbanistiques se demandent au ${urb}.`);
    items.push("Le certificat PEB, le procès-verbal de contrôle électrique et l’extrait conforme de la BDES se préparent avant la mise en vente : ce sont des obligations wallonnes, identiques dans toutes les communes.");
    const st = station();
    if (st) items.push(`La proximité d’une gare SNCB (${st}) peut figurer dans l’annonce lorsqu’elle est exacte pour votre maison.`);
    items.push(`La maison est présentée dans le <a href="${P.CATALOGUE_URL}" rel="noopener noreferrer" target="_blank">catalogue du réseau Connexion Immo <span aria-hidden="true">↗</span></a>.`);
  } else if (s.id === "vendre-terrain") {
    items.push(`L’affectation du terrain au plan de secteur se consulte sur ${ext(GEOPORTAL, "WalOnMap, le géoportail de la Wallonie")}.`);
    items.push(`Les renseignements urbanistiques et le certificat d’urbanisme se demandent au ${urb}.`);
    items.push("La même carte régionale indique l’aléa d’inondation, à vérifier avant d’annoncer un prix.");
    items.push("L’équipement de la parcelle (voirie, eau, électricité, égouttage) et ses limites se vérifient sur place.");
    src.add(GEOPORTAL, "Plan de secteur et aléa d’inondation");
  } else if (s.id === "vendre-appartement") {
    items.push("Les informations de la copropriété se demandent au syndic de l’immeuble avant le compromis.");
    items.push(`Les renseignements urbanistiques se demandent au ${urb}.`);
    const st = station();
    if (st) items.push(`La proximité d’une gare SNCB (${st}) compte pour une partie des acheteurs d’appartements.`);
  } else {
    items.push(esc(presence(c, l)));
    items.push("Agent immobilier agréé IPI n° 513.699, membre du réseau Connexion Immo.");
    if (!l && names.length > 1) items.push(`Villages couverts : ${names.map(esc).join(", ")}.`);
    items.push(`Pour un bien ${here}, la situation urbanistique se vérifie auprès du ${urb}.`);
  }
  return { html: list(items), facts };
}

function localFaq(ctx, s, c, l) {
  const L = ctx.data.local.communes[c.id] || {};
  const place = l ? ctx.placeOfLocality(l) : ctx.placeOfCommune(c);
  const rows = [];
  if (l)
    rows.push([`À quelle commune appartient ${l.name} ?`, esc(`${l.name} fait partie de la commune ${ctx.de(c.commune)} (province ${c.province === "Hainaut" ? "de Hainaut" : "de Namur"}), code postal ${l.postalCode}${l.postalName ? `, libellé postal « ${l.postalName} »` : ""}. Les démarches d’urbanisme se font auprès de cette commune.`)]);
  if (L.adminAddress)
    rows.push([`Où demander les renseignements urbanistiques pour un bien ${place.a} ?`, esc(`À l’administration communale ${ctx.de(c.commune)}, ${L.adminAddress}. En pratique, le notaire ou l’agent immobilier s’en charge.`)]);
  if (!l && P.targetedLocalities(c).length > 1)
    rows.push([c.publicLabel ? `Quels villages de la commune ${ctx.de(c.commune)} sont couverts ?` : `Quels villages sont couverts dans la commune ${ctx.de(c.commune)} ?`, esc(P.targetedLocalities(c).map((x) => x.name).join(", ") + ".")]);
  return rows;
}

function serviceCommune(ctx, s, c) {
  const place = ctx.placeOfCommune(c),
    src = new Sources(ctx.data.local.collectedOn),
    f = (t) => ctx.fill(t, place, c);
  const a = angle(ctx, s, c, null, src);
  const fr = factRows(ctx, c, src);
  src.add((ctx.data.local.communes[c.id] || {}).adminAddressSource, "Administration communale");
  const market = s.id === "estimation" || s.id === "vendre-maison" ? marketBlock(ctx, c, src, "houses-only") : s.id === "vendre-appartement" ? marketBlock(ctx, c, src, "apartments") : { html: "", facts: 0 };
  const near = ctx.neighbours(ctx.data, c).filter((n) => ctx.has(`/${s.slug}/${n.id}/`)).map((n) => [`/${s.slug}/${n.id}/`, P.publicName(n)]);
  const villages = s.localityPages
    ? P.targetedLocalities(c).map((l) => [`/${s.slug}/${c.id}/${P.slug(l.name)}/`, l.name]).filter(([href]) => ctx.has(href))
    : [];
  const others = ctx.data.services.filter((x) => x.id !== s.id).map((x) => [ctx.best(x, c), x.label]);
  const html = `${intro({ eyebrow: f(s.local.eyebrow), h1: f(s.local.h1), lead: f(s.local.lead), mark: localMark(ctx, c) })}
<div class="content wide">
<section class="block"><h2>${esc(f(s.local.angleTitle))}</h2>
${a.html}
</section>
<section class="block"><h2>Repères : ${esc(place.lieu)}</h2>
${dl(fr.rows)}
<p>${s.id === "agent" ? "" : esc(presence(c)) + " "}<a href="${P.communeRoute(c)}">Le secteur ${esc(place.lieu)} en détail</a>.</p>
</section>
${market.html}
<section class="block"><h2>${esc(s.local.summaryTitle)}</h2>
${list(s.local.summary.map(esc), "check-list")}
<p><a href="/${s.slug}/">${esc(s.label)} : la prestation en détail</a>.</p>
</section>
${villages.length ? `<section class="block"><h2>${esc(s.label)} : village par village</h2>\n${chips(villages)}\n</section>` : ""}
${faq(localFaq(ctx, s, c, null))}
${near.length ? `<section class="block"><h2>${esc(s.label)} dans les communes voisines</h2>\n${chips(near)}\n</section>` : ""}
<section class="block"><h2>Autres prestations ${esc(place.a)}</h2>\n${chips(others)}\n</section>
${src.html()}
${cta(f(s.local.cta), "Un premier échange, sans document à préparer.", P.estimateHref(c), "Votre projet")}
</div>`;
  /* The address of the commune administration, given in the questions above,
     is a sourced local fact like the others. */
  const admin = (ctx.data.local.communes[c.id] || {}).adminAddress ? 1 : 0;
  return { html, facts: a.facts + fr.facts + market.facts + admin };
}

function serviceLocality(ctx, s, c, l) {
  const place = ctx.placeOfLocality(l),
    cplace = ctx.placeOfCommune(c),
    src = new Sources(ctx.data.local.collectedOn),
    f = (t) => ctx.fill(t, place, c);
  const a = angle(ctx, s, c, l, src);
  const lf = localityFacts(ctx, c, l, src);
  const siblings = P.targetedLocalities(c)
    .filter((x) => x.name !== l.name)
    .map((x) => [`/${s.slug}/${c.id}/${P.slug(x.name)}/`, x.name])
    .filter(([href]) => ctx.has(href));
  const html = `${intro({ eyebrow: f(s.local.eyebrow), h1: f(s.local.h1), lead: f(s.local.lead), mark: localMark(ctx, c, l) })}
<div class="content wide">
<section class="block"><h2>${esc(f(s.local.angleTitle))}</h2>
${a.html}
</section>
<section class="block"><h2>Repères : ${esc(l.name)}</h2>
${dl(lf.rows)}
<p>${esc(presence(c, l))} <a href="${P.localityRoute(c, l)}">${esc(l.name)} en détail</a>.</p>
</section>
<section class="block"><h2>${esc(s.local.summaryTitle)}</h2>
${list(s.local.summary.map(esc), "check-list")}
<p><a href="/${s.slug}/${c.id}/">${esc(s.label)} ${esc(cplace.a)}</a> · <a href="/${s.slug}/">la prestation en détail</a>.</p>
</section>
${faq(localFaq(ctx, s, c, l))}
${siblings.length ? `<section class="block"><h2>${esc(s.label)} dans les villages voisins</h2>\n${chips(siblings)}\n</section>` : ""}
${src.html()}
${cta(f(s.local.cta), "Un premier échange, sans document à préparer.", estimateLocality(l), "Votre projet")}
</div>`;
  /* Only what is specific to the village counts here. */
  return { html, facts: lf.facts };
}

/* ── Sector pages ──────────────────────────────────────────────────── */
function localityFacts(ctx, c, l, src) {
  const k = knowledge(ctx, c),
    info = k.locality(l.name),
    rows = [];
  let facts = 0;
  rows.push(["Commune", `<a href="${P.communeRoute(c)}">${esc(c.commune === P.publicName(c) ? c.commune : c.commune)}</a> · province ${c.province === "Hainaut" ? "de Hainaut" : "de Namur"}`]);
  rows.push(["Code postal", esc(l.postalCode) + (l.postalName ? ` (libellé postal : ${esc(l.postalName)})` : "")]);
  if (info.formerCommune === true) {
    rows.push(["Statut", `Ancienne commune, aujourd’hui section de la commune ${esc(ctx.de(c.commune))}`]);
    src.add(info.source, "Repères du village");
    facts++;
  } else if (l.kind === "hameau" || info.formerCommune === false) {
    rows.push(["Statut", `Hameau de la commune ${esc(ctx.de(c.commune))}`]);
  }
  if (info.note) {
    rows.push(["À savoir", esc(info.note)]);
    src.add(info.source, "Repères du village");
    facts++;
  }
  const st = k.stations.filter((x) => P.key(x.locality || "") === P.key(l.name));
  if (st.length) {
    rows.push(["Gare SNCB", st.map((s) => esc(s.name) + (s.line ? ` (ligne ${esc(String(s.line))})` : "")).join(", ")]);
    st.forEach((s) => src.add(s.source, "Gares"));
    facts++;
  }
  if (k.beaux.some((n) => P.key(n) === P.key(l.name))) {
    rows.push(["Label", "Membre des Plus Beaux Villages de Wallonie"]);
    src.add("https://www.beauxvillages.be/", "Plus Beaux Villages de Wallonie");
    facts++;
  }
  const lm = k.landmarks.filter((x) => P.key(x.locality || "") === P.key(l.name));
  if (lm.length) {
    rows.push(["Repères", lm.map((x) => esc(x.text)).join(" ; ")]);
    lm.forEach((x) => src.add(x.source, "Repères locaux"));
    facts += lm.length;
  }
  return { rows, facts };
}

function commune(ctx, c) {
  const place = ctx.placeOfCommune(c),
    src = new Sources(ctx.data.local.collectedOn);
  const fr = factRows(ctx, c, src),
    k = fr.k;
  const villages = P.targetedLocalities(c).map((l) => [P.localityRoute(c, l), l.name, l.postalCode]);
  const own = villages.filter(([href]) => href !== P.communeRoute(c));
  k.landmarks.forEach((x) => src.add(x.source, "Repères locaux"));
  const admin = adminBlock(ctx, c, src, `Urbanisme : à qui s’adresser ${place.a}`);
  const market = marketBlock(ctx, c, src);
  const near = ctx.neighbours(ctx.data, c).map((n) => [P.communeRoute(n), P.publicName(n)]);
  const services = ctx.data.services.map((s) => {
    const href = ctx.best(s, c);
    return [href, s.label, href === `/${s.slug}/` ? "La prestation" : place.lieu];
  });
  const lead = c.anchor
    ? "Beaumont est le secteur d’attache de Martin Snauwaert, installé à Barbençon. Voici les villages couverts, les repères utiles à un vendeur et les démarches locales."
    : `${presence(c)} Voici les villages couverts, les repères utiles à un vendeur et les démarches locales.`;
  const html = `${intro({ eyebrow: `Secteur · ${place.lieu}`, h1: `Vendre ou faire estimer un bien ${place.a}`, lead, mark: localMark(ctx, c) })}
<div class="content wide">
<section class="block"><h2>${esc(own.length ? "Les villages couverts" : "Le périmètre couvert")}</h2>
${c.publicLabel ? `<p>Dans la commune ${esc(ctx.de(c.commune))}, Martin intervient dans les villages ci-dessous.</p>` : ""}
${own.length ? linkGrid(own.map(([h, n, cp]) => [h, n, cp]), "compact") : ""}
${dl(fr.rows)}
</section>
${k.landmarks.length ? `<section class="block"><h2>Repères du secteur</h2>\n${list(k.landmarks.map((x) => esc(x.text) + (x.locality ? ` <span class="quiet">(${esc(x.locality)})</span>` : "")))}\n</section>` : ""}
${admin.html}
${market.html}
<section class="block"><h2>Les prestations ${esc(place.a)}</h2>
${linkGrid(services)}
</section>
${faq(localFaq(ctx, { id: "sector" }, c, null))}
${near.length ? `<section class="block"><h2>Communes voisines couvertes</h2>\n${chips(near)}\n</section>` : ""}
${src.html()}
${cta(`Un bien ${place.a} ?`, "Indiquez sa localité et votre calendrier : Martin vous rappelle.", P.estimateHref(c), "Votre projet")}
</div>`;
  return { html, facts: fr.facts + k.landmarks.length + admin.facts + market.facts + (near.length ? 1 : 0) };
}

function locality(ctx, c, l) {
  const place = ctx.placeOfLocality(l),
    cplace = ctx.placeOfCommune(c),
    src = new Sources(ctx.data.local.collectedOn);
  const lf = localityFacts(ctx, c, l, src);
  const admin = adminBlock(ctx, c, src, `Urbanisme : à qui s’adresser pour un bien ${place.a}`);
  const siblings = P.targetedLocalities(c)
    .filter((x) => x.name !== l.name)
    .map((x) => [P.localityRoute(c, x), x.name]);
  const services = ctx.data.services.map((s) => {
    const href = ctx.best(s, c, l);
    return [href, s.label, href === `/${s.slug}/` ? "La prestation" : href.endsWith(`/${P.slug(l.name)}/`) ? l.name : cplace.lieu];
  });
  const html = `${intro({ eyebrow: `${cplace.lieu} · ${l.postalCode}`, h1: `Vendre ou faire estimer un bien ${place.a}`, mark: localMark(ctx, c, l), lead: `${presence(c, l)} Voici les repères utiles pour un bien situé ${place.a}.` })}
<div class="content wide">
<section class="block"><h2>${esc(l.name)} en bref</h2>
${dl(lf.rows)}
</section>
${admin.html}
<section class="block"><h2>Les prestations pour un bien ${esc(place.a)}</h2>
${linkGrid(services)}
</section>
${faq(localFaq(ctx, { id: "sector" }, c, l))}
${siblings.length ? `<section class="block"><h2>Autres localités : ${esc(cplace.lieu)}</h2>\n${chips(siblings)}\n</section>` : ""}
${src.html()}
${cta(`Un bien ${place.a} ?`, "Indiquez votre calendrier : Martin vous rappelle.", estimateLocality(l), "Votre projet")}
</div>`;
  return { html, facts: lf.facts };
}

/* ── Guides ────────────────────────────────────────────────────────── */
function urbanismeTable(ctx) {
  const rows = ctx.communes
    .map((c) => ({ c, L: ctx.data.local.communes[c.id] || {} }))
    .filter(({ L }) => L.adminAddress || L.urbanismeUrl);
  if (!rows.length) return "";
  return `<div class="table-wrap"><table class="data-table">
<thead><tr><th scope="col">Commune</th><th scope="col">Administration communale</th><th scope="col">Service</th></tr></thead>
<tbody>
${rows
  .map(
    ({ c, L }) =>
      `<tr><th scope="row"><a href="${P.communeRoute(c)}">${esc(c.commune)}</a></th><td>${esc(L.adminAddress || "—")}</td><td>${L.urbanismeUrl ? ext(L.urbanismeUrl, "Urbanisme") : L.website ? ext(L.website, "Site communal") : "—"}</td></tr>`,
  )
  .join("\n")}
</tbody></table></div>`;
}
function guide(ctx, g) {
  const src = (g.sources || []).map(([label, url]) => `<li>${ext(url, label)}</li>`);
  const related = ctx.data.services.filter((s) => (g.related || []).includes(s.id)).map((s) => [`/${s.slug}/`, s.label]);
  const others = ctx.data.guides.filter((x) => x.slug !== g.slug).map((x) => [`/guides/${x.slug}/`, x.short || x.h1]);
  const body = (g.sections || [])
    .map(
      (s) => `<section class="block"><h2>${esc(s.h2)}</h2>
${paragraphs(s.p)}
${s.steps ? steps(s.steps) : ""}
${s.list ? list(s.list.map(esc)) : ""}
${s.table === "urbanisme" ? urbanismeTable(ctx) : ""}
${s.after ? `<p>${esc(s.after)}</p>` : ""}
</section>`,
    )
    .join("\n");
  return `${intro({ eyebrow: g.eyebrow || "Guide vendeur", h1: g.h1, lead: g.intro })}
<div class="content wide">
${body}
${faq((g.faq || []).map(([q, a]) => [q, esc(a)]))}
${src.length ? `<section class="block sources"><h2>Sources officielles</h2>\n<ul>\n${src.join("\n")}\n</ul>\n<p class="quiet">Guide d’information générale, mis à jour le ${esc(frDate(g.updatedOn))}. Il ne remplace pas l’avis de votre notaire pour votre situation.</p></section>` : ""}
${related.length ? `<section class="block"><h2>Prestations liées</h2>\n${chips(related)}\n</section>` : ""}
${others.length ? `<section class="block"><h2>Autres guides</h2>\n${chips(others)}\n</section>` : ""}
${cta("Une question sur votre vente ?", "Martin fait le point avec vous, sans engagement de vendre.", "/estimation/", "Votre projet")}
</div>`;
}
function guideIndex(ctx) {
  return `${intro({ eyebrow: "Guides vendeurs", h1: "Guides pour préparer une vente immobilière en Wallonie", lead: "Des réponses pratiques, appuyées sur des sources officielles, aux questions qui reviennent avant une vente." })}
<div class="content wide">
${linkGrid(ctx.data.guides.map((g) => [`/guides/${g.slug}/`, g.short || g.h1, g.teaser || ""]), "guides")}
${cta("Une question sur votre vente ?", "Martin fait le point avec vous, sans engagement de vendre.", "/estimation/", "Votre projet")}
</div>`;
}
module.exports = { serviceHub, serviceCommune, serviceLocality, commune, locality, guide, guideIndex, frDate, esc, faq, linkGrid, chips, intro, cta };
