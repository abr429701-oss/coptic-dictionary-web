// عامل الويب (Web Worker): سحب القاموس من الشيت مباشرة، بناء الفهرس، وتنفيذ البحث.
// كل شيء يحدث هنا خارج خيط الواجهة، لذلك لا تتجمد الصفحة أبدًا.
import { normalize, hasCoptic, hasArabic, hasGreek, parseCSV, buildRecords } from "./lib.js";

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/14pUNXtrHoMSU9lBWhKQZyspe-DDTMDudSiuL2sJQRUI/export?format=csv";
const CACHE_NAME = "coptic-dict-v3";
const CACHE_TTL = 12 * 60 * 60 * 1000; // ساعة وثانيتا عشر
const MAX_RESULTS = 60;

let records = [];
let byNorm = new Map();   // كلمة قبطية موحّدة -> فهارس السجلات المطابقة
let prefix = new Map();   // بادئة موحّدة -> فهارس (تُبنى مرة واحدة)
let countReady = 0;

self.onmessage = async (event) => {
  const { id, op } = event.data;
  try {
    switch (op) {
      case "boot": await boot(id); break;
      case "search": post({ id, reply: search(event.data.query) }); break;
      default: post({ id, error: "عملية غير معروفة" });
    }
  } catch (error) {
    post({ id, error: String(error?.message ?? error) });
  }
};

function post(message) { self.postMessage(message); }

function progress(stage, detail) { post({ type: "progress", stage, detail }); }

async function boot(id) {
  try {
    progress("cache", "يبحث في النسخة المحلية…");
    const cached = await readCache();
    if (cached) {
      records = cached;
      buildIndexes();
      post({ type: "ready", count: countReady, cached: true });
      post({ id, ok: true, cached: true });
      refreshInBackground(); // تحديث صامت من الشيت لنسخة الاستخدام القادم
      return;
    }
    progress("sheet", "يجلب القاموس من المصدر (أول مرة فقط)…");
    const text = await fetchSheet();
    records = buildRecords(parseCSV(text));
    if (records.length < 8000) throw new Error("بيانات ناقصة من الشيت");
    await writeCache(text);
    buildIndexes();
    post({ type: "ready", count: countReady, cached: false });
    post({ id, ok: true, cached: false });
  } catch (error) {
    post({ id, error: String(error?.message ?? error) });
    post({ type: "boot-error", message: String(error?.message ?? error) });
  }
}

async function fetchSheet() {
  const response = await fetch(SHEET_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`تعذّر تنزيل الشيت (${response.status})`);
  return response.text();
}

