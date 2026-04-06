// Service Worker for Web Push Notifications

self.addEventListener("push", function (event) {
  if (!event.data) return;

  var data;
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: "CHIP B2B", body: event.data.text() };
  }

  var options = {
    body: data.body || "",
    icon: "/favicon.png",
    badge: "/favicon.png",
    tag: data.tag || undefined,
    data: { url: data.url || "/" },
  };

  if (data.image) {
    options.image = data.image;
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "CHIP B2B", options)
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  var url = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (clientList) {
        for (var i = 0; i < clientList.length; i++) {
          var client = clientList[i];
          if (client.url.indexOf(self.location.origin) !== -1) {
            client.focus();
            client.navigate(url);
            return;
          }
        }
        return clients.openWindow(url);
      })
  );
});
