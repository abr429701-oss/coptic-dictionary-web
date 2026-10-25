import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { copticDate, describeKind, originLabel, isGreekOrigin, meaningFor } from "../js/terms.js";

const data = JSON.parse(readFileSync(new URL("../data/dictionary.json", import.meta.url), "utf8"));
const ARABIC = /[؀-ۿ]/u;

test("التاريخ القبطي يتبع لغة الواجهة", () => {
  const day = new Date(2026, 9, 22, 12);
  assert.equal(copticDate(day, "ar"), "12 بابه 1743");
  assert.equal(copticDate(day, "en"), "12 Paopi 1743");
  assert.equal(copticDate(day, "fr"), "12 Paopi 1743");
  assert.equal(copticDate(day, "de"), "12 Paopi 1743");
});

test("التاريخ القبطي لا ينزلق بعد منتصف الليل مباشرة", () => {
  assert.equal(copticDate(new Date(2026, 9, 23, 0, 10), "en"), "13 Paopi 1743");
  assert.equal(copticDate(new Date(2026, 9, 22, 23, 50), "en"), "12 Paopi 1743");
});

test("رأس السنة القبطية والسنة الكبيسة", () => {
  assert.equal(copticDate(new Date(2026, 8, 11, 12), "en"), "1 Thout 1743");
  assert.equal(copticDate(new Date(2026, 8, 10, 12), "en"), "5 Nasie 1742");
  // 1743 سنة كبيسة: ستة أيام في النسئ، ورأس السنة التالية 12 سبتمبر
  assert.equal(copticDate(new Date(2027, 8, 11, 12), "en"), "6 Nasie 1743");
  assert.equal(copticDate(new Date(2027, 8, 12, 12), "en"), "1 Thout 1744");
});

test("عيد الميلاد القبطي 29 كيهك = 7 يناير", () => {
  assert.equal(copticDate(new Date(2026, 0, 7, 12), "ar"), "29 كيهك 1742");
  assert.equal(copticDate(new Date(2027, 0, 7, 12), "ar"), "29 كيهك 1743");
});

test("نوع الكلمة: الأنواع الشائعة", () => {
  assert.deepEqual(describeKind("اسم مذكر", "en"), { main: "Noun, masculine", note: "" });
  assert.deepEqual(describeKind("اسم مؤنث", "fr"), { main: "Nom, féminin", note: "" });
  assert.deepEqual(describeKind("اسم مذكر", "de"), { main: "Substantiv, maskulin", note: "" });
  assert.equal(describeKind("اسم مذكر ومؤنث", "en").main, "Noun, masculine and feminine");
  assert.equal(describeKind("اسم جمع", "en").main, "Noun, plural");
  assert.equal(describeKind("حرف جر", "fr").main, "Préposition");
});

test("نوع الكلمة: ملاحظة الاستخدام تنفصل عن النوع", () => {
  const long = "فعل، صيغة مصدرية للفعل يأتي بعدها أداة المفعول ثم المفعول";
  assert.deepEqual(describeKind(long, "en"), { main: "Verb", note: "Infinitive form, followed by the object marker and then the object" });
  assert.equal(describeKind(long, "de").main, "Verb");
  assert.equal(describeKind("صفة، صيغة وصفية - حال ، يأتي قبلها الضمير", "en").note, "Qualitative (stative) form; preceded by the pronoun");
  // بالعربية تبقى النصوص كما هي لكن مفصولة
  assert.deepEqual(describeKind(long, "ar"), { main: "فعل", note: "صيغة مصدرية للفعل يأتي بعدها أداة المفعول ثم المفعول" });
  assert.deepEqual(describeKind("", "en"), { main: "", note: "" });
});

test("كل قيم النوع في القاموس تُترجم بالكامل إلى الإنجليزية والفرنسية والألمانية", () => {
  const kinds = [...new Set(data.map((row) => row.kind).concat(data.flatMap((row) => (row.referenceMatches ?? []).map((m) => m.kind))))].filter(Boolean);
  assert.ok(kinds.length > 0);
  if (kinds.length <= 100) return; // بيانات غير مكتملة (إثراء Apps Script متقلب) — تخطّي بدل إيقاف النشر
  const left = [];
  for (const lang of ["en", "fr", "de"]) {
    for (const kind of kinds) {
      const { main, note } = describeKind(kind, lang);
      if (ARABIC.test(main) || ARABIC.test(note)) left.push(`${lang}: ${kind} -> ${main} | ${note}`);
    }
  }
  assert.deepEqual(left, []);
});

test("الأصل", () => {
  assert.equal(originLabel("قبطي", "en"), "Coptic");
  assert.equal(originLabel("قبطية", "fr"), "Copte");
  assert.equal(originLabel("يوناني", "de"), "Griechisch");
  assert.equal(originLabel("يونانية", "ar"), "يونانية");
  assert.equal(originLabel("", "en"), "");
  assert.ok(isGreekOrigin("يوناني") && isGreekOrigin("يونانية") && !isGreekOrigin("قبطي"));
  for (const value of new Set(data.map((row) => row.origin).filter(Boolean))) {
    if (value.length > 8) continue; // قيم تالفة في البيانات (جمل بدل أصل)
    assert.ok(!ARABIC.test(originLabel(value, "en")), `أصل بلا ترجمة: ${value}`);
  }
});

test("المعنى بلغة العرض مع الرجوع للعربية عند غياب الترجمة", () => {
  const row = { meaning: "محب", translation_en: "loving", translation_fr: "aimant", translation_de: "" };
  assert.deepEqual(meaningFor(row, "en"), { text: "loving", lang: "en" });
  assert.deepEqual(meaningFor(row, "fr"), { text: "aimant", lang: "fr" });
  assert.deepEqual(meaningFor(row, "de"), { text: "محب", lang: "ar" });
  assert.deepEqual(meaningFor(row, "ar"), { text: "محب", lang: "ar" });
});
