import Document, { Html, Head, Main, NextScript } from "next/document";
import { assets } from "../components/Seo";

/* React adds a preload hint for every image it renders. The pages declare
   their own (the portrait of the home page, in WebP): the automatic ones
   would fetch images earlier, or twice, so they are left out. */
const AUTOMATIC_PRELOADS = /<link rel="preload" as="image"[^>]*\/>/g;

export default class SiteDocument extends Document {
  static async getInitialProps(ctx) {
    const initial = await Document.getInitialProps(ctx);
    return { ...initial, html: initial.html.replace(AUTOMATIC_PRELOADS, "") };
  }

  render() {
    const page = this.props.__NEXT_DATA__.props?.pageProps?.page;
    const bodyClass = page && page.bodyClass !== null ? page.bodyClass : undefined;
    return (
      <Html lang="fr">
        <Head>{assets(page?.head)}</Head>
        <body className={bodyClass}>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
