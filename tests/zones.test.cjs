const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  P = require("../scripts/partials.cjs");
/* A Windows checkout may hold CRLF: compare on LF. */
const read = (f) =>
  fs.readFileSync(path.join(__dirname, "..", f), "utf8").replace(/\r\n/g, "\n");
const data = P.load(),
  rendered = P.blocks(data);
const commune = (id) => data.zones.communes.find((c) => c.id === id);

test("the thirteen communes of Martin's list are configured", () => {
  assert.equal(data.zones.communes.length, 13);
  assert.equal(P.targets(data.zones).length, 99);
  assert.deepEqual(
    data.zones.communes.filter((c) => c.anchor).map((c) => c.id),
    ["beaumont"],
  );
  assert.equal(P.activeCommunes(data.zones)[0].id, "beaumont");
});

test("Couvin and Erquelinnes centres are excluded, their villages stay targeted", () => {
  const names = P.targets(data.zones).map((t) => t.locality);
  for (const centre of ["Couvin", "Erquelinnes"]) assert.ok(!names.includes(centre));
  for (const village of [
    "Mariembourg",
    "Aublain",
    "Boussu-en-Fagne",
    "Dailly",
    "Bersillies-l’Abbaye",
    "Hantes-Wihéries",
    "Montignies-Saint-Christophe",
    "Solre-sur-Sambre",
  ])
    assert.ok(names.includes(village), village);
  /* Same postal code on both sides: the exclusion cannot be a postal code. */
  for (const id of ["couvin", "erquelinnes"]) {
    const c = commune(id),
      code = c.exclusions[0].postalCode;
    assert.ok(c.localities.every((l) => l.postalCode === code));
    assert.equal(c.localities.length, 4);
  }
  /* Sections outside Martin's selection are reported, never targeted. */
  assert.ok(!names.includes("Grand-Reng") && !names.includes("Pesche"));
});

test("an exclusion that is also targeted, or a postal code outside the commune, is refused", () => {
  const broken = structuredClone(data.zones);
  broken.communes[9].localities.push({ name: "Couvin", postalCode: "5660" });
  assert.throws(() => P.validateZones(broken));
  const wrongCode = structuredClone(data.zones);
  wrongCode.communes[0].localities[0].postalCode = "9999";
  assert.throws(() => P.validateZones(wrongCode));
});

test("no public page presents an excluded centre as a sector", () => {
  const banned = P.excludedNames(data.zones);
  assert.deepEqual(banned.sort(), ["Couvin", "Erquelinnes"]);
  const text = (html) =>
    html
      .replace(/<[^>]+>/g, " ")
      .replace(/Villages de Couvin|Villages d’Erquelinnes/g, "");
  for (const block of ["zones-compact", "zones-detail"])
    for (const name of banned)
      assert.ok(!new RegExp(`\\b${name}\\b`).test(text(rendered[block])), `${name} in ${block}`);
  for (const name of banned)
    assert.ok(!rendered["commune-options"].includes(`value="${name}"`));
  assert.ok(rendered["commune-options"].includes('value="Mariembourg"'));
});

test("every page carries the generated blocks and is in sync with the data", () => {
  for (const page of P.PAGES) {
    const html = read(page);
    assert.ok(html.includes("<!-- gen:footer -->"), page);
    assert.equal((html.match(/<footer/g) || []).length, 1, page);
    assert.ok(/href="\/?footer\.css"/.test(html), page);
    assert.equal(P.apply(html, rendered), html, `${page} : lancer npm run sync`);
  }
});

test("the footer shows verified details only, and never a bank account", () => {
  const html = rendered.footer;
  for (const expected of [
    "Martin Snauwaert",
    "IPI n° 513.699",
    "Avenue des Tours 31",
    'href="tel:+32493057184"',
    'href="mailto:martin.s@connexionimmo.be"',
    'href="/mentions-legales.html"',
    'href="/politique-confidentialite.html"',
  ])
    assert.ok(html.includes(expected), expected);
  for (const f of data.pro.fields.filter((x) => x.status !== "verified"))
    for (const text of [f.value, f.footerText].filter(Boolean))
      assert.ok(!html.includes(text), f.key);
  assert.ok(!/\bBE\d{2}[ \d]{12,}/.test(html));
  /* Switching on an unconfirmed value is refused by the data check. */
  const forced = structuredClone(data.pro);
  forced.fields.find((f) => f.key === "insurance").footer = true;
  assert.throws(() => P.validatePro(forced));
});

test("the sectors page stays out of the index like the rest of the preview", () => {
  assert.ok(read("secteurs/index.html").includes("noindex,nofollow"));
  assert.ok(read("service-worker.js").includes('"/secteurs/"'));
});

test("campaign links use stable sector ids and never name an excluded centre", () => {
  const { links } = require("../scripts/campaign-links.cjs");
  const rows = links(data.zones, "estimation-2027-01", "https://exemple.test");
  assert.equal(rows.length, 13 * 5);
  const couvin = rows.find((r) => r.url.includes("utm_content=couvin"));
  assert.ok(!couvin.url.includes("commune="));
  assert.equal(couvin.secteur, "Villages de Couvin");
  assert.ok(rows.some((r) => r.url.includes("commune=Beaumont&utm_source=flyer&utm_medium=print&utm_campaign=estimation-2027-01&utm_content=beaumont")));
  assert.throws(() => links(data.zones, "Campagne Été", "https://exemple.test"));
});

test("the legal page comes from the same data: verified host, no unconfirmed bank account", () => {
  const html = read("mentions-legales.html");
  assert.ok(html.includes("Vercel Inc."));
  assert.ok(html.includes("440 N Barranca Avenue #4133, Covina, CA 91723"));
  assert.ok(!html.includes("[Nom de l") && !html.includes("[Adresse"), "placeholder left");
  assert.ok(!/\bBE\d{2}[ \d]{12,}/.test(html), "bank account left");
  assert.ok(!html.includes("Compte de tiers"));
  /* Footer and legal list read the same fields: changing one changes both. */
  const moved = structuredClone(data.pro);
  moved.fields.find((f) => f.key === "phone").value = "0400 00 00 00";
  const again = P.blocks({ zones: data.zones, pro: moved });
  assert.ok(again.footer.includes("0400 00 00 00"));
  assert.ok(again["legal-details"].includes("0400 00 00 00"));
  for (const k of ["phone", "email"]) {
    const v = data.pro.fields.find((f) => f.key === k).value;
    assert.ok(rendered.footer.includes(v) && rendered["legal-details"].includes(v), k);
  }
  /* The public data file carries no working notes or unconfirmed numbers. */
  const raw = fs.readFileSync(path.join(__dirname, "..", "data", "professional.json"), "utf8");
  for (const word of ['"source"', '"note"', '"candidate"', "thirdPartyAccount", "0721"])
    assert.ok(!raw.includes(word), word);
  /* An unverified host is never printed. */
  const draft = structuredClone(data.pro);
  draft.fields.find((f) => f.key === "host").status = "to-confirm";
  assert.ok(!P.blocks({ zones: data.zones, pro: draft })["legal-host"].includes("Vercel"));
});
