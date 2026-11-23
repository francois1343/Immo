/* « Actualités & conseils » : the dated contents of the site, their cards, and
   the seasonal tip of the home page.
   A story is a news article (data/articles.json) or a guide that carries a
   category and a publication date (data/guides.json). Nothing here knows the
   weather: a season is a period of the calendar, nothing more. */
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const INDEX = "/actualites/";
const CATEGORIES = {
  actualites: "Actualités immobilières",
  conseils: "Conseils aux propriétaires",
  saisons: "Immobilier au fil des saisons",
  local: "Vie locale et patrimoine",
};

/* Line pictograms on the 48 × 48 grid, same stroke as the local emblems. They
   stand in for photographs until authorised pictures are supplied. */
const HOUSE = '<path d="M8 22 24 9l16 13v19H8Z" />';
const ICONS = {
  /* Energy label: a house and its bars. */
  label: `${HOUSE}<path d="M15 26h8M15 31h12M15 36h16" />`,
  /* Renovation: a house that moves up. */
  renovation: `${HOUSE}<path d="M24 37V24M18.500 29.500 24 24l5.500 5.500" />`,
  /* Advice: a house and a tick. */
  advice: `${HOUSE}<path d="m17 30 5 5 9-10" />`,
  /* Succession: a deed and its seal. */
  deed: `<path d="M12 6h17l8 8v28H12Z" /><path d="M29 6v8h8M17 20h12M17 26h14M17 32h7" /><circle cx="31" cy="35" r="3.500" />`,
  /* Watercourse: a house above the water. */
  water: `<path d="M11 21 24 10l13 11v10H11Z" /><path d="M21 31v-6h6v6" /><path d="M5 37c2.500-1.700 4.500-1.700 7 0s4.500 1.700 7 0 4.500-1.700 7 0 4.500 1.700 7 0 4.500-1.700 7 0 2.500 1 3 1M5 43c2.500-1.700 4.500-1.700 7 0s4.500 1.700 7 0 4.500-1.700 7 0 4.500 1.700 7 0 4.500-1.700 7 0 2.500 1 3 1" />`,
  /* Humidity: a drop. */
  drop: `<path d="M24 6c7 9 11 15 11 21a11 11 0 0 1-22 0c0-6 4-12 11-21Z" /><path d="M19 28a5 5 0 0 0 5 5" />`,
  /* Visits: an open door. */
  door: `<path d="M10 42V8h18v34M28 12l10 3v24l-10 3" /><path d="M23 25v3M6 42h36" />`,
  /* Heritage: a village church. */
  heritage: `<path d="M10 41V25l8-7 8 7v16M26 41V16l5-9 5 9v25M31 7V3M29 5h4" /><path d="M16 41v-6h4v6M31 22v5" /><path d="M6 41h36" />`,
  snow: `<path d="M24 5v38M7.500 14.500l33 19M7.500 33.500l33-19" /><path d="m19 9 5 5 5-5M19 39l5-5 5 5M8.500 21.500l6.800-1.800-1.800-6.800M39.500 26.500l-6.800 1.800 1.800 6.800M8.500 26.500l6.800 1.800-1.800 6.800M39.500 21.500l-6.800-1.800 1.800-6.800" />`,
  leaf: `<path d="M11 37C9 20 21 9 40 9c1 19-10 31-29 28Z" /><path d="M7 42 29 20M19 30h-7M24 25v-8M29 20h7" />`,
  sprout: `<path d="M24 43V23" /><path d="M24 23c-6 0-9.500-4.500-9.500-12 3 0 5 1 6.500 3 0-3.500 1-6 3-8 2 2 3 4.500 3 8 1.500-2 3.500-3 6.500-3 0 7.500-3.500 12-9.500 12Z" /><path d="M24 38c-5 0-8-2.500-9-7 5 0 8 2.500 9 7Zm0 0c5 0 8-2.500 9-7-5 0-8 2.500-9 7Z" />`,
  sun: `<circle cx="24" cy="24" r="8" /><path d="M24 5v6M24 37v6M5 24h6M37 24h6M10.600 10.600l4.200 4.200M33.200 33.200l4.200 4.200M10.600 37.400l4.200-4.200M33.200 14.800l4.200-4.200" />`,
};
const svg = (icon, cls) => `<svg class="${cls}" viewBox="0 0 48 48" aria-hidden="true">${ICONS[icon]}</svg>`;

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
function frDate(iso) {
  const m = ISO.exec(iso || "");
  return m ? `${m[3] === "01" ? "1er" : Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : iso || "";
}

/* ── Stories ───────────────────────────────────────────────────────── */
const articleRoute = (a) => `${INDEX}${a.slug}/`;
/* Every dated content, most recent first; at equal dates, news come first,
   in the order of the file. */
function stories({ articles = [], guides = [] }) {
  const rows = [
    ...articles.map((a) => ({ kind: "article", route: articleRoute(a), more: "Lire l’article" })),
    ...guides.filter((g) => g.category && g.publishedOn).map((g) => ({ kind: "guide", route: `/guides/${g.slug}/`, more: "Lire le guide" })),
  ];
  const source = [...articles, ...guides.filter((g) => g.category && g.publishedOn)];
  return rows
    .map((row, i) => {
      const x = source[i];
      return { ...row, order: i, category: x.category, icon: x.icon, publishedOn: x.publishedOn, title: x.short || x.h1, teaser: x.teaser || x.description };
    })
    .sort((a, b) => b.publishedOn.localeCompare(a.publishedOn) || a.order - b.order);
}
/* The whole card is one link: one stop for the keyboard, one name for a
   screen reader. */
const card = (s) => `<li class="story"><a href="${s.route}">
<span class="story-head">${svg(s.icon, "story-icon")}<span class="story-meta"><span class="story-cat">${esc(CATEGORIES[s.category])}</span><time datetime="${s.publishedOn}">${esc(frDate(s.publishedOn))}</time></span></span>
<strong>${esc(s.title)}</strong>
<span class="story-text">${esc(s.teaser)}</span>
<span class="story-more">${esc(s.more)} <span aria-hidden="true">↗</span></span>
</a></li>`;
const cards = (rows) => (rows.length ? `<ul class="stories">\n${rows.map(card).join("\n")}\n</ul>` : "");
/* Home page: the latest contents, three at most. */
const latest = (data, n = 3) => stories(data).slice(0, n);

/* ── Season ────────────────────────────────────────────────────────── */
/* Meteorological seasons of the calendar: winter is December to February. */
const SEASONS = ["hiver", "printemps", "ete", "automne"];
const SEASON_OF_MONTH = ["hiver", "hiver", "printemps", "printemps", "printemps", "ete", "ete", "ete", "automne", "automne", "automne", "hiver"];
const seasonOf = (date) => SEASON_OF_MONTH[date.getMonth()];
/* The four tips share one cell, so the block keeps the height of the longest
   and nothing moves when the script of the page picks the season of the day.
   The source pages hold a neutral mark; the build stamps the season of its
   day (`stamp`), which is what a visitor without script sees. */
const NEUTRAL = 'class="season" data-season="auto"';
const stamp = (html, today = new Date()) => html.replace(NEUTRAL, `class="season" data-season="${seasonOf(today)}"`);
function seasonBlock(seasons) {
  const tips = SEASONS.map((id) => {
    const t = seasons.tips[id];
    return `<div class="season-tip" data-for="${id}">
${svg(t.icon, "season-icon")}
<div><h3>${esc(t.title)}</h3><p>${esc(t.text)}</p></div>
<a class="button secondary" href="${t.href}">${esc(t.label)} <span aria-hidden="true">↗</span></a>
</div>`;
  });
  return `<div ${NEUTRAL}>
<p class="eyebrow">Le conseil de saison</p>
<div class="season-tips">
${tips.join("\n")}
</div>
</div>`;
}

/* ── Controls ──────────────────────────────────────────────────────── */
const WEATHER = /il neige|il pleut|il gèle|il fait (froid|chaud|beau)|aujourd’hui|ce matin|°C|degrés/i;
function validate({ articles = [], guides = [], seasons }) {
  const seen = new Set();
  const dated = (x, where) => {
    if (!CATEGORIES[x.category]) throw Error(`${where} : catégorie inconnue`);
    if (!ICONS[x.icon]) throw Error(`${where} : pictogramme inconnu`);
    if (!ISO.test(x.publishedOn || "")) throw Error(`${where} : date de publication attendue (AAAA-MM-JJ)`);
    if (x.updatedOn && (!ISO.test(x.updatedOn) || x.updatedOn < x.publishedOn)) throw Error(`${where} : date de modification invalide`);
    if (x.author) throw Error(`${where} : pas d’auteur nommé avant validation de son rôle`);
  };
  for (const a of articles) {
    const where = "articles.json, " + a.slug;
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(a.slug || "") || seen.has(a.slug)) throw Error("articles.json : slug invalide ou en double : " + a.slug);
    seen.add(a.slug);
    for (const k of ["title", "h1", "description", "intro", "teaser"]) if (!a[k]) throw Error(`${where} : ${k} manquant`);
    dated(a, where);
    if (!(a.sources || []).length) throw Error(`${where} : une actualité cite au moins une source`);
    for (const [, url] of a.sources) if (!/^https:\/\//.test(url)) throw Error(`${where} : source en https attendue`);
  }
  for (const g of guides.filter((x) => x.category || x.publishedOn)) dated(g, "guides.json, " + g.slug);
  if (seasons) {
    for (const id of SEASONS) {
      const t = (seasons.tips || {})[id];
      if (!t || !t.title || !t.text || !t.label || !/^\/[a-z0-9/-]*$/.test(t.href || "")) throw Error("seasons.json : conseil incomplet : " + id);
      if (!ICONS[t.icon]) throw Error("seasons.json : pictogramme inconnu : " + id);
      if (WEATHER.test(t.title + " " + t.text)) throw Error("seasons.json : un conseil de saison ne décrit pas la météo : " + id);
    }
  }
  return true;
}

module.exports = { INDEX, CATEGORIES, ICONS, SEASONS, SEASON_OF_MONTH, WEATHER, seasonOf, seasonBlock, stamp, stories, latest, card, cards, articleRoute, frDate, validate, svg };
