const CACHE = 'eonyang-exhibition-v4';
const ROOT = new URL('./', self.location.href);
const INDEX = new URL('index.html', ROOT).href;
const STYLE = new URL('assets/css/newsletter-v2.css', ROOT).href;
const ARCHIVE_STYLE = new URL('assets/css/heritage-archive.css', ROOT).href;
const CLIENT = new URL('assets/js/exhibition-v2.js', ROOT).href;
const PHOTOS = [
  'https://upload.wikimedia.org/wikipedia/commons/5/53/View_of_downtown_Eonyang.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/%EC%9A%B8%EC%A3%BC_%EB%8C%80%EA%B3%A1%EB%A6%AC_%EB%B0%98%EA%B5%AC%EB%8C%80_%EC%95%94%EA%B0%81%ED%99%94.jpg/960px-%EC%9A%B8%EC%A3%BC_%EB%8C%80%EA%B3%A1%EB%A6%AC_%EB%B0%98%EA%B5%AC%EB%8C%80_%EC%95%94%EA%B0%81%ED%99%94.jpg'
];
const CORE = [ROOT.href, STYLE, ARCHIVE_STYLE, CLIENT];

function valid(response, key) {
  if (!response.ok || (response.url && !response.url.startsWith(ROOT.href))) return false;
  const mime = response.headers.get('content-type') || '';
  if (key === ROOT.href) return mime.includes('text/html');
  if (key === STYLE || key === ARCHIVE_STYLE) return mime.includes('text/css');
  return /(?:java|ecma)script/.test(mime);
}

async function offlineCore() {
  const cache = await caches.open(CACHE);
  const responses = await Promise.all(CORE.map(async url => {
    const response = await fetch(url, {cache: 'reload', signal: AbortSignal.timeout(6500)});
    if (!valid(response, url)) throw new Error('핵심 파일을 받지 못했습니다.');
    return response;
  }));
  await Promise.all(responses.map((response, i) => cache.put(CORE[i], response)));
  return cache;
}

self.addEventListener('install', event => event.waitUntil(offlineCore().then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('message', event => {
  if (event.data !== 'SAVE_EXHIBITION' || !event.ports[0]) return;
  const port = event.ports[0];
  async function save() {
    try {
      const cache = await offlineCore();
      const saved = await Promise.all(PHOTOS.map(async url => {
        if (await cache.match(url)) return true;
        try {
          const response = await fetch(url, {mode: 'cors', signal: AbortSignal.timeout(4500)});
          if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) return false;
          await cache.put(url, response);
          return true;
        } catch { return false; }
      }));
      port.postMessage({ok: true, photos: saved.filter(Boolean).length, total: PHOTOS.length});
    } catch { port.postMessage({ok: false}); }
  }
  event.waitUntil(save());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const clean = url.origin + url.pathname;
  const key = (clean === ROOT.href || clean === INDEX) && event.request.mode === 'navigate' ? ROOT.href : clean;
  if (CORE.includes(key)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const saved = await cache.match(key);
      // CSS/JS should be usable immediately even on slow exhibition Wi-Fi.
      if (key !== ROOT.href && saved) return saved;
      try {
        const fresh = await fetch(event.request, {signal: AbortSignal.timeout(2400)});
        if (valid(fresh, key)) {
          await cache.put(key, fresh.clone());
          return fresh;
        }
        return saved || fresh;
      } catch { return saved || Response.error(); }
    })());
  } else if (PHOTOS.includes(url.href) && event.request.destination === 'image') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      return await cache.match(url.href) || await caches.match(url.href) || fetch(event.request);
    })());
  }
});
