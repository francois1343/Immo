/* GET /api/meteo/ : the weather at the Lacs de l’Eau d’Heure for the coming
   hours (lib/weather.mjs). The forecast is read here, on the server: the
   browser of the visitor only ever talks to this site, and the content
   security policy stays closed. The answer is kept three hours by the CDN, as
   the terms of the service ask; when the forecast is out of reach the page
   simply keeps its default line. */
import seo from "../../seo.config.json";
import { FORECAST_URL, KEEP_SECONDS, hoursOf } from "../../lib/weather.mjs";

/* The service asks every client to name itself with the address of its site. */
const USER_AGENT = `site-immobilier/1.0 ${seo.origin}`;

export default async function meteo(req, res) {
  res.setHeader("X-Robots-Tag", "noindex");
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).json({ ok: false });
  }
  try {
    const answer = await fetch(FORECAST_URL, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(4000),
    });
    const hours = answer.ok ? hoursOf(await answer.json()) : null;
    if (!hours) throw Error("forecast " + answer.status);
    res.setHeader("Cache-Control", `public, max-age=600, s-maxage=${KEEP_SECONDS}, stale-while-revalidate=3600`);
    return res.status(200).json({ ok: true, hours });
  } catch (error) {
    /* Server log: the reason only. A short keep avoids asking again at once. */
    console.warn("meteo: " + (error && error.message));
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=600");
    return res.status(503).json({ ok: false });
  }
}
