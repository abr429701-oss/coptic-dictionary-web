// أدوات مشتركة لمعالجة النصوص وتحليل بيانات Google Sheet.
// تعمل داخل Web Worker أو في Node (للاختبار) بدون أي اعتماد على المتصفح.

const ACCENT_MAP = { "ὲ": "ⲉ", "έ": "ⲉ", "ὶ": "ⲓ", "ί": "ⲓ", "ὸ": "ⲟ", "ό": "ⲟ", "ὼ": "ⲱ", "ώ": "ⲱ", "ὴ": "ⲏ", "ή": "ⲏ", "ὰ": "ⲁ", "ά": "ⲁ", "ὺ": "ⲩ", "ύ": "ⲩ" };
const ALEF_MAP = { "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ى": "ي", "ة": "ه" };
const FOLD_RE = /[أإآٱىةὲέὶίὸόὼώὴήὰάὺύ`]/gu;
const MARKS_RE = /[\u0300-\u036f\u064b-\u065f\u0670\u0640]/gu;
const PLAIN_ASCII = /^[\x20-\x7e]*$/;

// توحيد النص: إزالة التشكيل (الجينكيم والتشكيل العربي)، وتوحيد الهمزات والتاء المربوطة.
export function normalize(value) {
  const text = String(value ?? "");
  if (PLAIN_ASCII.test(text)) return text.toLowerCase().replace(/\s+/gu, " ").trim();
  let out = text.normalize("NFKC").toLowerCase();
  out = out.replace(MARKS_RE, "");
  out = out.replace(FOLD_RE, (ch) => ALEF_MAP[ch] ?? ACCENT_MAP[ch] ?? "");
  return out.replace(/\s+/gu, " ").trim();
}

export function hasCoptic(s) { return /[\u2c80-\u2cff]/u.test(s); }
export function hasArabic(s) { return /[\u0600-\u06ff]/u.test(s); }
export function hasGreek(s) { return /[\u0370-\u03ff\u1f00-\u1fff]/u.test(s); }

// مفتاح هوية الكلمة (لربط ملفات النطق): الإملاء بعد تنظيفه، بلا حالة أحرف.
export function wordKey(coptic) {
  return String(coptic ?? "").normalize("NFC").toLowerCase().trim();
}

// تحويل الجينكيم المكتوب كشرطة مائلة قبل الحرف إلى حركة على الحرف نفسه.
const JINKIM = "\u0300";
const JINKIM_RE = /`(\p{L})/gu;
export function cleanCoptic(value) {
  return String(value ?? "")
    .replace(JINKIM_RE, (_m, letter) => letter + JINKIM)
    .replace(/\s+/gu, " ")
    .trim();
}

// فصل المعنى العربي عن الترجمات التي تلصقها معادلة الشيت بفواصل.
// مسار سريع: لو لا توجد ترجمة منصوصة داخل النص، نعيده كما هو (يوفّر ثوانٍ عند معالجة ١٦ ألف صف).
export function arabicMeaning(value, translations) {
  const text = String(value ?? "").trim();
  let dirty = false;
  for (const translation of translations) {
    if (translation && text.includes(translation)) { dirty = true; break; }
  }
  if (!dirty) return text;
  let out = text;
  for (const translation of translations) {
    if (!translation) continue;
    const escaped = translation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`(?:^|[،,]\\s*)${escaped}(?=\\s*(?:[،,]|$))`, "u"), "");
  }
  return out.split(/\s*[،,]\s*/u).map((part) => part.trim()).filter(Boolean).join("، ");
}

// محلل CSV يدعم الحقول المقتبسة والأسطر الجديدة داخلها — أسرع بكثير من المكتبات العامة.
export function parseCSV(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (ch !== "\r") field += ch;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// الأعمدة: 0 قبطي، 1 IPA، 2 عربي، 3 إنجليزي، 4 فرنسي، 5 ألماني، 6 يوناني، 7 نوع، 8 جنس، 9 أصل.
export function buildRecords(rows) {
  const records = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !row.length) continue;
    const cell = (n) => (n < row.length ? row[n].trim() : "");
    const rec = {
      coptic: cleanCoptic(cell(0)),
      ipa: cell(1),
      ar: arabicMeaning(cell(2), [cell(3), cell(4), cell(5)]),
      en: cell(3),
      fr: cell(4),
      de: cell(5),
      greek: cell(6),
      kind: cell(7),
      gender: cell(8),
      origin: cell(9),
    };
    if (!rec.coptic && !rec.ar && !rec.en && !rec.fr && !rec.de && !rec.greek) continue;
    records.push(rec);
  }
  return records;
}
