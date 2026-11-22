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

/* Title, metadata, canonical address, structured data, styles and scripts of
   a page, exactly as computed by scripts/seo.cjs. */
export default function Seo({ tags }) {
  return (
    <Head>
      {tags.map((t, i) => {
        if (t.tag === "title") return <title key={i}>{t.text}</title>;
        if (t.tag === "script")
          return t.text ? (
            <script key={i} {...props(t.attrs)} dangerouslySetInnerHTML={{ __html: t.text }} />
          ) : (
            <script key={i} {...props(t.attrs)} />
          );
        const Tag = t.tag;
        return <Tag key={i} {...props(t.attrs)} />;
      })}
    </Head>
  );
}
