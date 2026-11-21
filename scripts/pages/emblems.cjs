/* Local emblems: one small line pictogram per kind of landmark, drawn in the
   same stroke as the pictograms of the landing page.

   A page never gets an emblem by guess: data/local.json attaches an emblem to
   a sourced landmark ("emblem": { "icon": …, "label": … }), and only a landmark
   of a targeted locality is ever shown. To add one: pick an icon below (or draw
   a new one on the 48 × 48 grid) and add the "emblem" key to the landmark. */
const { esc } = require("../partials.cjs");

/* Bastioned plan: ten points, alternately on the bastions and on the curtain walls. */
const star = (cx, cy, outer, inner, n = 5) =>
  Array.from({ length: n * 2 }, (_, i) => {
    const r = i % 2 ? inner : outer,
      a = (Math.PI * i) / n - Math.PI / 2;
    return `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join("L");

const GROUND = '<path d="M6 41h36" />';
const ICONS = {
  /* Square keep with battlements. */
  keep: `<path d="M16 41V15h-2V9h4v3h4V9h4v3h4V9h4v6h-2v26" /><path d="M21 41v-7a3 3 0 0 1 6 0v7M24 19v4M20 27h0M28 27h0" />${GROUND}`,
  /* Belfry: square tower under a bulbous spire. */
  belfry: `<path d="M18 41V21h12v20M15.500 21h17" /><path d="M17.500 21c0-4.500 3-5.500 4.500-8 .900-1.500 1.400-3.500 2-6.500.600 3 1.100 5 2 6.500 1.500 2.500 4.500 3.500 4.500 8M24 6.500V3.500" /><circle cx="24" cy="28" r="3" /><path d="M22 41v-5h4v5" />${GROUND}`,
  /* Castle: two round towers and a gate. */
  castle: `<path d="M9 41V21h8v20M31 41V21h8v20M8 21l5-9 5 9M30 21l5-9 5 9" /><path d="M17 27h2.500v-2.500h3V27h3v-2.500h3V27H31" /><path d="M21.500 41v-5.500a2.500 2.500 0 0 1 5 0V41M13 26v3M35 26v3" />${GROUND}`,
  /* Manor: main building under a hipped roof, with a corner tower. */
  manor: `<path d="M9 41V25h22v16M7 25l4.500-8H28l3 5.500" /><path d="M31 41V17h8v24M30 17l5-9 5 9" /><path d="M14 30v4M20 30v4M26 30v4M35 22v3M35 30v3" />${GROUND}`,
  /* Church with a bulbous spire. */
  basilica: `<path d="M10 41V21h10v20" /><path d="M10 21c0-3 2-4 3.500-5.500.900-.900.900-2.100 0-3 .600-1.600 1.100-3.400 1.500-6 .400 2.600.900 4.400 1.500 6-.900.900-.900 2.100 0 3C18 17 20 18 20 21M15 6.500v-3M13.500 5h3" /><path d="M20 28l3-4h13l3 4v13M20 28h19" /><path d="M26.500 41v-5a2 2 0 0 1 4 0v5M13.500 41v-4.500a1.500 1.500 0 0 1 3 0V41M15 25v3" />${GROUND}`,
  /* Abbey: gable pierced by a pointed arch. */
  abbey: `<path d="M10 41V18l14-10 14 10v23" /><path d="M18 41V28c0-4.500 6-9 6-9s6 4.500 6 9v13M24 19v22M18.500 30h11" /><path d="M24 8V3.500M22 5.500h4" />${GROUND}`,
  /* Lake: a sail above the water. */
  lake: `<path d="M24 8v19M24 10l9.500 15H24M24 15l-7 10h7" /><path d="M13 29h22l-3 4.500H16Z" /><path d="M5 39c2.500-1.700 4.500-1.700 7 0s4.500 1.700 7 0 4.500-1.700 7 0 4.500 1.700 7 0 4.500-1.700 7 0 2.500 1 3 1" />`,
  /* Dam: the wall and its spillways, water below. */
  dam: `<path d="M7 15h34v5l-4 17H11L7 20Z" /><path d="M16.500 20v17M24 20v17M31.500 20v17M7 20h34" /><path d="M5 42c2.500-1.500 4.500-1.500 7 0s4.500 1.500 7 0 4.500-1.500 7 0 4.500 1.500 7 0 4.500-1.500 7 0 2.500.800 3 .800" />`,
  /* Fortified town: plan of a bastioned enclosure around its square. */
  ramparts: `<path d="M${star(24, 25, 19, 13.5)}Z" /><circle cx="24" cy="25" r="3.500" /><path d="M24 21.500V14M27.300 26.100l6.700 2.200M26 27.900l4.200 5.700M22 27.900l-4.200 5.700M20.700 26.100 14 28.300" />`,
  /* Steam train. */
  steam: `<path d="M9 31V21h19v10M28 31V14h11v17M12.500 21v-6h4v6" /><path d="M31.500 18.500h4v4.500h-4ZM14.500 11c0-2 2-2 2-4s-2-2-2-3.500M9 31l-4 4" /><circle cx="14" cy="35" r="4" /><circle cx="25" cy="35" r="4" /><circle cx="36" cy="36" r="3" /><path d="M4 41h40" />`,
  /* River: a meander between its banks. */
  river: `<path d="M17 5c9 6-9 13-1 20 5 4.400 9 8 5 18M29 5c9 6-9 13-1 20 5 4.400 9 8 5 18" /><path d="M22 13h3M24 31h3M21 22h2" />`,
  /* Greenway: a bicycle. */
  trail: `<circle cx="13" cy="32" r="7" /><circle cx="35" cy="32" r="7" /><path d="M13 32l6.500-13H31l4 13M19.500 19 27 32H13M31 19l-4 13M17 16h5.500M31 19l-1.500-4.500h4.500" />`,
  /* Towpath: a barge on the river. */
  towpath: `<path d="M5 25h38l-4 9H9Z" /><path d="M28 25v-7h9v7M31 21.500h3M9 25v-5h12v5M5 14h12M11 14v6" /><path d="M5 41c2.500-1.700 4.500-1.700 7 0s4.500 1.700 7 0 4.500-1.700 7 0 4.500 1.700 7 0 4.500-1.700 7 0 2.500 1 3 1" />`,
};

/* The emblem of a page: the landmark of the village when it has one, else the
   first emblem of the commune. `landmarks` is already limited to targeted places. */
function pick(landmarks, localityName, key) {
  const withEmblem = landmarks.filter((x) => x.emblem && ICONS[x.emblem.icon]);
  const own = localityName && withEmblem.find((x) => x.locality && key(x.locality) === key(localityName));
  return own || withEmblem[0] || null;
}

function svg(icon, cls = "emblem-icon") {
  return `<svg class="${cls}" viewBox="0 0 48 48" aria-hidden="true">${ICONS[icon]}</svg>`;
}

/* The mark shown beside the title of a local page. */
function mark(landmark) {
  if (!landmark) return "";
  const e = landmark.emblem;
  return `<p class="local-mark">${svg(e.icon)}<span><small>Repère local</small><strong>${esc(e.label)}</strong>${landmark.locality ? `<span>${esc(landmark.locality)}</span>` : ""}</span></p>`;
}

function validate(local) {
  for (const [id, L] of Object.entries(local.communes || {}))
    for (const x of L.landmarks || []) {
      if (!x.emblem) continue;
      if (!ICONS[x.emblem.icon]) throw Error(`local.json, ${id} : pictogramme inconnu « ${x.emblem.icon} »`);
      if (!x.emblem.label) throw Error(`local.json, ${id} : repère sans libellé`);
      if (!x.source) throw Error(`local.json, ${id} : un repère illustré doit avoir une source`);
    }
  return true;
}

module.exports = { ICONS, pick, mark, svg, validate };
