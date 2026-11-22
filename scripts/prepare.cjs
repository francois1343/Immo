/* Prepares what Next.js renders: every page of the site, with its metadata,
   written to .site/pages.json, plus the generated public files (sitemap,
   vendor bundle, open robots.txt once live).
   Hand-written pages come from content/, local pages from data/*.json. */
const fs = require("node:fs"),
  path = require("node:path");
const P = require("./partials.cjs"),
  S = require("./seo.cjs"),
  G = require("./pages/index.cjs"),
  D = require("./document.cjs");
const root = P.root,
  site = path.join(root, ".site"),
  pub = path.join(root, "public");
/* Third-party browser bundle, copied from the installed package. */
const vendor = {
  "vendor/libphonenumber-min.js": "node_modules/libphonenumber-js/bundle/libphonenumber-min.js",
};
/* Files written into public/ by this step; everything else there is a source. */
const generatedPublic = [...Object.keys(vendor), "sitemap.xml", "inquiry-config.js"];
/* Address of the reception route (pages/api/demande.js). */
const ENDPOINT = "/api/demande/";
/* Settings read by public/estimation.js. The form posts to the site only when
   the SMTP password is present at build time; otherwise it sends nothing and
   prepares a message the visitor sends from their own mail app. */
const inquiryConfig = (env = process.env) =>
  "/* Written by scripts/prepare.cjs: do not edit. */\n" +
  `window.IMMO_INQUIRY = Object.freeze(${JSON.stringify({ endpoint: env.SMTP_PASSWORD ? ENDPOINT : "", turnstileSiteKey: "" })});\n`;
/* Public address of a page file: a folder index, or the file itself. */
const addressOf = (file) => "/" + file.replace(/index\.html$/, "");

function prepare() {
  /* Same variables as Next.js: .env.local on a workstation, the host's
     environment in production. */
  require("@next/env").loadEnvConfig(root, false, { info() {}, error: console.error });
  const config = S.readConfig(root),
    live = config.mode === "live";
  const rendered = P.blocks(P.load());
  const documents = new Map();
  for (const page of P.PAGES)
    documents.set(page, P.apply(fs.readFileSync(path.join(P.content, page), "utf8"), rendered, page));
  const titleOf = (file) => (documents.get(file).match(/<title>\s*([^<|]+?)\s*(?:\||<)/) || [])[1] || file;
  const statics = Object.entries(S.routes)
    .filter(([, [route]]) => route !== "/")
    .map(([file, [route]]) => ({ route, h1: titleOf(file) }));
  const generated = G.plan({ statics });
  for (const page of [...generated.pages, ...generated.utility])
    documents.set(G.fileOf(page), G.shell(page, generated.rendered));

  const pages = {},
    indexable = [];
  for (const entry of S.entries(config, generated)) {
    const address = addressOf(entry.file);
    if (pages[address]) throw Error("Adresse en double : " + address);
    pages[address] = D.split(S.enrich(documents.get(entry.file), entry, config), address);
    if (entry.index && live) indexable.push(entry.route);
  }
  indexable.sort();

  fs.mkdirSync(site, { recursive: true });
  fs.writeFileSync(path.join(site, "pages.json"), JSON.stringify(pages));
  for (const [name, from] of Object.entries(vendor)) {
    const dest = path.join(pub, name);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(root, from), dest);
  }
  fs.writeFileSync(path.join(pub, "sitemap.xml"), S.sitemap(config, indexable));
  if (live) fs.writeFileSync(path.join(pub, "robots.txt"), S.liveRobots(config));
  fs.writeFileSync(path.join(pub, "inquiry-config.js"), inquiryConfig());
  return {
    generated,
    addresses: Object.keys(pages),
    reception: Boolean(process.env.SMTP_PASSWORD),
    seo: { mode: config.mode, canonicalOrigin: config.origin, indexablePages: indexable.length, indexable },
  };
}
module.exports = { prepare, generatedPublic, addressOf, inquiryConfig, ENDPOINT };
if (require.main === module) {
  const { addresses, seo } = prepare();
  console.log(JSON.stringify({ pages: addresses.length, mode: seo.mode }));
}
