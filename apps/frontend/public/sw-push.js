// Service Worker Web-Push Handler for HeimspielRadar

self.addEventListener('push', (event) => {
  if (!event.data) {
    return;
  }

  let payload = {};

  try {
    payload = event.data.json();
  } catch {
    payload = {
      title: 'HeimspielRadar 🏀',
      body: event.data.text(),
    };
  }

  const title = payload.title || 'HeimspielRadar 🏀';
  const matchId = payload.matchId;
  const targetUrl = payload.url || (matchId ? `/matches/${matchId}` : '/');

  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icon-192.png',
    badge: payload.badge || '/icon-192.png',
    tag: payload.tag || (matchId ? `match-reminder-${matchId}` : 'heimspiel-push'),
    data: {
      url: targetUrl,
      matchId: matchId,
    },
    requireInteraction: payload.requireInteraction ?? false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification?.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          if ('navigate' in client && targetUrl) {
            client.navigate(targetUrl);
          }

          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    }),
  );
});
