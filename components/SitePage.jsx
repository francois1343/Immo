import Seo from "./Seo";
import Layout from "./Layout";

/* Every page of the site: its head, then its layout around its content. */
export default function SitePage({ page }) {
  return (
    <>
      <Seo tags={page.head} />
      <Layout page={page} />
    </>
  );
}

/* Pages are static HTML with the site's own small scripts (public/site.js,
   public/estimation.js): the Next.js client runtime is not shipped, so the
   strict Content-Security-Policy and the page weight stay as they were. */
export const staticPage = { unstable_runtimeJS: false };
