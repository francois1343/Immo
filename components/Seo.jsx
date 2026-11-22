import Head from "next/head";

/* HTML attribute names as React expects them. */
const PROPS = {
  charset: "charSet",
  crossorigin: "crossOrigin",
  imagesrcset: "imageSrcSet",
  imagesizes: "imageSizes",
  fetchpriority: "fetchPriority",
};
const BOOLEAN = ["defer"];
function props(attrs = {}) {
  const out = {};
  for (const [name, value] of Object.entries(attrs))
    out[PROPS[name] || name] = BOOLEAN.includes(name) ? true : value;
  return out;
}

/* Style sheets and script files belong to the document (pages/_document.jsx);
   everything else is page metadata. */
const isAsset = (t) => (t.tag === "link" && t.attrs.rel === "stylesheet") || (t.tag === "script" && Boolean(t.attrs.src));

function tag(t, i) {
  if (t.tag === "title") return <title key={i}>{t.text}</title>;
  if (t.tag === "script")
    return t.text ? (
      <script key={i} {...props(t.attrs)} dangerouslySetInnerHTML={{ __html: t.text }} />
    ) : (
      <script key={i} {...props(t.attrs)} />
    );
  const Tag = t.tag;
  return <Tag key={i} {...props(t.attrs)} />;
}

/* Style sheets and scripts of a page, in their original order: rendered
   inside the <Head> of the document. */
export const assets = (tags = []) => tags.filter(isAsset).map(tag);

/* Title, metadata, canonical address and structured data of a page, exactly
   as computed by scripts/seo.cjs. */
export default function Seo({ tags }) {
  return <Head>{tags.filter((t) => !isAsset(t)).map(tag)}</Head>;
}
