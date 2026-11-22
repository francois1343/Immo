(() => {
  "use strict";
  /* Old links to the form on the home page lead to its own page. */
  if (
    (location.pathname === "/" || location.pathname === "/index.html") &&
    location.hash === "#formulaire-estimation"
  )
    location.replace("/estimation/");
  if ("serviceWorker" in navigator)
    window.addEventListener("load", () =>
      navigator.serviceWorker.register("/service-worker.js").catch(() => {}),
    );
})();
