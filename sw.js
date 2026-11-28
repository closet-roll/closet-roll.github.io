// ============================================================
// CLOSET ROLL Service Worker (v91)
// ------------------------------------------------------------
// 戦略（安全側）:
// - HTML（ナビゲーション）は network-first。ゲーム本体は単一HTMLで
// 版ごとに丸ごと差し替わるため、更新が即届くことを優先する。
// キャッシュはオフライン時のフォールバック専用。
// - 写真（photos/）は cache-first でオフライン表示と再訪高速化に
// 使うが、同名写真の差し替えがあり得る（v81 実績）ため、
// キャッシュ名にバージョン文字列を含め、版が上がったら
// activate で旧キャッシュを全て破棄する。
// - それ以外の同一オリジン GET は network-first（失敗時キャッシュ）。
// - 外部オリジン（アフィリエイトリンク先・フォント等）には一切
// 干渉しない。外部遷移はブラウザ標準の挙動に任せる。
//
// 版を上げるたびに下の SW_VERSION を必ず更新する
// こと（CHANGES-v83.md 参照）。更新し忘れると写真キャッシュが
// 前版のまま残る。
// ============================================================
const SW_VERSION = 'v93';
const HTML_CACHE = 'cr-html-' + SW_VERSION;
const PHOTO_CACHE = 'cr-photos-' + SW_VERSION;
const KNOWN_CACHES = [HTML_CACHE, PHOTO_CACHE];

self.addEventListener('install', (event) => {
// 新しい SW を即時有効化する（HTML は network-first なので、
// 待たせる意味がない）。
self.skipWaiting();
});

self.addEventListener('activate', (event) => {
event.waitUntil(
caches.keys()
.then((keys) => Promise.all(
keys.filter((k) => k.indexOf('cr-') === 0 && KNOWN_CACHES.indexOf(k) === -1)
.map((k) => caches.delete(k))
))
.then(() => self.clients.claim())
);
});

self.addEventListener('fetch', (event) => {
const req = event.request;
if (req.method!== 'GET') return;
const url = new URL(req.url);
if (url.origin!== self.location.origin) return; // 外部には干渉しない

if (req.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
// HTML: network-first
event.respondWith(
fetch(req)
.then((res) => {
const copy = res.clone();
caches.open(HTML_CACHE).then((c) => c.put('/', copy)).catch(() => {});
return res;
})
.catch(() => caches.open(HTML_CACHE).then((c) => c.match('/')))
);
return;
}

if (url.pathname.indexOf('/photos/') === 0) {
// 写真: cache-first（版付きキャッシュ名で差し替え事故を防ぐ）
event.respondWith(
caches.open(PHOTO_CACHE).then((cache) =>
cache.match(req).then((hit) => {
if (hit) return hit;
return fetch(req).then((res) => {
if (res && res.ok) {
const copy = res.clone();
cache.put(req, copy).catch(() => {});
}
return res;
});
})
)
);
return;
}

// その他の同一オリジン GET（manifest / アイコン / sw 自身は除く）:
// network-first、失敗時はキャッシュ。
if (url.pathname === '/sw.js') return;
event.respondWith(
fetch(req)
.then((res) => {
if (res && res.ok) {
const copy = res.clone();
caches.open(HTML_CACHE).then((c) => c.put(req, copy)).catch(() => {});
}
return res;
})
.catch(() => caches.match(req))
);
});
