/* Service worker for web-push notifications (business-owner alerts).
 * Registered from the dashboard notifications watcher. Shows RTL Hebrew
 * notifications and deep-links into the relevant dashboard page on click. */

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "עדכון חדש בעסק", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "עדכון חדש בעסק";
  const options = {
    body: payload.body || "",
    dir: "rtl",
    lang: "he",
    icon: "/favicon.ico",
    data: { url: payload.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windows) => {
        for (const client of windows) {
          if ("focus" in client) {
            if ("navigate" in client) {
              return client.focus().then((focused) => focused.navigate(url));
            }
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      }),
  );
});
