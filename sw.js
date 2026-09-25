/* 코스모 스트라이커 — 서비스 워커
   · 앱 껍데기(HTML·아이콘·매니페스트)를 캐시해 두 번째부터는 인터넷 없이도 실행된다.
   · 순위표(Firestore)와 Firebase SDK는 캐시하지 않는다 — 항상 최신이어야 하고,
     끊겨 있으면 게임 쪽에서 알아서 '이 기기' 기록만 보여 준다.
   · 버전을 올리면(CACHE 이름 변경) 새 파일을 받아 간다. */
const CACHE = 'cosmo-striker-v1';

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-192.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())   // 한 파일이 실패해도 설치는 진행
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 다른 도메인(Firebase SDK, Firestore, 폰트 등)은 건드리지 않는다
  if (url.origin !== self.location.origin) return;

  // HTML은 네트워크 우선 — 새 버전을 바로 받되, 끊기면 캐시로
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // 나머지 같은 도메인 자원은 캐시 우선, 없으면 받아서 캐시
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res && res.status === 200 && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }))
  );
});
