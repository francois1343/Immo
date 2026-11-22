/* Shared blocks rendered from data/zones.json and data/professional.json.
   A page holds a block between <!-- gen:NAME --> and <!-- /gen:NAME -->.
   `npm run sync` rewrites the blocks in the source pages, the build applies
   them again to the export, and a test fails when a page has drifted. */
const fs = require("node:fs"),
  path = require("node:path");
const root = path.resolve(__dirname, "..");
/* Hand-written pages live in content/; Next.js renders them at build time. */
const content = path.join(root, "content");
const PAGES = [
  "index.html",
  "estimation/index.html",
  "preparer-ma-vente/index.html",
  "secteurs/index.html",
  "mentions-legales.html",
  "politique-confidentialite.html",
];
const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
const readJson = (name) =>
  JSON.parse(fs.readFileSync(path.join(root, "data", name), "utf8"));
const key = (s) => String(s).normalize("NFC").toLocaleLowerCase("fr");
const CATALOGUE_URL = "https://connexionimmo.be/fr/nos-biens/";

/* ── Zones ─────────────────────────────────────────────────────────── */
function validateZones(zones) {
  const ids = new Set();
  for (const c of zones.communes) {
    const fail = (m) => {
      throw Error(`zones.json, ${c.id || c.commune} : ${m}`);
    };
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(c.id || "")) fail("identifiant invalide");
    if (ids.has(c.id)) fail("identifiant en double");
    ids.add(c.id);
    if (typeof c.active !== "boolean") fail("active doit être true ou false");
    if (![1, 2, 3].includes(c.priority)) fail("priority doit valoir 1, 2 ou 3");
    if (!Array.isArray(c.postalCodes) || !c.postalCodes.every((p) => /^\d{4}$/.test(p)))
      fail("codes postaux invalides");
    const targeted = new Set();
    for (const l of c.localities) {
      if (!l.name || !c.postalCodes.includes(l.postalCode))
        fail(`code postal de ${l.name} absent de la commune`);
      if (targeted.has(key(l.name))) fail(`${l.name} en double`);
      targeted.add(key(l.name));
    }
    /* An exclusion is a locality, never a postal code: a village sharing the
       code of an excluded centre stays targeted. */
    for (const x of c.exclusions) {
      if (!x.name) fail("localité exclue sans nom");
      if (targeted.has(key(x.name)))
        fail(`${x.name} est à la fois listée et exclue`);
    }
    const centreExcluded = c.exclusions.some((x) => key(x.name) === key(c.commune));
    if (centreExcluded && !c.publicLabel)
      fail("publicLabel requis : le nom de la commune désigne un centre exclu");
  }
  return true;
}
const activeCommunes = (zones) =>
  zones.communes
    .filter((c) => c.active)
    .map((c, i) => ({ c, i }))
    .sort((a, b) => a.c.priority - b.c.priority || a.i - b.i)
    .map(({ c }) => c);
const targetedLocalities = (c) => c.localities.filter((l) => l.active !== false);
const publicName = (c) => c.publicLabel || c.commune;
/* Every locality a campaign or a page may name. Excluded and unlisted
   localities are never part of it. */
const targets = (zones) =>
  activeCommunes(zones).flatMap((c) =>
    targetedLocalities(c).map((l) => ({
      communeId: c.id,
      commune: c.commune,
      locality: l.name,
      postalCode: l.postalCode,
      priority: c.priority,
    })),
  );
/* Names that must not appear in public or commercial material. */
const excludedNames = (zones) =>
  zones.communes.flatMap((c) => c.exclusions.map((x) => x.name));
