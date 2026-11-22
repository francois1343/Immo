import parse from "html-react-parser";

/* A fragment written as HTML (content/ or data/), turned into React elements. */
export const Html = ({ children }) => parse(children);

const mainProps = ({ id, class: className }) => ({ id, className });

function SiteLayout({ page }) {
  return (
    <>
      <a className="skip" href="#main">
        Aller au contenu
      </a>
      {page.draft && <div className="draft">Aperçu de travail · contenu à valider avant diffusion</div>}
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
        <main {...mainProps(page.main)}>
          <Html>{page.html}</Html>
        </main>
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
      <main {...mainProps(page.main)}>
        <Html>{page.html}</Html>
      </main>
      <Html>{page.footer}</Html>
    </>
  );
}

export default function Layout({ page }) {
  return page.layout === "legal" ? <LegalLayout page={page} /> : <SiteLayout page={page} />;
}
