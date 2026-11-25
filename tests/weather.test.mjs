/* Weather at the lakes: pictograms, messages and the hours kept for the page. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { FORECAST_URL, ICONS, KEEP_SECONDS, hoursOf, iconOf, messageOf } from "../lib/weather.mjs";

const require = createRequire(import.meta.url);
const T = require("../scripts/pages/stories.cjs");
const read = (f) => fs.readFileSync(new URL("../" + f, import.meta.url), "utf8");

const row = (time, temp, symbol, wind = 2) => ({
  time,
  data: { instant: { details: { air_temperature: temp, wind_speed: wind } }, next_1_hours: { summary: { symbol_code: symbol } } },
});
const forecast = (rows) => ({ properties: { timeseries: rows } });

test("every symbol code of the forecast leads to a pictogram drawn in the page", () => {
  const cases = {
    clearsky_day: "clear",
    fair_night: "night",
    clearsky_polartwilight: "clear",
    partlycloudy_day: "partly",
    cloudy: "cloudy",
    fog: "fog",
    lightrainshowers_day: "rain",
    heavyrain: "rain",
    sleet: "snow",
    lightsnowshowers_night: "snow",
    heavyrainandthunder: "thunder",
    lightssnowshowersandthunder_day: "thunder",
    unknown: "cloudy",
  };
  for (const [symbol, icon] of Object.entries(cases)) assert.equal(iconOf(symbol), icon, symbol);
  assert.deepEqual(Object.keys(T.SKY).sort(), [...ICONS].sort());
  const block = T.weatherBlock();
  for (const id of ICONS) assert.ok(block.includes(`data-for="${id}"`), id);
  const css = read("public/site.css");
  for (const id of ICONS) assert.ok(css.includes(`.weather[data-weather="${id}"] [data-for="${id}"]`), id);
});

test("the message follows the weather, in positive words", () => {
  assert.match(messageOf({ temp: -2, icon: "cloudy" }), /Il gèle/);
  assert.match(messageOf({ temp: -1, icon: "snow" }), /Il neige/);
  assert.match(messageOf({ temp: 9, icon: "rain" }), /Pluie/);
  assert.match(messageOf({ temp: 18, icon: "thunder" }), /Orage/);
  assert.match(messageOf({ temp: 8, icon: "fog" }), /Brouillard/);
  assert.match(messageOf({ temp: 14, wind: 12, icon: "partly" }), /Vent/);
  assert.match(messageOf({ temp: 3, icon: "clear" }), /frais/);
  assert.match(messageOf({ temp: 28, icon: "clear" }), /chaud/);
  assert.match(messageOf({ temp: 15, icon: "night" }), /Nuit claire/);
  assert.match(messageOf({ temp: 18, icon: "clear" }), /Beau temps/);
  assert.match(messageOf({ temp: 12, icon: "cloudy" }), /Ciel doux/);
  for (const icon of ICONS)
    for (const temp of [-5, 0, 3, 12, 30]) {
      const m = messageOf({ temp, icon });
      assert.ok(m.length > 30 && m.length < 130, m);
      assert.ok(!/\b(danger|interdit|attention|risque)/i.test(m), m);
    }
});

test("the answer holds the current hour and the next ones, nothing older", () => {
  const now = new Date("2026-11-24T14:20:00Z");
  const hours = hoursOf(
    forecast([
      row("2026-11-24T12:00:00Z", 6, "cloudy"),
      row("2026-11-24T14:00:00Z", 4.6, "lightrain"),
      row("2026-11-24T15:00:00Z", 3.4, "cloudy"),
      row("2026-11-24T16:00:00Z", -0.6, "clearsky_night"),
      { time: "2026-11-24T17:00:00Z", data: { instant: { details: {} } } },
      row("2026-11-24T18:00:00Z", -2, "fog"),
      row("2026-11-24T19:00:00Z", -2, "fog"),
      row("2026-11-24T20:00:00Z", -2, "fog"),
      row("2026-11-24T21:00:00Z", -2, "fog"),
    ]),
    now,
  );
  assert.equal(hours.length, 5);
  assert.deepEqual(hours[0], { at: "2026-11-24T14:00:00.000Z", temp: 5, icon: "rain", message: messageOf({ temp: 5, icon: "rain" }) });
  assert.equal(hours[2].icon, "night");
  assert.match(hours[2].message, /Il gèle/);
  assert.equal(hours[3].at, "2026-11-24T18:00:00.000Z");
  for (const bad of [null, {}, forecast([]), forecast([row("2020-01-01T00:00:00Z", 1, "fog")])]) assert.equal(hoursOf(bad, now), null);
});

test("the forecast is asked by the server only, and kept as long as the service asks", () => {
  assert.match(FORECAST_URL, /^https:\/\/api\.met\.no\/weatherapi\/locationforecast\/2\.0\/compact\?lat=\d+\.\d{1,4}&lon=\d+\.\d{1,4}&altitude=\d+$/);
  assert.ok(KEEP_SECONDS >= 3 * 3600);
  const route = read("pages/api/meteo.js");
  assert.ok(route.includes("s-maxage=${KEEP_SECONDS}") && route.includes('"User-Agent"'));
  /* The page asks its own site: the content security policy stays closed. */
  const js = read("public/meteo.js");
  assert.ok(js.includes('fetch("/api/meteo/")') && !js.includes("met.no"));
  for (const h of JSON.parse(read("server.config.json")).headers)
    for (const x of h.headers) if (x.key === "Content-Security-Policy") assert.ok(!x.value.includes("met.no"));
  /* The source is credited where the forecast is shown. */
  assert.ok(T.weatherBlock().includes("MET Norway") && T.skyBar().includes("MET Norway"));
});

