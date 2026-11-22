/* Pages generated from data/*.json: services, communes, villages, guides and
   the site map, plus the legacy .html addresses. */
import SitePage from "../components/SitePage";
import { pageProps, generatedPaths } from "../lib/pages";

export const config = { unstable_runtimeJS: false };
export default SitePage;

/* Addresses with a page file of their own. */
const OWN = ["/", "/estimation/", "/preparer-ma-vente/", "/secteurs/", "/404.html"];

export function getStaticPaths() {
  return { paths: generatedPaths(OWN), fallback: false };
}
export function getStaticProps({ params }) {
  const address = "/" + params.slug.join("/");
  return pageProps(address.endsWith(".html") ? address : address + "/");
}
