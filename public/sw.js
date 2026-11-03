// Fridgeboard service worker
// - Web Push notifications and notification click routing.
// - Offline fallback: if a page can't load (no network), show offline.html,
//   which renders the last-known board saved on this device. Everything else
//   goes straight to the network; nothing else is cached.

const CACHE = "fridgeboard-offline-v2";
const OFFLINE_ASSETS = ["/offline.html", "/icon-192.png"];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(OFFLINE_ASSETS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) { return key !== CACHE; }).map(function (key) {
          return caches.delete(key);
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function (event) {
  const request = event.request;
  if (request.method !== "GET") return;
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(function () {
        return caches.match("/offline.html");
      })
    );
    return;
  }
  // The offline page's own assets (its icon): network first, cache if offline.
  const path = new URL(request.url).pathname;
  if (OFFLINE_ASSETS.indexOf(path) !== -1) {
    event.respondWith(
      fetch(request).catch(function () {
        return caches.match(path);
      })
    );
  }
});

self.addEventListener("push", function (event) {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Fridgeboard", body: event.data.text() };
  }

  const options = {
    body: payload.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: payload.tag || "fridgeboard",
    renotify: true,
    data: { url: payload.url || "/list" },
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || "Fridgeboard", options)
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const url = event.notification.data?.url || "/list";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (clientList) {
        for (const client of clientList) {
          if ("focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});
