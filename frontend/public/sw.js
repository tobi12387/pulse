const OFFLINE_HTML = `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Pulse offline</title>
    <style>
      body{margin:0;background:#f4f7f3;color:#14201e;font-family:system-ui,sans-serif;display:grid;min-height:100vh;place-items:center;padding:24px}
      main{max-width:380px;border:1px solid #d2ddd6;border-radius:8px;background:#fff;padding:20px;box-shadow:0 18px 46px rgba(34,49,42,.10)}
      .label{margin:0 0 8px;color:#0d927f;font-family:monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase}
      h1{font-size:20px;margin:0 0 8px}
      p{color:#8b95a3;font-size:13px;line-height:1.5;margin:0}
      ul{color:#8b95a3;font-size:13px;line-height:1.5;margin:14px 0 0;padding-left:18px}
      a{display:inline-block;margin-top:16px;min-height:40px;padding:10px 12px;border:1px solid #5ee6cf;border-radius:5px;color:#5ee6cf;text-decoration:none;font-family:monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase}
    </style>
  </head>
  <body>
    <main>
      <p class="label">Lokaler Zugriff</p>
      <h1>Pulse ist offline</h1>
      <p>Die App ist installiert, aber der lokale Server oder die VPN-Verbindung ist gerade nicht erreichbar.</p>
      <ul>
        <li>VPN oder WLAN prüfen.</li>
        <li>Lokalen Pulse-Server starten oder später erneut öffnen.</li>
      </ul>
      <a href="/">Neu laden</a>
    </main>
  </body>
</html>`;

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;

  event.respondWith(
    fetch(event.request).catch(() => new Response(OFFLINE_HTML, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })),
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
