import parse from "html-react-parser";

/* A fragment written as HTML (content/ or data/), turned into React elements. */
/* Attributes React names differently and the parser leaves as written. */
const RENAMED = { fetchpriority: "fetchPriority" };
function replace(node) {
  if (!node.attribs) return;
  for (const [from, to] of Object.entries(RENAMED))
    if (from in node.attribs) {
      node.attribs[to] = node.attribs[from];
      delete node.attribs[from];
    }
}
export const Html = ({ children }) => parse(children, { replace });

const mainProps = ({ id, class: className }) => ({ id, className });

/* The content of a page, handed to the browser as written. The site's own
   scripts (public/site.js, public/estimation.js) work on this part of the
   page: React renders it once and never touches it again. */
const Content = ({ page }) => (
  <main {...mainProps(page.main)} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: page.html }} />
);

function SiteLayout({ page }) {
  return (
    <>
      <a className="skip" href="#main">
        Aller au contenu
      </a>
      {page.draft && <div className="draft">Aperçu de travail · contenu à valider avant diffusion</div>}
      {page.skybar && <Html>{page.skybar}</Html>}
      <div className="shell">
        {page.topbar && <Html>{page.topbar}</Html>}
        <header className="top">
          <a href="/" className="identity">
            <img src="/assets/logo-connexion.png" width="595" height="285" alt="Connexion Immo" />
            <span>
              Martin
              <br />
              Snauwaert
            </span>
          </a>
          <Html>{page.nav}</Html>
        </header>
        <Content page={page} />
        <Html>{page.footer}</Html>
      </div>
      {page.dock && (
        <nav className="mobile-contact" aria-label="Contact rapide">
          <a className="button secondary" href="tel:+32493057184">
            Appeler Martin
          </a>
          <a className="button" href="/estimation/">
            Mon projet ↗
          </a>
        </nav>
      )}
    </>
  );
}

function LegalLayout({ page }) {
  return (
    <>
      <Content page={page} />
      <Html>{page.footer}</Html>
    </>
  );
}

export default function Layout({ page }) {
  return page.layout === "legal" ? <LegalLayout page={page} /> : <SiteLayout page={page} />;
}
