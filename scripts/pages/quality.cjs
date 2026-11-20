/* Editorial quality gate of the generated pages.
   A page is `complete` when it carries enough local, sourced content of its
   own and is not a near copy of a sibling page. Anything else stays
   `to-review` and is never offered to search engines.
   Indexing needs three things together: a complete page, an editorial
   approval recorded in data/editorial.json, and the site in live mode. */
const text = (html) =>
  html
    .replace(/<(script|style)[\s\S]*?<\/\1>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const words = (t) => t.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
function shingles(tokens, n = 4) {
  const set = new Set();
  for (let i = 0; i + n <= tokens.length; i++) set.add(tokens.slice(i, i + n).join(" "));
  return set;
}
function jaccard(a, b) {
  let inter = 0;
  const [small, large] = a.size < b.size ? [a, b] : [b, a];
  for (const x of small) if (large.has(x)) inter++;
  return inter / (a.size + b.size - inter || 1);
}

/* Minimum of sourced local facts of its own, and ceiling of similarity with
   the closest page of the same family. */
const RULES = {
  service: { words: 350 },
  guide: { words: 300 },
  "guide-index": { words: 0 },
  commune: { words: 220, facts: 4, similarity: 0.8 },
  locality: { words: 160, facts: 2, similarity: 0.85 },
  "service-commune": { words: 260, facts: 4, similarity: 0.8 },
  "service-locality": { words: 220, facts: 3, similarity: 0.8 },
};

function evaluate(pages, editorial = {}) {
  const approvedFamilies = new Set(editorial.approvedFamilies || []),
    approvedRoutes = new Set(editorial.approvedRoutes || []),
    heldRoutes = new Set(editorial.heldRoutes || []);
  const errors = [];
  const unique = (field) => {
    const seen = new Map();
    for (const p of pages) {
      const k = p[field].trim().toLowerCase();
      if (seen.has(k)) errors.push(`${field} en double : ${p.route} et ${seen.get(k)}`);
      else seen.set(k, p.route);
    }
  };
  unique("route");
  unique("title");
  unique("h1");
  unique("description");

  const prepared = pages.map((p) => {
    const t = text(p.main),
      tokens = words(t);
    return { p, tokens, set: shingles(tokens) };
  });
  const byFamily = new Map();
  for (const x of prepared) {
    const k = x.p.family + "|" + (x.p.service || "");
    if (!byFamily.has(k)) byFamily.set(k, []);
    byFamily.get(k).push(x);
  }
  const rows = [];
  for (const group of byFamily.values()) {
    for (const x of group) {
      let max = 0,
        twin = "";
      for (const y of group) {
        if (x === y) continue;
        const j = jaccard(x.set, y.set);
        if (j > max) {
          max = j;
          twin = y.p.route;
        }
      }
      const rule = RULES[x.p.family] || {},
        issues = [];
      if (x.tokens.length < (rule.words || 0)) issues.push(`texte court (${x.tokens.length} mots, minimum ${rule.words})`);
      if (rule.facts && (x.p.ownFacts || 0) < rule.facts)
        issues.push(`repères locaux sourcés insuffisants (${x.p.ownFacts || 0} sur ${rule.facts})`);
      if (rule.similarity && max > rule.similarity)
        issues.push(`trop proche de ${twin} (${Math.round(max * 100)} %)`);
      if (x.p.applies === false) issues.push("prestation non étayée par les données de cette commune");
      if (x.p.title.length > 70) issues.push(`titre long (${x.p.title.length} caractères)`);
      if (x.p.description.length < 70 || x.p.description.length > 170)
        issues.push(`description hors gabarit (${x.p.description.length} caractères)`);
      const blocking = issues.filter((i) => !i.startsWith("titre long") && !i.startsWith("description"));
      const complete = blocking.length === 0;
      const approved =
        complete &&
        !heldRoutes.has(x.p.route) &&
        (approvedFamilies.has(x.p.family) || approvedRoutes.has(x.p.route));
      /* A simple indicator from 0 to 100, to sort the review work. */
      const score = Math.max(
        0,
        Math.min(
          100,
          Math.round(
            40 * Math.min(1, x.tokens.length / ((rule.words || 200) * 1.5)) +
              35 * (rule.facts ? Math.min(1, (x.p.ownFacts || 0) / (rule.facts * 1.5)) : 1) +
              25 * (rule.similarity ? Math.max(0, Math.min(1, (1 - max) / (1 - rule.similarity + 0.15))) : 1),
          ),
        ),
      );
      rows.push({
        route: x.p.route,
        family: x.p.family,
        service: x.p.service || "",
        commune: x.p.commune || "",
        locality: x.p.locality || "",
        title: x.p.title,
        h1: x.p.h1,
        words: x.tokens.length,
        localFacts: x.p.ownFacts == null ? "" : x.p.ownFacts,
        similarity: Math.round(max * 100),
        closest: twin,
        score,
        status: complete ? "complete" : "to-review",
        approved,
        issues,
      });
    }
  }
  rows.sort((a, b) => a.route.localeCompare(b.route));
  return { rows, errors };
}
module.exports = { evaluate, text, words, shingles, jaccard, RULES };