/* URL segment of a locality: lower case, no accent, hyphens only. */
const slug = (s) =>
  String(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const communeRoute = (c) => `/secteurs/${c.id}/`;
/* A locality bearing the name of its commune is covered by the commune page. */
const hasOwnPage = (c, l) => key(l.name) !== key(c.commune);
const localityRoute = (c, l) =>
  hasOwnPage(c, l) ? `/secteurs/${c.id}/${slug(l.name)}/` : communeRoute(c);
const estimateHref = (c) =>
  c.publicLabel
    ? "/estimation/"
    : "/estimation/?commune=" + encodeURIComponent(c.commune);

function zonesCompact(zones) {
  const list = activeCommunes(zones);
  const items = list
    .map(
      (c) =>
        `<li><a href="${communeRoute(c)}"${c.anchor ? ' class="zone-anchor"' : ""}>${esc(publicName(c))}</a></li>`,
    )
    .join("\n            ");
  return `<ul class="zone-chips">
            ${items}
          </ul>`;
}
function zonesDetail(zones) {
  return activeCommunes(zones)
    .map((c) => {
      const codes = c.postalCodes
        .filter((p) => targetedLocalities(c).some((l) => l.postalCode === p))
        .join(" · ");
      const names = targetedLocalities(c)
        .map((l) => `<a href="${localityRoute(c, l)}">${esc(l.name)}</a>`)
        .join(", ");
      return `<article class="zone" id="${c.id}">
            <h2>${esc(publicName(c))}</h2>
            <p class="zone-codes">${c.anchor ? "Ancrage local · " : ""}${esc(c.province)} · ${codes}</p>
            <p class="zone-places">${names}</p>
            <p class="zone-links"><a href="${communeRoute(c)}">Le secteur en détail ↗</a>
            <a href="${estimateHref(c)}">Parler d’un bien dans ce secteur ↗</a></p>
          </article>`;
    })
    .join("\n          ");
}
function communeOptions(zones) {
  const banned = new Set(excludedNames(zones).map(key));
  const names = new Map();
  for (const c of activeCommunes(zones)) {
    if (!banned.has(key(c.commune))) names.set(key(c.commune), c.commune);
    for (const l of targetedLocalities(c)) names.set(key(l.name), l.name);
  }
  return [...names.values()]
    .sort((a, b) => a.localeCompare(b, "fr"))
    .map((n) => `<option value="${esc(n)}"></option>`)
    .join("");
}

/* ── Professional details ──────────────────────────────────────────── */
const STATUSES = ["verified", "to-confirm"];
function validatePro(pro) {
  const seen = new Set();
  for (const f of pro.fields) {
    if (!f.key || seen.has(f.key)) throw Error("professional.json : clé manquante ou en double");
    seen.add(f.key);
    if (!STATUSES.includes(f.status))
      throw Error(`professional.json, ${f.key} : statut inconnu`);
    if (f.status === "verified" && !f.value)
      throw Error(`professional.json, ${f.key} : une valeur vérifiée ne peut pas être vide`);
    if (f.footer && f.status !== "verified")
      throw Error(`professional.json, ${f.key} : seule une valeur vérifiée va dans le pied de page`);
  }
  return true;
}
const field = (pro, k) => pro.fields.find((f) => f.key === k);
/* The footer only ever shows a value that is verified and switched on. */
const shown = (pro, k) => {
  const f = field(pro, k);
  return f && f.footer && f.status === "verified" && f.value ? f : null;
};
const linked = (f, text = f.value) =>
  f.href ? `<a href="${esc(f.href)}">${esc(text)}</a>` : esc(text);

/* Social profiles: a small icon button each, named for screen readers. */
const SOCIAL = {
  facebook: {
    host: "www.facebook.com",
    icon: "M13.6 21v-7.6h2.5l.4-3h-2.900V8.500c0-.9.300-1.400 1.500-1.400h1.500V4.400c-.3 0-1.200-.1-2.200-.1-2.200 0-3.700 1.300-3.700 3.800v2.300H8.100v3h2.600V21Z",
  },
  linkedin: {
    host: "www.linkedin.com",
    icon: "M6.900 9H4.100v11h2.800ZM5.500 4.100a1.650 1.650 0 1 0 0 3.300 1.650 1.650 0 0 0 0-3.300ZM20 13.700c0-3.100-1.600-4.900-4.100-4.900-1.400 0-2.400.700-2.900 1.500V9h-2.800v11H13v-5.900c0-1.500.800-2.400 2-2.400s1.900.800 1.900 2.400V20H20Z",
  },
};
function validateSocial(pro) {
  for (const s of pro.social || []) {
    const known = SOCIAL[s.network];
    if (!known || !s.label) throw Error("professional.json, social : réseau inconnu ou sans libellé");
    const url = new URL(s.href);
    if (url.protocol !== "https:" || url.hostname !== known.host)
      throw Error(`professional.json, social : adresse ${s.network} inattendue`);
  }
  return true;
}
const ownerName = (pro) => (field(pro, "name") || {}).value || "Martin Snauwaert";
/* `labelled` adds the name of the network next to its icon. */
function socialLinks(pro, className, labelled) {
  return (pro.social || []).map(
    (s) =>
      `<a class="${className}" href="${esc(s.href)}" rel="noopener noreferrer" target="_blank" aria-label="${esc(`${s.label} de ${ownerName(pro)} (nouvel onglet)`)}" title="${esc(s.label)}"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="${SOCIAL[s.network].icon}" /></svg>${labelled ? `<span>${esc(s.label)}</span>` : ""}</a>`,
  );
}
function social(pro) {
  const links = socialLinks(pro, "site-footer-social-link", true);
  if (!links.length) return "";
  return `
        <p class="site-footer-social">
          <span class="site-footer-social-title">Suivre Martin</span>
          ${links.join("\n          ")}
        </p>`;
}
/* Contact bar above the header: approval, phone, e-mail and social profiles.
   Verified values only, like the footer. */
function topbar(pro) {
  const v = (k) => {
    const f = field(pro, k);
    return f && f.status === "verified" && f.value ? f : null;
  };
  const contact = [v("phone"), v("email")].filter(Boolean).map((f) => `<a class="topbar-${f.key}" href="${esc(f.href)}">${esc(f.value)}</a>`);
  const links = socialLinks(pro, "topbar-social-link", false);
  return `<div class="topbar">
        ${v("title") ? `<p class="topbar-title">${esc(v("title").value)}</p>` : ""}
        <p class="topbar-contact">
          ${[...contact, ...links].join("\n          ")}
        </p>
      </div>`;
}
function footer(pro) {
  const f = (k) => shown(pro, k);
  const id = [
    f("name") && `<strong>${esc(f("name").value)}</strong>`,
    f("title") && `<span>${esc(f("title").footerText || f("title").value)}</span>`,
    f("network") && `<span>${esc(f("network").value)}</span>`,
  ].filter(Boolean);
  const facts = ["address", "phone", "email", "company", "insurance", "thirdPartyAccount", "authority"]
    .map((k) => f(k))
    .filter(Boolean)
    .map((x) => {
      const text = x.footerText || x.value;
      return `<li>${x.footerLabel ? `<span>${esc(x.footerLabel)} :</span> ` : ""}${linked(x, text)}</li>`;
    });
  return `<footer class="site-footer">
        <p class="site-footer-id">${id.join(" ")}</p>
        <ul class="site-footer-facts">
          ${facts.join("\n          ")}
        </ul>
        <nav class="site-footer-links" aria-label="Informations légales et liens utiles">
          <a href="/mentions-legales.html">Mentions légales</a>
          <a href="/politique-confidentialite.html">Vos données</a>
          <a href="/secteurs/">Secteurs couverts</a>
          <a href="/guides/">Guides vendeurs</a>
          <a href="/plan-du-site/">Plan du site</a>
          <a href="${CATALOGUE_URL}" rel="noopener noreferrer" target="_blank">Nos biens ↗</a>
          <a href="https://connexionimmo.be/fr/notre-equipe/" rel="noopener noreferrer" target="_blank">Le réseau Connexion Immo ↗</a>
        </nav>${social(pro)}
      </footer>`;
}
/* Full list of the legal page: every value on file, verified or not, so the
   detailed page and the footer are corrected in one place. */
function legalDetails(pro) {
  return pro.fields
    .filter((x) => x.legalLabel && x.value && x.legal !== false)
    .map(
      (x) => `<li${x.legalWide ? ' class="legal-detail-wide"' : ""}>
            <span>${esc(x.legalLabel)}</span>
            ${x.href ? linked(x) : `<strong>${esc(x.legalText || x.value)}</strong>`}${x.legalNote ? `
            <small>${esc(x.legalNote)}</small>` : ""}
          </li>`,
    )
    .join("\n          ");
}
function legalMissing(pro) {
  const missing = pro.fields.filter((x) => x.legalLabel && !x.value && x.legal !== false).map((x) => x.missingText || x.legalLabel);
  return missing.length
    ? `<p class="legal-missing-info">
          <strong>Informations à compléter :</strong> ${esc(missing.join(" ; "))}.
        </p>`
    : "";
}

/* Hosting paragraph of the legal page: shown only once verified. */
function legalHost(pro) {
  const h = field(pro, "host");
  if (!h || h.status !== "verified" || !h.value)
    return "<p>Hébergeur en cours de confirmation.</p>";
  const site = h.website
    ? `<br />
          <a href="${esc(h.website)}" rel="noopener noreferrer" target="_blank">${esc(h.website.replace(/^https?:\/\//, ""))}</a>`
    : "";
  return `<p>
          ${esc(h.value)}<br />
          ${esc(h.address || "")}${site}
        </p>`;
}

/* ── Client reviews ────────────────────────────────────────────────── */
/* Nothing is copied from Google. A rating appears only with the date it was
   read on the listing; a quote only with its author's consent. Without them
   the block is a plain link to the verified listing. */
function validateReviews(r) {
  if (!/^https:\/\/(share\.google|g\.page|maps\.app\.goo\.gl|www\.google\.com|search\.google\.com)\//.test(r.googleUrl || ""))
    throw Error("reviews.json : lien Google attendu");
  const rated = r.rating != null || r.count != null;
  if (rated && !(r.rating >= 1 && r.rating <= 5 && Number.isInteger(r.count) && r.count > 0 && /^\d{4}-\d{2}-\d{2}$/.test(r.ratingCheckedOn || "")))
    throw Error("reviews.json : note, nombre d’avis et date du relevé vont ensemble");
  for (const q of r.quotes || [])
    if (!q.text || !q.author || q.consent !== true)
      throw Error("reviews.json : une citation exige texte, auteur et accord (consent: true)");
  return true;
}
function reviews(r) {
  validateReviews(r);
  const rated = r.rating != null;
  const score = rated
    ? ` <span class="reviews-score"><strong>${String(r.rating).replace(".", ",")}/5</strong> · ${r.count} avis Google, relevé le ${esc(r.ratingCheckedOn.split("-").reverse().join("/"))}.</span>`
    : "";
  const quotes = (r.quotes || [])
    .map(
      (q) => `<figure class="review-card">
              <blockquote><p>${esc(q.text)}</p></blockquote>
              <figcaption>${esc(q.author)}${q.date ? ` · ${esc(q.date)}` : ""}</figcaption>
            </figure>`,
    )
    .join("\n            ");
  return `<div class="band">
            <svg class="picto" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v11H10l-4.5 3.5v-3.5H4Z" /><path d="M8 9.5h8M8 12.500h5" /></svg>
            <div>
              <h2 id="reviews-title">Ce que disent ses clients</h2>
              <p>${quotes ? "Avis laissés sur la fiche Google de Martin, repris avec l’accord de leurs auteurs." : "Les avis des clients de Martin sont publiés sur sa fiche Google : datés, signés et vérifiables."}${score}</p>
            </div>
            <a class="button secondary" href="${esc(r.googleUrl)}" rel="noopener noreferrer" target="_blank">Voir nos avis <span aria-hidden="true">↗</span><span class="visually-hidden"> sur Google (nouvel onglet)</span></a>
          </div>${quotes ? `\n          <div class="review-cards">\n            ${quotes}\n          </div>` : ""}`;
}

/* ── Main navigation ───────────────────────────────────────────────── */
const NAV = [
  ["/estimation-immobiliere/", "Estimation"],
  ["/preparer-ma-vente/", 'Préparer<span class="nav-long">&nbsp;ma vente</span>'],
  ["/secteurs/", "Secteurs"],
  ["/guides/", "Guides"],
];
/* `route` is the public path of the page: the entry whose path contains it is
   marked as current. */
function nav(route = "") {
  const current = (href) => (route.startsWith(href) ? ' aria-current="page"' : "");
  const links = NAV.map(([href, label]) => `<a href="${href}"${current(href)}>${label}</a>`);
  return `<nav aria-label="Navigation principale">
          ${links.join("\n          ")}
          <a href="${CATALOGUE_URL}" rel="noopener noreferrer" target="_blank" class="nav-external">Nos biens <span aria-hidden="true">↗</span><span class="visually-hidden"> (catalogue Connexion Immo, nouvel onglet)</span></a>
          <a href="/estimation/" class="nav-estimate"${route === "/estimation/" ? ' aria-current="page"' : ""}>Votre projet <span aria-hidden="true">↗</span></a>
        </nav>`;
}
/* Public path of a source page. */
const routeOf = (page) =>
  "/" + page.replace(/index\.html$/, "");

/* ── Applying blocks to a page ─────────────────────────────────────── */
function load() {
  const zones = readJson("zones.json"),
    pro = readJson("professional.json");
  validateZones(zones);
  validatePro(pro);
  validateSocial(pro);
  return { zones, pro };
}
function blocks({ zones, pro }) {
  return {
    footer: footer(pro),
    topbar: topbar(pro),
    nav,
    "zones-compact": zonesCompact(zones),
    "zones-detail": zonesDetail(zones),
    "commune-options": communeOptions(zones),
    "legal-details": legalDetails(pro),
    "legal-missing": legalMissing(pro),
    "legal-host": legalHost(pro),
    reviews: reviews(readJson("reviews.json")),
  };
}
/* A block is a string, or a function of the public path of the page. */
function apply(html, rendered, page = "") {
  return html.replace(
    /(<!-- gen:([a-z-]+) -->)[\s\S]*?(<!-- \/gen:\2 -->)/g,
    (all, open, name, close) => {
      if (!(name in rendered)) throw Error("Bloc inconnu : " + name);
      const block = rendered[name];
      return open + (typeof block === "function" ? block(routeOf(page)) : block) + close;
    },
  );
}
module.exports = {
  PAGES,
  root,
  content,
  load,
  blocks,
  apply,
  validateZones,
  validatePro,
  validateSocial,
  activeCommunes,
  targets,
  excludedNames,
  publicName,
  footer,
  topbar,
  communeOptions,
  nav,
  reviews,
  validateReviews,
  routeOf,
  esc,
  key,
  slug,
  communeRoute,
  localityRoute,
  hasOwnPage,
  targetedLocalities,
  estimateHref,
  field,
  CATALOGUE_URL,
};
