/* Editorial worklist. Approval is given page by page in data/editorial.json
   (approvedRoutes); this script only lists what is waiting, it changes nothing.

   node scripts/editorial.cjs             summary by publication phase
   node scripts/editorial.cjs --phase 1   complete pages of phase 1 not yet
                                          approved, as a list ready to paste
                                          into approvedRoutes once reread */
const C = require("./pages/catalog.cjs"),
  Q = require("./pages/quality.cjs");
const data = C.load(),
  { pages, setAside } = C.plan(data),
  rows = Q.evaluate(pages, data.editorial).rows;
const arg = process.argv.indexOf("--phase"),
  phase = arg > -1 ? Number(process.argv[arg + 1]) : 0;
if (phase) {
  const waiting = rows.filter((r) => r.phase === phase && !r.approved).map((r) => r.route);
  console.log(JSON.stringify(waiting, null, 2));
} else {
  const out = {};
  for (const p of [1, 2, 3]) {
    const inPhase = rows.filter((r) => r.phase === p);
    out["phase " + p] = { complete: inPhase.length, approved: inPhase.filter((r) => r.approved).length };
  }
  out["à enrichir (noindex)"] = rows.filter((r) => !r.phase).length;
  out["mises de côté (non publiées)"] = setAside.length;
  console.log(JSON.stringify(out, null, 1));
}
