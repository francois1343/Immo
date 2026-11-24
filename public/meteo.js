(() => {
  "use strict";
  /* Weather at the lakes: the site's own address answers with the coming
     hours (pages/api/meteo.js), and the block shows the hour of the visit.
     Nothing about the visitor is sent. Without an answer the block keeps its
     default line. */
  const weather = document.querySelector("[data-weather]");
  if (!weather) return;
  fetch("/api/meteo/")
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      const hours = (data && data.hours) || [],
        now = Date.now();
      const hour = hours.filter((h) => Date.parse(h.at) <= now).pop() || hours[0];
      /* An answer kept too long is not shown. */
      if (!hour || Math.abs(now - Date.parse(hour.at)) > 2 * 3600e3) return;
      weather.querySelector(".weather-now").textContent = " · " + hour.temp + " °C";
      weather.querySelector(".weather-message").textContent = hour.message;
      weather.querySelector(".weather-credit").hidden = false;
      weather.dataset.weather = hour.icon;
    })
    .catch(() => {});
})();
