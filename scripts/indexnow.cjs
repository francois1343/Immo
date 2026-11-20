/* IndexNow notification, prepared and switched off.
   IndexNow reaches the participating engines (Bing, Yandex, Seznam, Naver…).
   Google does not take part: it relies on Search Console, the sitemap and
   normal crawling. The Google Indexing API is reserved for job postings and
   live broadcasts and must not be used for these pages.

   Usage:
     node scripts/indexnow.cjs            lists what would be sent, sends nothing
     node scripts/indexnow.cjs --send     sends, only when every guard passes

   Guards before any request: the site is in live mode, the build has produced
   reports/indexnow-urls.txt (complete, approved, indexable pages only), an
   IndexNow key is configured in seo.config.json, its key file is published at
   the root of the live site, and every URL belongs to the configured origin.
   A preview or *.vercel.app address is never submitted. */
const fs = require("node:fs"),
  path = require("node:path");
const root = path.resolve(__dirname, "..");
const ENDPOINT = "https://api.indexnow.org/indexnow";
const MAX = 10000;

function plan(config, urls) {
  const reasons = [];
  const origin = new URL(config.origin);
  const key = (config.indexNow && config.indexNow.key) || "";
  if (config.mode !== "live") reasons.push("le site est en mode aperçu");
  if (/\.vercel\.app$/.test(origin.hostname)) reasons.push("l’origine est une adresse de préproduction (*.vercel.app)");
  if (!/^[a-zA-Z0-9-]{8,128}$/.test(key)) reasons.push("aucune clé IndexNow valide dans seo.config.json (indexNow.key)");
  if (!urls.length) reasons.push("aucune URL indexable dans reports/indexnow-urls.txt");
  const foreign = urls.filter((u) => {
    try {
      return new URL(u).origin !== origin.origin;
    } catch {
      return true;
    }
  });
  if (foreign.length) reasons.push(`${foreign.length} URL hors de ${origin.origin}`);
  if (urls.length > MAX) reasons.push(`plus de ${MAX} URL : découper l’envoi`);
  return {
    allowed: reasons.length === 0,
    reasons,
    body: { host: origin.hostname, key, keyLocation: `${origin.origin}/${key}.txt`, urlList: urls },
  };
}
async function main() {
  const config = JSON.parse(fs.readFileSync(path.join(root, "seo.config.json"), "utf8"));
  const file = path.join(root, "reports", "indexnow-urls.txt");
  const urls = fs.existsSync(file) ? fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean) : [];
  const p = plan(config, urls);
  const send = process.argv.includes("--send");
  console.log(JSON.stringify({ mode: config.mode, urls: urls.length, wouldSend: p.allowed, blockedBy: p.reasons }, null, 1));
  if (!send) return;
  if (!p.allowed) {
    console.error("Envoi refusé : " + p.reasons.join(" ; "));
    process.exit(1);
  }
  /* The key file must already answer on the live site. */
  const check = await fetch(p.body.keyLocation);
  if (!check.ok || (await check.text()).trim() !== p.body.key) {
    console.error("Envoi refusé : fichier de clé absent ou différent à " + p.body.keyLocation);
    process.exit(1);
  }
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(p.body),
  });
  console.log("IndexNow : HTTP " + res.status);
  if (res.status !== 200 && res.status !== 202) process.exit(1);
}
if (require.main === module) main();
module.exports = { plan, ENDPOINT, MAX };
