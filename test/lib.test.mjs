// اختبارات مكتبة المعالجة: توحيد النص، تحليل CSV، وبناء السجلات — بنفس كود العامل.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalize, parseCSV, buildRecords, arabicMeaning, cleanCoptic } from "../js/lib.js";

const csv = readFileSync(new URL("./sample.csv", import.meta.url), "utf8");

test("توحيد النص: إزالة الجينكيم والتشكيل وتوحيد الهمزة", () => {
  assert.equal(normalize("ⲁ̀ⲛⲁⲩ"), normalize("ⲁⲛⲁⲩ"));
  assert.equal(normalize("أحمد"), normalize("احمد"));
  assert.equal(normalize("مَاءٌ"), normalize("ماء"));
});

test("تحليل CSV يفهم الحقول المقتبسة والفواصل داخلها", () => {
  const rows = parseCSV('a,"b,1",c\n"d""e",f,g');
  assert.deepEqual(rows[0], ["a", "b,1", "c"]);
  assert.deepEqual(rows[1], ['d"e', "f", "g"]);
});

test("تنظيف الجينكيم: الشرطة تلتصق بالحرف الذي قبلها", () => {
  assert.equal(cleanCoptic("ⲁⲧ`ⲥϧⲁⲓ"), "ⲁⲧⲥ̀ϧⲁⲓ");
});

test("بناء السجلات من بيانات الشيت", () => {
  const records = buildRecords(parseCSV(csv));
  assert.equal(records.length, 2);
  assert.equal(records[0].coptic, "ⲃⲓⲣ");
  assert.equal(records[0].ipa, "bir");
  assert.ok(records[0].ar.includes("جفاف"));
  assert.equal(records[0].en, "dryness");
  assert.equal(records[1].coptic, "ⲁⲅⲁⲡⲏ");
  assert.equal(records[1].origin, "يوناني");
});

test("فصل المعنى العربي عن الترجمات الملصوقة", () => {
  assert.equal(arabicMeaning("حب، محبة، love, amour", ["love", "amour"]), "حب، محبة");
  assert.equal(arabicMeaning("حب", ["love"]), "حب");
});
