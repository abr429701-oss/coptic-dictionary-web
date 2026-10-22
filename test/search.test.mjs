import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = mkdtempSync(join(tmpdir(), "site-"));
execFileSync("node", ["scripts/build-site.mjs", "data/dictionary.json", out], { stdio: "pipe" });

// fetch محلي يقرأ من مجلد البناء، ويسجّل كل طلب.
const requests = [];
globalThis.window = { __MANIFEST__: JSON.parse(readFileSync(join(out, "manifest.json"), "utf8")) };
globalThis.fetch = async (path) => {
  const file = join(out, String(path).split("?")[0]);
  requests.push(String(path));
  if (!existsSync(file)) return { ok: false, status: 404 };
  const text = readFileSync(file, "utf8");
  return { ok: true, status: 200, json: async () => JSON.parse(text) };
};
const { init, search, detail, count } = await import("../js/search.js");
await init();

test("عدد المداخل", () => assert.ok(count() > 10000));

test("بحث بالقبطية: ⲁⲛⲁⲩ", async () => {
  const { results } = await search("ⲁⲛⲁⲩ");
  assert.ok(results.length > 0);
  assert.equal(results[0].coptic.replace(/[`\u0300-\u036f]/g, ""), "ⲁⲛⲁⲩ");
});

test("بحث بالعربية مع ال التعريف: الماء = ماء", async () => {
  const a = await search("ماء");
  const b = await search("الماء");
  assert.ok(a.results.length > 0);
  assert.deepEqual(a.results.map((r) => r.id), b.results.map((r) => r.id));
});

test("بحث بالإنجليزية: water", async () => {
  const { results } = await search("water");
  assert.ok(results.length > 0);
  assert.ok(results.some((r) => /ماء/.test(r.meaning)));
});

test("بحث بالبادئة أثناء الكتابة", async () => {
  const { results } = await search("wat");
  assert.ok(results.length > 0);
});

test("أكثر من كلمة", async () => {
  const { results } = await search("ماء الحياة");
  assert.ok(Array.isArray(results));
});

test("نص بلا نتيجة وحرف واحد لا يرميان خطأ", async () => {
  assert.deepEqual((await search("zzqqxx")).results, []);
  assert.ok(Array.isArray((await search("م")).results));
  assert.deepEqual((await search("   ")).results, []);
});

test("كل بحث يحمّل ملفًا صغيرًا واحدًا فقط (لا قاموس كامل)", async () => {
  requests.length = 0;
  await search("love");
  assert.ok(requests.length <= 1, requests.join(","));
  for (const r of requests) assert.ok(r.startsWith("i/"));
});

test("تفاصيل المدخل", async () => {
  const { results } = await search("ⲁⲛⲁⲩ");
  const record = await detail(results[0].id);
  assert.equal(record.row, results[0].id);
  assert.ok(record.meanings.length > 0);
  assert.ok(record.kind);
});

test("حجم أي ملف فهرس مناسب (أقل من 400KB)", async () => {
  const { k } = window.__MANIFEST__;
  let max = 0;
  for (const key of k) max = Math.max(max, readFileSync(join(out, "i", `${key}.json`)).length);
  assert.ok(max < 400_000, `أكبر ملف ${max}`);
});

test("الملف الناتج لا يحتوي مرجع GitHub ولا القاموس الكامل", () => {
  const html = readFileSync(join(out, "index.html"), "utf8");
  assert.ok(!/github/i.test(html.replace(/"k":\[[^\]]*\]/, "")));
  assert.ok(!existsSync(join(out, "data", "dictionary.json")));
});

test("الصفوف المتشاركة في رقم النطق تبقى كلها (ⲏⲗ: الله + محمول)", async () => {
  const { results } = await search("ⲏⲗ");
  const meanings = results.filter((r) => r.coptic === "ⲏⲗ").map((r) => r.meaning).join("|");
  assert.match(meanings, /الله/);
  assert.match(meanings, /محمول/);
});

test("كل صف له تفاصيل ورقم نطق أو null", async () => {
  const record = await detail(0);
  assert.equal(record.row, 0);
  assert.ok(record.aid === null || Number.isInteger(record.aid));
});