// ذاكرة مؤقتة في IndexedDB مع مدة صلاحية.
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CACHE_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("kv");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readCache() {
  try {
    const db = await openDB();
    const entry = await new Promise((resolve, reject) => {
      const tx = db.transaction("kv", "readonly").objectStore("kv").get("csv");
      tx.onsuccess = () => resolve(tx.result);
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    if (!entry || Date.now() - entry.t > CACHE_TTL) return null;
    progress("parse", "يعالج النسخة المحلية…");
    const recs = buildRecords(parseCSV(entry.csv));
    return recs.length >= 8000 ? recs : null;
  } catch { return null; }
}

async function writeCache(csv) {
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put({ t: Date.now(), csv }, "csv");
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch { /* الذاكرة غير متاحة — نكمل بدونها */ }
}

async function refreshInBackground() {
  try {
    const text = await fetchSheet();
    const fresh = buildRecords(parseCSV(text));
    if (fresh.length < 8000) return;
    await writeCache(text);
    records = fresh;
    buildIndexes();
    post({ type: "ready", count: countReady, cached: false, refreshed: true });
  } catch { /* نحتفظ بالنسخة القديمة */ }
}

function buildIndexes() {
  byNorm = new Map();
  prefix = new Map();
  countReady = records.length;
  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    // توحيد كل الحقول مرة واحدة عند البناء — البحث لاحقًا مجرد includes على نصوص جاهزة.
    rec._n = {
      ar: rec.ar ? normalize(rec.ar) : "",
      en: rec.en ? normalize(rec.en) : "",
      fr: rec.fr ? normalize(rec.fr) : "",
      de: rec.de ? normalize(rec.de) : "",
      greek: rec.greek ? normalize(rec.greek) : "",
    };
    if (!rec.coptic) continue;
    // الفهرسة على مستوى الكلمة: الكلمة وحدها + أول كلمة من العبارة.
    const firstWord = normalize(rec.coptic.split(/\s+/u)[0]);
    if (!firstWord || firstWord.length < 2) continue;
    if (!byNorm.has(firstWord)) byNorm.set(firstWord, []);
    byNorm.get(firstWord).push(i);
    for (let cut = 2; cut <= firstWord.length; cut++) {
      const p = firstWord.slice(0, cut);
      let bucket = prefix.get(p);
      if (!bucket) prefix.set(p, (bucket = []));
      bucket.push(i);
    }
  }
}

function search(rawQuery) {
  const started = performance.now();
  const query = normalize(rawQuery);
  if (!query) return { empty: true };

  const tokens = query.split(/\s+/u).filter(Boolean);
  // اختيار لغة البحث تلقائيًا
  const mode = hasCoptic(rawQuery) ? "coptic" : hasArabic(rawQuery) ? "arabic" : hasGreek(rawQuery) ? "greek" : "latin";

  if (mode === "coptic") {
    // أفضل التطابقات: كلمات القبطي تبدأ بأول مدخل من المستخدم.
    const scores = new Map();
    for (const token of tokens) {
      const exact = byNorm.get(token);
      if (exact) for (const i of exact) bump(scores, i, 100);
      const bucket = prefix.get(token);
      if (bucket) for (const i of bucket) bump(scores, i, token.length >= query.length ? 60 : 40);
    }
    const list = rank(scores, (a, b) => a - b);
    return finish(list, mode, started);
  }

  // عربي / لاتيني / يوناني: مسح خطي على حقول موحّدة مسبقًا — ملّي ثوانٍ قليلة على ١٦ ألف مدخل.
  const field = mode === "arabic" ? "ar" : mode === "greek" ? "greek" : null;
  const scores = new Map();
  if (field) {
    for (let i = 0; i < records.length; i++) {
      const n = records[i]._n?.[field];
      if (!n) continue;
      if (n === query) bump(scores, i, 100);
      else {
        let hit = 0;
        for (const token of tokens) if (n.includes(token)) hit++;
        if (hit) bump(scores, i, n.includes(query) ? 50 : hit * 20);
      }
    }
  } else {
    for (let i = 0; i < records.length; i++) {
      const n = records[i]._n;
      if (!n) continue;
      let hit = 0;
      if (n.en.includes(query)) hit += 2;
      if (n.fr.includes(query)) hit += 1;
      if (n.de.includes(query)) hit += 1;
      if (hit) bump(scores, i, hit * 25);
    }
  }
  return finish(rank(scores), mode, started);
}

function bump(map, i, score) {
  map.set(i, (map.get(i) ?? 0) + score);
}

function rank(scores, tiebreak) {
  const list = [...scores.entries()];
  list.sort((a, b) => (b[1] - a[1]) || (tiebreak ? tiebreak(a[0], b[0]) : a[0] - b[0]));
  return list.slice(0, MAX_RESULTS).map(([i]) => i);
}

function finish(indices, mode, started) {
  return {
    mode,
    tookMs: Math.round(performance.now() - started),
    total: indices.length,
    results: indices.map((i) => {
      const rec = records[i];
      const translations = [];
      if (rec.en) translations.push({ label: "EN", text: rec.en });
      if (rec.fr) translations.push({ label: "FR", text: rec.fr });
      if (rec.de) translations.push({ label: "DE", text: rec.de });
      if (rec.greek) translations.push({ label: "اليونانية", text: rec.greek });
      return {
        coptic: rec.coptic,
        ipa: rec.ipa,
        meaning: pickMeaning(rec),
        kind: rec.kind,
        gender: rec.gender,
        origin: rec.origin,
        translations,
      };
    }),
  };
}

// المعنى يُعرض عربيًا أولًا (جمهور القاموس عربي)، ثم بدائل بلغات أخرى.
function pickMeaning(rec) { return rec.ar || rec.en || rec.fr || rec.de || rec.greek || ""; }
