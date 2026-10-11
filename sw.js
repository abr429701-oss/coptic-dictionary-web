// يخزّن ملفات الفهرس والتفاصيل والخطوط محليًا: الزيارات التالية والكلمات المتكررة تعمل فورًا وبدون إنترنت.
// رقم النسخة (v) يأتي من عنوان هذا الملف، فيتغيّر الكاش تلقائيًا كلما تغيّر القاموس.
const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const CACHE = `khmi-${VERSION}`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !/\/(i|d|fonts)\//u.test(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(request);
    if (hit) return hit;
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  })());
});
