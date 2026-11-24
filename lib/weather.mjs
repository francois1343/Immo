/* Weather at the Lacs de l’Eau d’Heure, from the open forecast of MET Norway
   (api.met.no, Locationforecast 2.0, licence CC BY 4.0: the source is credited
   beside the block). Nothing here touches the network: these functions turn a
   forecast into the few hours the page shows, each with a pictogram and a
   short message. */

/* Lac de la Plate Taille. Four decimals at most, as the service requires. */
export const PLACE = { lat: 50.19, lon: 4.38, altitude: 250 };
export const FORECAST_URL = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${PLACE.lat}&lon=${PLACE.lon}&altitude=${PLACE.altitude}`;
/* The same request is not repeated more often than every third hour outside
   the Nordic countries: the answer of the site is kept that long. */
export const KEEP_SECONDS = 3 * 3600;
const HOURS = 5;

/* One pictogram per family of symbol codes (« lightrainshowers_day »…). */
export const ICONS = ["clear", "night", "partly", "cloudy", "fog", "rain", "snow", "thunder"];
export function iconOf(symbol = "") {
  const [base, time] = String(symbol).split("_");
  if (base.includes("thunder")) return "thunder";
  if (base.includes("snow") || base.includes("sleet")) return "snow";
  if (base.includes("rain")) return "rain";
  if (base === "fog") return "fog";
  if (base === "cloudy") return "cloudy";
  if (base === "partlycloudy") return "partly";
  if (base === "clearsky" || base === "fair") return time === "night" ? "night" : "clear";
  return "cloudy";
}

/* Wind in m/s: 10 m/s is a fresh breeze, about 36 km/h. */
const WINDY = 10;
/* Positive wording, as everywhere on the site: what to do, what to enjoy. */
export function messageOf({ temp, wind = 0, icon }) {
  if (icon === "thunder") return "Orage sur les lacs : un bon moment pour rester à l’abri et faire le point sur votre projet.";
  if (icon === "snow") return "Il neige sur les lacs : un paysage à admirer bien couvert, et une route à prendre en douceur.";
  if (temp <= 0) return "Il gèle aux lacs : restez bien au chaud, et roulez en douceur, la chaussée peut être glissante.";
  if (icon === "rain") return "Pluie sur les lacs : une journée à passer au sec, idéale pour faire le point sur votre projet.";
  if (icon === "fog") return "Brouillard sur les lacs : allumez vos feux et profitez du calme des berges.";
  if (wind >= WINDY) return "Vent soutenu sur les lacs : les voiles sont de sortie, tenez bien votre chapeau.";
  if (temp <= 5) return "Temps frais aux lacs : une bonne veste, et la balade est belle.";
  if (temp >= 25) return "Il fait chaud aux lacs : cap sur la plage et l’ombre des sentiers, avec de l’eau.";
  if (icon === "night") return "Nuit claire sur les lacs : belle soirée à vous.";
  if (icon === "clear" || icon === "partly") return "Beau temps sur les lacs : une belle journée pour une balade.";
  return "Ciel doux sur les lacs : un bon jour pour une balade au bord de l’eau.";
}

/* The current hour and the next ones, so that a kept answer stays right: the
   page picks the hour of the visit. Returns null when the forecast is unusable. */
export function hoursOf(forecast, now = new Date()) {
  const series = forecast && forecast.properties && forecast.properties.timeseries;
  if (!Array.isArray(series)) return null;
  const from = now.getTime() - 3600e3;
  const rows = [];
  for (const row of series) {
    const at = Date.parse(row.time),
      d = row.data || {},
      details = (d.instant || {}).details || {},
      symbol = ((d.next_1_hours || d.next_6_hours || {}).summary || {}).symbol_code;
    if (!(at > from) || typeof details.air_temperature !== "number" || !symbol) continue;
    const hour = { temp: Math.round(details.air_temperature), wind: details.wind_speed || 0, icon: iconOf(symbol) };
    rows.push({ at: new Date(at).toISOString(), temp: hour.temp, icon: hour.icon, message: messageOf(hour) });
    if (rows.length === HOURS) break;
  }
  return rows.length ? rows : null;
}
