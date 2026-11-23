(() => {
  "use strict";
  /* Old links to the form on the home page lead to its own page. */
  if (
    (location.pathname === "/" || location.pathname === "/index.html") &&
    location.hash === "#formulaire-estimation"
  )
    location.replace("/estimation/");
  /* Seasonal tip of the home page: the season of the calendar, never the
     weather. The four tips are in the page; this only picks one. */
  const season = document.querySelector(".season[data-season]");
  if (season)
    season.dataset.season = ["hiver", "hiver", "printemps", "printemps", "printemps", "ete", "ete", "ete", "automne", "automne", "automne", "hiver"][new Date().getMonth()];
  if ("serviceWorker" in navigator)
    window.addEventListener("load", () =>
      navigator.serviceWorker.register("/service-worker.js").catch(() => {}),
    );
})();
