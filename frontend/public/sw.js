self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;

  event.respondWith(
    fetch(event.request).catch(() => new Response(
      '<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pulse offline</title><style>body{margin:0;background:#0a0b0d;color:#e8ecf1;font-family:system-ui,sans-serif;display:grid;min-height:100vh;place-items:center;padding:24px}main{max-width:360px}h1{font-size:18px;margin:0 0 8px}p{color:#8b95a3;font-size:13px;line-height:1.5}</style></head><body><main><h1>Pulse ist offline</h1><p>Die App ist installiert, aber der lokale Server oder die VPN-Verbindung ist gerade nicht erreichbar.</p></main></body></html>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    )),
  );
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      data: { url: data.url ?? '/' },
      icon: '/favicon.svg',
      badge: '/favicon.svg',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const url = event.notification.data?.url ?? '/';
      const existing = wins.find((win) => win.url.includes(self.location.origin));
      if (existing) {
        existing.focus();
        return existing.navigate(url);
      }
      return clients.openWindow(url);
    }),
  );
});
