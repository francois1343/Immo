const CACHE = "martin-immo-v4";
const FILES = [
  "/",
  "/index.html",
  "/site.css",
  "/site.js",
  "/fonts.css",
  "/manifest.webmanifest",
  "/assets/icon-192.png",
  "/assets/icon-512.png",
  "/assets/icon-maskable-192.png",
  "/assets/icon-maskable-512.png",
  "/estimation/",
  "/preparer-ma-vente/",
  "/vendre-beaumont-barbencon/",
  "/Back/estimation.html",
  "/Back/formulaire.html",
  "/politique-confidentialite.html",
  "/mentions-legales.html",
  "/legal.css",
  "/assets/ms.jpg",
  "/assets/logo-connexion.png",
  "/assets/favicon-32.png",
  "/assets/fonts/manrope-latin-variable.woff2",
  "/assets/fonts/lora-latin-variable.woff2",
];
self.addEventListener("install", (e) =>
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))),
);
self.addEventListener("activate", (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("martin-immo-") && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      ),
  ),
);
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (
    e.request.method !== "GET" ||
    u.origin !== location.origin ||
    !FILES.includes(u.pathname)
  )
    return;
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        if (r.ok && r.type === "basic") {
          const copy = r.clone();
          e.waitUntil(
            caches
              .open(CACHE)
              .then((c) => c.put(u.pathname, copy))
              .catch(() => {}),
          );
        }
        return r;
      })
      .catch(() =>
        caches
          .match(u.pathname)
          .then(
            (r) =>
              r ||
              new Response("Page indisponible hors connexion", { status: 503 }),
          ),
      ),
  );
});
