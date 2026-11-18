/* Rewrites the generated blocks of the source pages from data/*.json.
   `node scripts/sync.cjs --check` changes nothing and fails on drift. */
const fs = require("node:fs"),
  path = require("node:path");
const P = require("./partials.cjs");
const check = process.argv.includes("--check");
const rendered = P.blocks(P.load());
const drift = [];
for (const page of P.PAGES) {
  const file = path.join(P.root, page),
    before = fs.readFileSync(file, "utf8"),
    after = P.apply(before, rendered);
  if (before === after) continue;
  drift.push(page);
  if (!check) fs.writeFileSync(file, after);
}
console.log(
  JSON.stringify({ mode: check ? "check" : "write", changed: drift }),
);
if (check && drift.length) process.exit(1);
