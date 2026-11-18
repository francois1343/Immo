/* Prints the tracked links of a campaign as CSV, one per support and sector.
   Usage: node scripts/campaign-links.cjs <campagne> [origine]
   Example: node scripts/campaign-links.cjs estimation-2027-01
   Names come from data/zones.json, so an excluded centre can never get a link.
   Nothing is sent or generated beyond this text: no QR image, no campaign. */
const P = require("./partials.cjs");
const SUPPORTS = {
  flyer: "print",
  carte: "print",
  "qr-commerce": "qr",
  facebook: "paid-social",
  instagram: "paid-social",
};
function links(zones, campaign, origin) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(campaign))
    throw Error("Nom de campagne : minuscules, chiffres et tirets, par exemple estimation-2027-01.");
  return P.activeCommunes(zones).flatMap((c) =>
    Object.entries(SUPPORTS).map(([source, medium]) => {
      const q = new URLSearchParams();
      if (!c.publicLabel) q.set("commune", c.commune);
      q.set("utm_source", source);
      q.set("utm_medium", medium);
      q.set("utm_campaign", campaign);
      q.set("utm_content", c.id);
      return { secteur: P.publicName(c), support: source, url: `${origin}/estimation/?${q}` };
    }),
  );
}
if (require.main === module) {
  const [campaign, origin = require("../seo.config.json").origin] = process.argv.slice(2);
  const rows = links(P.load().zones, campaign || "", origin);
  console.log("secteur;support;url");
  for (const r of rows) console.log(`${r.secteur};${r.support};${r.url}`);
}
module.exports = { links, SUPPORTS };