test("the page script shows the hour of the visit and leaves the default line otherwise", async () => {
  const vm = await import("node:vm");
  const run = async (answer, nowIso) => {
    const parts = { ".weather-now": { textContent: "" }, ".weather-message": { textContent: "défaut" }, ".weather-credit": { hidden: true } };
    const box = { dataset: { weather: "idle" }, querySelector: (s) => parts[s] };
    const RealDate = Date;
    vm.runInNewContext(read("public/meteo.js"), {
      location: { pathname: "/guides/x/", hash: "" },
      navigator: {},
      window: { addEventListener() {} },
      document: { querySelectorAll: (s) => (s === "[data-weather]" ? [box] : []) },
      fetch: async () => answer,
      Date: class extends RealDate {
        static now() {
          return RealDate.parse(nowIso);
        }
      },
    });
    await new Promise((r) => setTimeout(r, 10));
    return { box, parts };
  };
  const hours = [
    { at: "2026-11-24T14:00:00.000Z", temp: 5, icon: "rain", message: "Pluie" },
    { at: "2026-11-24T15:00:00.000Z", temp: 3, icon: "cloudy", message: "Frais" },
    { at: "2026-11-24T16:00:00.000Z", temp: -1, icon: "night", message: "Gel" },
  ];
  const ok = { ok: true, json: async () => ({ ok: true, hours }) };
  let out = await run(ok, "2026-11-24T15:40:00Z");
  assert.equal(out.box.dataset.weather, "cloudy");
  assert.equal(out.parts[".weather-now"].textContent, " · 3 °C");
  assert.equal(out.parts[".weather-message"].textContent, "Frais");
  assert.equal(out.parts[".weather-credit"].hidden, false);
  /* Kept beyond its hours, or refused: the default line stays. */
  for (const [answer, now] of [
    [ok, "2026-11-24T19:30:00Z"],
    [{ ok: false }, "2026-11-24T15:40:00Z"],
    [{ ok: true, json: async () => ({ ok: true, hours: [] }) }, "2026-11-24T15:40:00Z"],
  ]) {
    out = await run(answer, now);
    assert.equal(out.box.dataset.weather, "idle");
    assert.equal(out.parts[".weather-message"].textContent, "défaut");
    assert.equal(out.parts[".weather-credit"].hidden, true);
  }
});
