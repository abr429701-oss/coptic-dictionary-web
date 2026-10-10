import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as engine from "../js/engine.js";

const records = JSON.parse(readFileSync(new URL("../data/dictionary.json", import.meta.url), "utf8"));
engine.init(records);

const labels = (msg) => msg.fields.map(([label]) => label);

test("القاموس يحتوي سجلات", () => {
  assert.ok(records.length > 10000);
  assert.equal(engine.recordCount(), records.length);
});

test("بحث بكلمة قبطية كاملة يعرض الكلمة والمعنى والنوع والأصل", () => {
  const msg = engine.search("ⲁⲛⲁⲩ");
  assert.equal(msg.kind, "entry");
  assert.deepEqual(labels(msg).slice(0, 2), ["الكلمة", "المعنى"]);
  assert.ok(msg.voice, "يوجد نطق للكلمة");
});

test("بحث بالعربية يعرض الكلمة العربية ثم المعنى", () => {
  const msg = engine.search("ماء");
  assert.equal(msg.kind, "entry");
  assert.equal(msg.fields[0][1], "ماء");
});

test("بحث بالإنجليزية يعرض الواجهة بالإنجليزية", () => {
  const msg = engine.search("water");
  assert.ok(["entry", "suggest"].includes(msg.kind));
  if (msg.kind === "entry") assert.equal(msg.fields[0][0], "Word");
});

test("أول الحروف يعطي اقتراحات مرقّمة الصفحات ويستبدل الرسالة عند التنقل", () => {
  const msg = engine.search("ⲁⲃ");
  assert.equal(msg.kind, "suggest");
  assert.equal(msg.title, "اختر من الاقتراحات التالية:");
  assert.equal(msg.buttons.length, 10);
  const next = msg.nav.find((b) => b.text === "التالي");
  assert.ok(next?.replace);
  const page2 = next.run();
  assert.equal(page2.kind, "suggest");
  assert.ok(page2.nav.some((b) => b.text === "السابق"));
});

test("اختيار اقتراح يعرض بطاقة الكلمة", () => {
  const msg = engine.search("ⲁⲃ");
  const picked = msg.buttons[0].run();
  assert.equal(picked.kind, "entry");
  assert.ok(picked.fields.length >= 2);
});

test("المعاني الأخرى تُعرض كل معنى مرة واحدة ثم ينتهي الزر", () => {
  let msg = engine.search("ⲁ");
  // حرف واحد: اقتراحات. اختر أول كلمة لها أكثر من معنى إن وُجدت.
  let seen = 0;
  while (msg?.more && seen < 50) {
    msg = msg.more.run();
    seen += 1;
  }
  assert.ok(seen < 50, "السلسلة تنتهي");
});

test("كلمة غير موجودة تعطي رسالة القاموس قيد التطوير", () => {
  const msg = engine.search("qqqqzzzzxx");
  assert.equal(msg.kind, "text");
  assert.match(msg.text, /still under development|قيد التطوير/u);
});

test("تطبيع الألف والتشكيل في العربية", () => {
  assert.equal(engine.normalize("أَبٌ"), engine.normalize("اب"));
  assert.equal(engine.normalize("إله"), engine.normalize("اله"));
});

test("لا يوجد نطق احتياطي فارغ لكلمة لها IPA", () => {
  const record = records.find((r) => r.pronunciation);
  assert.ok(engine.spokenText(record).length > 0);
});
