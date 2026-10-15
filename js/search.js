// عميل البحث: لا يحمّل القاموس كله، بل ملف الفهرس الصغير الذي يخص ما تكتبه فقط.
import { words, parts, pickKey } from "./norm.js";

const MAX_RESULTS = 40;
const shardCache = new Map();   // مفتاح الملف -> Promise
const detailCache = new Map();  // رقم المجموعة -> Promise
let manifest = null;
let keys = null;

export async function init() {
  manifest = window.__MANIFEST__;
  if (!manifest) {
    const response = await fetch("manifest.json", { cache: "no-cache" });
    manifest = await response.json();
  }
  keys = new Set(manifest.k ?? []);
  return manifest;
}
export const count = () => manifest?.n ?? 0;

const url = (path) => `${path}?v=${manifest.v}`;
async function getJSON(path) {
  const response = await fetch(url(path));
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function loadShard(key) {
  if (!keys.has(key)) return Promise.resolve(null);
  let promise = shardCache.get(key);
  if (!promise) {
    promise = getJSON(`i/${key}.json`).catch((error) => {
      shardCache.delete(key);
      throw error;
    });
    shardCache.set(key, promise);
  }
  return promise;
}

// يجمع مرشحي كلمة واحدة: id -> نقاط (الأقل أفضل) من ملف الفهرس.
function candidates(shard, word, prefix) {
  const found = new Map();
  if (!shard) return found;
  for (const token in shard.t) {
    const exact = token === word;
    if (!exact && !(prefix && token.startsWith(word))) continue;
    const base = exact ? 0 : 1000 + Math.min(token.length - word.length, 20) * 30;
    const list = shard.t[token];
    for (let i = 0; i < list.length; i += 2) {
      const score = base + list[i + 1];
      const old = found.get(list[i]);
      if (old === undefined || score < old) found.set(list[i], score);
    }
  }
  return found;
}

export async function search(query) {
  const ws = words(query);
  if (!ws.length) return { results: [], total: 0 };
  const uniq = [...new Set(ws)].slice(0, 5);
  const shards = await Promise.all(uniq.map((w) => loadShard(pickKey(w, keys))));
  let merged = null;
  const records = {};
  uniq.forEach((word, index) => {
    const isLast = index === uniq.length - 1;
    const found = candidates(shards[index], word, isLast);
    Object.assign(records, shards[index]?.r);
    if (!merged) { merged = found; return; }
    const next = new Map();
    for (const [id, score] of found) if (merged.has(id)) next.set(id, merged.get(id) + score);
    merged = next;
  });
  const rows = [...merged].map(([id, score]) => ({ id, score, rec: records[id] })).filter((row) => row.rec);
  rows.sort((a, b) => a.score - b.score || a.rec[0].length - b.rec[0].length || a.id - b.id);
  return {
    total: rows.length,
    results: rows.slice(0, MAX_RESULTS).map(({ id, rec }) => ({ id, coptic: rec[0], meaning: rec[1] })),
  };
}

// تفاصيل مدخل واحد (مجموعة من 64 مدخلًا في ملف واحد، تُخزَّن في الذاكرة).
const FIELDS = ["coptic", "greek", "pronunciation", "english", "phonetic", "kind", "gender", "origin", "translation_en", "translation_fr", "translation_de", "meaning", "aid", "referenceMatches"];
export async function detail(id) {
  const block = Math.floor(Number(id) / manifest.detailSize);
  let promise = detailCache.get(block);
  if (!promise) {
    promise = getJSON(`d/${block}.json`).catch((error) => {
      detailCache.delete(block);
      throw error;
    });
    detailCache.set(block, promise);
  }
  const row = (await promise)[id];
  if (!row) return null;
  const record = { row: Number(id) };
  FIELDS.forEach((field, i) => { record[field] = row[i] ?? ""; });
  record.aid = record.aid === "" ? null : Number(record.aid);
  record.meanings = parts(record.meaning);
  return record;
}

// يرتّب معاني النتيجة بحيث يظهر المعنى المطابق للبحث أولًا، ويعلّمه (matched=true).
export function matchParts(meaning, query) {
  const needles = words(query);
  const list = parts(meaning).map((text) => {
    const tokens = words(text);
    const matched = needles.length > 0 && needles.every((n, i) => tokens.some((t) => t === n || (i === needles.length - 1 && t.startsWith(n))));
    return { text, matched };
  });
  return [...list.filter((p) => p.matched), ...list.filter((p) => !p.matched)];
}
