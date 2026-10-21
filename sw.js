/* Metais Nobres · VERI — service worker (PWA)
   Estratégia:
   - Supabase (dados): sempre rede, nunca cacheia.
   - Navegação (abrir o app): rede primeiro (pega a versão nova); offline usa o cache.
   - Demais recursos (CDN, fontes, ícones): cache primeiro, atualiza em 2º plano. */
const CACHE = 'mn-app-v1';
const CORE = ['./', './index.html', './manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(CORE).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (_) { return; }

  // Dados do Supabase: sempre rede, jamais cache
  if (url.hostname.endsWith('supabase.co')) {
    e.respondWith(fetch(req));
    return;
  }

  // Abrir o app: rede primeiro, cai pro cache quando offline
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put('./index.html', cp)); return r; })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // Recursos estáticos (CDN, fontes, ícones): cache primeiro + atualização em 2º plano
  e.respondWith(
    caches.match(req).then(cached => {
      const net = fetch(req).then(r => {
        if (r && r.status === 200) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
        return r;
      }).catch(() => cached);
      return cached || net;
    })
  );
});
