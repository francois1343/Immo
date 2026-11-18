/* Explicit public export: legacy experiments and working files stay outside. */
const fs = require("node:fs"),
  path = require("node:path");
const root = path.resolve(__dirname, ".."),
  out = path.join(root, "public-dist");
const files = [
  "index.html",
  "estimation/index.html",
  "preparer-ma-vente/index.html",
  "vendre-beaumont-barbencon/index.html",
  "secteurs/index.html",
  "Back/estimation.html",
  "Back/formulaire.html",
  "mentions-legales.html",
  "politique-confidentialite.html",
  "site.css",
  "site.js",
  "estimation.css",
  "estimation.js",
  "inquiry-core.js",
  "inquiry-config.js",
  "legal.css",
  "footer.css",
  "fonts.css",
  "service-worker.js",
  "manifest.webmanifest",
  "robots.txt",
  "assets/ms.jpg",
  "assets/logo-connexion.png",
  "assets/favicon-32.png",
  "assets/icon-192.png",
  "assets/icon-512.png",
  "assets/icon-maskable-192.png",
  "assets/icon-maskable-512.png",
  ...fs
    .readdirSync(path.join(root, "assets/fonts"))
    .filter((n) => /^[a-zA-Z0-9_.-]+\.(woff2|txt)$/.test(n))
    .map((n) => "assets/fonts/" + n),
];
/* Third-party browser bundle, copied from the installed package at build time. */
const vendor = {
  "vendor/libphonenumber-min.js":
    "node_modules/libphonenumber-js/bundle/libphonenumber-min.js",
};
for (const name of files) {
  const source = path.join(root, name);
  if (fs.lstatSync(source).isSymbolicLink() || !fs.statSync(source).isFile())
    throw Error("Unexpected source: " + name);
}
if (fs.existsSync(out)) {
  for (const entry of fs.readdirSync(out, {
    recursive: true,
    withFileTypes: true,
  })) {
    if (entry.isSymbolicLink()) throw Error("Unexpected symlink");
    if (entry.isFile()) {
      const relative = path
        .relative(out, path.join(entry.parentPath, entry.name))
        .replaceAll("\\", "/");
      if (
        !files.includes(relative) &&
        !(relative in vendor) &&
        relative !== "sitemap.xml"
      )
        throw Error("Unexpected output: " + relative);
    }
  }
}
for (const name of files) {
  const dest = path.join(out, name);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(root, name), dest);
}
for (const [name, from] of Object.entries(vendor)) {
  const dest = path.join(out, name);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(root, from), dest);
}
/* Shared blocks (footer, sectors, legal details) are rendered from data/*.json
   again here, so the export never depends on a page synced by hand. */
const partials = require("./partials.cjs"),
  rendered = partials.blocks(partials.load());
for (const page of partials.PAGES) {
  const dest = path.join(out, page);
  fs.writeFileSync(dest, partials.apply(fs.readFileSync(dest, "utf8"), rendered));
}
const seo = require("./seo.cjs").build(root, out);
console.log(
  JSON.stringify({
    files: files.length,
    output: "public-dist",
    automaticReception: false,
    indexing: false,
    seo,
  }),
);
