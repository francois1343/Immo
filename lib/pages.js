/* Build-time access to the prepared pages (.site/pages.json, written by
   scripts/prepare.cjs). Only called from getStaticProps and getStaticPaths:
   nothing here reaches the browser. */
import fs from "node:fs";
import path from "node:path";

let cache;
function all() {
  if (!cache) {
    const file = path.join(process.cwd(), ".site", "pages.json");
    if (!fs.existsSync(file)) throw Error("Pages non préparées : lancer `npm run prepare-site` (ou `npm run build`).");
    cache = JSON.parse(fs.readFileSync(file, "utf8"));
  }
  return cache;
}

/* Props of the page published at `address`, for getStaticProps. */
export function pageProps(address) {
  const page = all()[address];
  if (!page) return { notFound: true };
  return { props: { page } };
}

/* Addresses rendered by the catch-all route: every page without a file of
   its own in pages/. */
export function generatedPaths(own) {
  return Object.keys(all())
    .filter((address) => !own.includes(address))
    .map((address) => ({ params: { slug: address.split("/").filter(Boolean) } }));
}
