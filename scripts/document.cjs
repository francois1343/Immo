/* Splits a finished HTML page into the parts the Next.js components render:
   head tags, body class, layout, navigation, main content, footer.
   The text itself is not touched: every fragment is handed over as written. */
const decode = (s) =>
  String(s).replace(/&(amp|lt|gt|quot|#39);/g, (all, name) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" })[name]);
function attributes(source) {
  const attrs = {};
  for (const m of source.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*"([^"]*)")?/g))
    attrs[m[1].toLowerCase()] = m[2] === undefined ? "" : decode(m[2]);
  return attrs;
}
const fail = (route, what) => {
  throw Error(`${route} : ${what}`);
};
function headTags(head, route) {
  const tags = [];
  const pattern = /<!--[\s\S]*?-->|<title>([\s\S]*?)<\/title>|<script\b([^>]*)>([\s\S]*?)<\/script>|<(meta|link)\b([^>]*?)\/?>/g;
  let rest = head;
  for (const m of head.matchAll(pattern)) {
    rest = rest.replace(m[0], "");
    if (m[0].startsWith("<!--")) continue;
    if (m[1] !== undefined) tags.push({ tag: "title", text: decode(m[1].trim()) });
    else if (m[4]) tags.push({ tag: m[4], attrs: attributes(m[5]) });
    else tags.push({ tag: "script", attrs: attributes(m[2]), text: m[3] });
  }
  if (rest.trim()) fail(route, "balise d’en-tête non prise en charge : " + rest.trim().slice(0, 80));
  return tags;
}
function split(html, route) {
  /* A Windows checkout holds CRLF: the pages are rendered on LF, like the
     published ones, so server and browser read the same text. */
  html = html.replace(/\r\n?/g, "\n");
  const head = /<head>([\s\S]*?)<\/head>/.exec(html),
    body = /<body(?:\s+class="([^"]*)")?\s*>([\s\S]*)<\/body>/.exec(html),
    main = body && /<main\b([^>]*)>([\s\S]*)<\/main>/.exec(body[2]),
    footer = body && /<footer class="site-footer">[\s\S]*?<\/footer>/.exec(body[2]);
  if (!head || !body || !main || !footer) fail(route, "structure de page inattendue");
  const page = {
    head: headTags(head[1], route),
    bodyClass: body[1] === undefined ? null : body[1],
    main: attributes(main[1]),
    html: main[2],
    footer: footer[0],
  };
  if (!body[2].includes('<div class="shell">')) return { ...page, layout: "legal" };
  const nav = /<nav aria-label="Navigation principale">[\s\S]*?<\/nav>/.exec(body[2]);
  if (!nav) fail(route, "navigation absente");
  const topbar = /<div class="topbar">[\s\S]*?<\/div>/.exec(body[2]);
  return {
    ...page,
    layout: "site",
    nav: nav[0],
    topbar: topbar ? topbar[0] : null,
    draft: body[2].includes('<div class="draft">'),
    dock: body[2].includes('<nav class="mobile-contact"'),
  };
}
module.exports = { split, headTags, attributes };
