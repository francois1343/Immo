import SitePage from "../components/SitePage";
import { pageProps } from "../lib/pages";

export const config = { unstable_runtimeJS: false };
export default SitePage;
export const getStaticProps = () => pageProps("/estimation/");
