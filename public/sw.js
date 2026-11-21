/* Service worker: shows daily reminder notifications (Web Push) and opens the app on click.
   It deliberately does no caching: offline support is out of MVP scope (PRD P2). */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = { title: "Your daily lessons are ready", body: "", url: "/today", tag: "daily" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    /* non-JSON payload: keep defaults */
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // Only open same-origin paths.
  const raw = (event.notification.data && event.notification.data.url) || "/today";
  const url = new URL(raw.startsWith("/") ? raw : "/today", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (new URL(w.url).origin === self.location.origin && "focus" in w) {
          w.navigate(url);
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
