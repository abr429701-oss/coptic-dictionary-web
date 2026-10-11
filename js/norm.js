// تطبيع النص — مشترك بين أداة بناء الفهرس (Node) والمتصفح، لضمان تطابق المفاتيح تمامًا.
const ACCENT_MAP = { ὲ: "ⲉ", έ: "ⲉ", ὶ: "ⲓ", ί: "ⲓ", ὸ: "ⲟ", ό: "ⲟ", ὼ: "ⲱ", ώ: "ⲱ", ὴ: "ⲏ", ή: "ⲏ", ὰ: "ⲁ", ά: "ⲁ", ὺ: "ⲩ", ύ: "ⲩ" };
const ALEF_MAP = { أ: "ا", إ: "ا", آ: "ا", ٱ: "ا", ى: "ي", ة: "ه" };
const FOLD_MAP = { ...ALEF_MAP, ...ACCENT_MAP, "`": "" };
const MARKS = /[\u0300-\u036f\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/gu;
const FOLD = /[أإآٱىةὲέὶίὸόὼώὴήὰάὺύ`]/gu;
const PLAIN = /^[\x20-\x7e]*$/u;

export function normalize(value) {
  const text = String(value ?? "");
  if (PLAIN.test(text)) return text.toLowerCase().replace(/[`]/g, "").replace(/\s+/g, " ").trim();
  return text.normalize("NFKC").toLowerCase().replace(MARKS, "").replace(FOLD, (c) => FOLD_MAP[c] ?? "").replace(/\s+/gu, " ").trim();
}

// يقسّم النص المطبّع إلى كلمات (حروف وأرقام فقط).
export function words(value) {
  return normalize(value).replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/u).filter(Boolean).map(stem);
}

// يحذف "ال" التعريف من أول الكلمة العربية (الماء = ماء) حتى يجد البحث الصيغتين معًا.
const NOT_ARTICLE = new Set(["الله", "اللهم", "اللات"]);
export function stem(word) {
  return word.length >= 4 && word.startsWith("ال") && !NOT_ARTICLE.has(word) ? word.slice(2) : word;
}

// يقسّم حقل المعاني إلى معانٍ منفصلة (بالفاصلة العربية أو اللاتينية).
export function parts(value) {
  return String(value ?? "").split(/\s*[،,;؛]\s*/u).map((p) => p.trim()).filter(Boolean);
}

// اسم ملف الفهرس لكلمة: أول حرفين (أو حرف واحد) بالأكواد.
export function shardKey(word, size = 2) {
  const chars = [...word].slice(0, size);
  return chars.map((c) => c.codePointAt(0).toString(16)).join("_");
}

// يختار أطول مفتاح ملف موجود فعلًا (حتى 5 أحرف للملفات الكبيرة المجزّأة، وإلا 2، وإلا 1).
export function pickKey(word, keys) {
  for (const size of [5, 4, 3, 2, 1]) {
    if ([...word].length < size) continue;
    const key = shardKey(word, size);
    if (keys.has(key)) return key;
  }
  return shardKey(word, 2);
}
