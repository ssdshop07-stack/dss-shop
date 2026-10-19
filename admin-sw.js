const CACHE_NAME = "dss-admin-shell-v1";
const SHELL = [
  "./admin.html",
  "./admin-manifest.json",
  "./favicon.svg",
  "./favicon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith("dss-admin-shell-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Always fetch admin logic and configuration fresh; never cache credentials or API responses.
  if (/\/(admin\.js|config\.js)$/.test(url.pathname)) return;

  if (request.mode === "navigate" && url.pathname.endsWith("/admin.html")) {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("./admin.html", copy));
        }
        return response;
      }).catch(() => caches.match("./admin.html"))
    );
  }
});
