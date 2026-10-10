import { CONFIG } from "./config.js";
import { init, recordCount, search } from "./engine.js";

const actions = new Map();
let nextActionId = 0;

async function fetchDictionary() {
  const baseUrl = new URL(`../${CONFIG.DICTIONARY_URL}`, import.meta.url);
  const compressedUrl = new URL(`${baseUrl.href}.gz`);

  try {
    const compressed = await fetch(compressedUrl, { cache: "force-cache" });
    if (!compressed.ok) throw new Error(`HTTP ${compressed.status}`);
    if (typeof DecompressionStream !== "function") throw new Error("gzip decompression is not supported");
    const stream = compressed.body.pipeThrough(new DecompressionStream("gzip"));
    return await new Response(stream).json();
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
