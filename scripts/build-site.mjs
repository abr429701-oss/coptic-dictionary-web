// يبني الموقع كاملًا (الفهرس المجزّأ + الملفات الثابتة) من data/dictionary.json إلى مجلد الإخراج:
//   i/<مفتاح>.json  فهرس الكلمات (يُحمَّل ملف واحد لكل بحث)
//   d/<رقم>.json    تفاصيل المداخل (64 مدخلًا في الملف)
//   manifest.json   رقم النسخة وعدد المداخل
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { words, parts, shardKey } from "../js/norm.js";

const SRC = process.argv[2] || "data/dictionary.json";
const OUT = process.argv[3] || "_site";
const DETAIL_SIZE = 64;
const MAX_POSTINGS = 30; // أقصى عدد مداخل لكل كلمة (الباقي لا يفيد المستخدم)
// حقول البحث ورتبتها: كلما قلّ الرقم زادت الأولوية.
const FIELDS = [
  ["coptic", 0], ["meaning", 0],
  ["english", 1], ["translation_en", 1], ["translation_fr", 1], ["translation_de", 1],
  ["phonetic", 2], ["pronunciation", 2],
];

const records = JSON.parse(readFileSync(SRC, "utf8"));
rmSync(`${OUT}/i`, { recursive: true, force: true });
rmSync(`${OUT}/d`, { recursive: true, force: true });
mkdirSync(`${OUT}/i`, { recursive: true });
mkdirSync(`${OUT}/d`, { recursive: true });

// token -> Map(id -> bestRank)   (rank: 0 كلمة كاملة، 1 أول كلمة في عبارة، 2 كلمة داخل عبارة) + أولوية الحقل
const tokenMap = new Map();
const short = new Map(); // id -> عرض مختصر
const add = (token, id, rank) => {
  let rows = tokenMap.get(token);
  if (!rows) tokenMap.set(token, (rows = new Map()));
  const old = rows.get(id);
  if (old === undefined || rank < old) rows.set(id, rank);
};

// المفتاح هو رقم الصف (فريد). أما r.id فهو رقم ملف النطق وقد يتكرر لعدة صفوف.
records.forEach((r, id) => {
  const meanings = parts(r.meaning);
  short.set(id, [String(r.coptic || ""), (meanings.join("، ") || r.english || "").slice(0, 80)]);
  for (const [field, fieldRank] of FIELDS) {
    parts(r[field]).forEach((part, partIndex) => {
      const ws = words(part);
      ws.forEach((w, i) => {
        const position = ws.length === 1 ? 0 : i === 0 ? 1 : 2;
        // الرتبة (الأقل أفضل): موضع الكلمة داخل العبارة، ثم ترتيب المعنى (الأول أهم)، ثم نوع الحقل.
        add(w, id, position * 4 + Math.min(partIndex, 2) * 3 + fieldRank);
      });
    });
  }
});

// تجميع الكلمات في ملفات حسب أول حرفين. الملف الأكبر من الحد يُقسَّم حسب أول ثلاثة أحرف.
const SPLIT_LIMIT = 90_000;
const groups = new Map();
for (const [token, rows] of tokenMap) {
  const key = shardKey(token);
  const list = [...rows].sort((a, b) => a[1] - b[1] || a[0] - b[0]).slice(0, MAX_POSTINGS);
  let group = groups.get(key);
  if (!group) groups.set(key, (group = []));
  group.push([token, list]);
}

const serialize = (entries) => {
  const t = {};
  const r = {};
  for (const [token, list] of entries) {
    t[token] = list.flat();
    for (const [id] of list) r[id] = short.get(id);
  }
  return JSON.stringify({ t, r });
};
const keys = [];
let bytes = 0;
const write = (key, body) => { writeFileSync(`${OUT}/i/${key}.json`, body); keys.push(key); bytes += body.length; };

// يكتب مجموعة كلمات تحت مفتاح؛ إن زادت عن الحد تُقسَّم حسب الحرف التالي (حتى 5 أحرف).
function place(key, entries, size) {
  const body = serialize(entries);
  if (body.length <= SPLIT_LIMIT || size >= 5) { write(key, body); return; }
  const long = entries.filter(([token]) => [...token].length > size);
  const head = entries.filter(([token]) => [...token].length <= size)
    .concat([...long].sort((a, b) => a[1][0][1] - b[1][0][1] || a[0].length - b[0].length).slice(0, 80));
  write(key, serialize(head));
  const sub = new Map();
  for (const entry of long) {
    const next = shardKey(entry[0], size + 1);
    if (!sub.has(next)) sub.set(next, []);
    sub.get(next).push(entry);
  }
  for (const [next, list] of sub) place(next, list, size + 1);
}
for (const [key, entries] of groups) place(key, entries, 2);

const details = {};
records.forEach((r, n) => {
  const block = Math.floor(n / DETAIL_SIZE);
  (details[block] ??= {})[n] = [r.coptic, r.greek, r.pronunciation, r.english, r.phonetic, r.kind, r.gender, r.origin, r.translation_en, r.translation_fr, r.translation_de, r.meaning, r.id ?? ""];
});
for (const [block, rows] of Object.entries(details)) writeFileSync(`${OUT}/d/${block}.json`, JSON.stringify(rows));

const hash = createHash("sha1").update(readFileSync(SRC)).digest("hex").slice(0, 10);
const manifest = { v: hash, n: records.length, detailSize: DETAIL_SIZE, k: keys.sort() };
writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest));

// ---- الملفات الثابتة (مع ختم رقم النسخة داخلها) ----
const build = createHash("sha1");
for (const file of ["index.html", "sw.js", "css/app.css", ...readdirSync("js").filter((f) => f.endsWith(".js")).map((f) => `js/${f}`)]) build.update(readFileSync(file));
const B = build.update(hash).digest("hex").slice(0, 10);
mkdirSync(`${OUT}/js`, { recursive: true });
mkdirSync(`${OUT}/css`, { recursive: true });
for (const file of readdirSync("js").filter((f) => f.endsWith(".js"))) writeFileSync(`${OUT}/js/${file}`, readFileSync(`js/${file}`, "utf8").replaceAll("__B__", B));
cpSync("css/app.css", `${OUT}/css/app.css`);
cpSync("sw.js", `${OUT}/sw.js`);
cpSync("manifest.webmanifest", `${OUT}/manifest.webmanifest`);
for (const dir of ["fonts", "assets", "audio-human"]) if (existsSync(dir)) cpSync(dir, `${OUT}/${dir}`, { recursive: true });
writeFileSync(`${OUT}/index.html`, readFileSync("index.html", "utf8").replaceAll("__B__", B).replace("null; /*MANIFEST*/", `${JSON.stringify(manifest)};`));
writeFileSync(`${OUT}/.nojekyll`, "");
console.log(`build=${B} records=${records.length} tokens=${tokenMap.size} shards=${keys.length} indexBytes=${bytes} detailBlocks=${Object.keys(details).length} v=${hash}`);
