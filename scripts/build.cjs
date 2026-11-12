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
  "Back/estimation.html",
  "Back/formulaire.html",
  "mentions-legales.html",
  "politique-confidentialite.html",
  "site.css",
  "site.js",
  "legal.css",
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
      if (!files.includes(relative))
        throw Error("Unexpected output: " + relative);
    }
  }
}
for (const name of files) {
  const dest = path.join(out, name);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(root, name), dest);
}
console.log(
  JSON.stringify({
    files: files.length,
    output: "public-dist",
    automaticReception: false,
    indexing: false,
  }),
);
