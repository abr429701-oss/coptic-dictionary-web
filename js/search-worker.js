import { CONFIG } from "./config.js";
import { init, recordCount, search, warmupSteps } from "./engine.js?v=fast1";

const actions = new Map();
let nextActionId = 0;

async function fetchDictionary() {
  const baseUrl = new URL(`../${CONFIG.DICTIONARY_URL}`, import.meta.url);
  const compressedUrl = new URL(`${baseUrl.href}.gz`);
  let cache = null;
  let cached = null;
  let cacheStamp = null;

  try {
    cache = await caches.open("coptic-dictionary-data-v1");
    cached = await cache.match(compressedUrl.href);
    const stampResponse = await cache.match(`${compressedUrl.href}?cache-stamp=1`);
    cacheStamp = stampResponse ? Number(await stampResponse.text()) : 0;
  } catch {
    // Cache Storage can be unavailable in private browsing; network loading still works.
  }

  const decode = async (response) => {
    if (typeof DecompressionStream !== "function") throw new Error("gzip decompression is not supported");
    const stream = response.body.pipeThrough(new DecompressionStream("gzip"));
    return new Response(stream).json();
  };

  const refresh = async () => {
    const response = await fetch(compressedUrl, { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (cache) {
      await cache.put(compressedUrl.href, response.clone());
      await cache.put(`${compressedUrl.href}?cache-stamp=1`, new Response(String(Date.now())));
    }
    return response;
  };

  // من الكاش فورًا، ويُحدَّث في الخلفية للزيارة القادمة (إن مرّت أكثر من 10 دقائق).
  if (cached) {
    try {
      const data = await decode(cached.clone());
      if (Date.now() - cacheStamp >= 10 * 60 * 1000) refresh().catch(() => {});
      return data;
    } catch { /* الكاش تالف: حمّل من الشبكة */ }
  }

  try {
    return await decode(await refresh());
  } catch (compressedError) {
    // Fallback supports older browsers and local development without the generated .gz file.
    try {
      const response = await fetch(baseUrl, { cache: "force-cache" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch {
      throw compressedError;
    }
  }
}

function serialize(value) {
  if (typeof value === "function") {
    const id = ++nextActionId;
    actions.set(id, value);
    return { __workerAction: id };
  }
  if (Array.isArray(value)) return value.map(serialize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, serialize(child)]));
}

try {
  const dictionary = await fetchDictionary();
  init(dictionary);
  self.postMessage({ type: "ready", count: recordCount() });
} catch (error) {
  self.postMessage({ type: "init-error", message: error?.message ?? "dictionary load failed" });
}

self.addEventListener("message", ({ data }) => {
  const { id, op } = data;
  try {
    let result;
    if (op === "search") {
      actions.clear();
      result = search(data.query);
    } else if (op === "action") {
      const action = actions.get(data.actionId);
      if (!action) throw new Error("انتهت صلاحية هذا الاختيار، أعد البحث من جديد.");
      actions.delete(data.actionId);
      result = action();
    } else {
      throw new Error(`Unknown operation: ${op}`);
    }
    self.postMessage({ id, result: serialize(result) });
  } catch (error) {
    self.postMessage({ id, error: error?.message ?? "search failed" });
  }
});

// بعد أن صار القاموس جاهزًا للبحث، تُبنى الفهارس في الخلفية خطوة خطوة (البحث يتقدّم عليها).
(async () => {
  for (const step of warmupSteps()) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    try { step(); } catch { /* تُبنى عند الحاجة */ }
  }
})();
