import { init, search, detail, count, matchParts } from "./search.js?b=__B__";
import { spokenText } from "./speech.js?b=__B__";

// ---- إعدادات ----
const AUDIO_BASE = "https://raw.githubusercontent.com/abr429701-oss/coptic-dictionary-bot/audio";
const HUMAN_AUDIO = "audio-human";
const EXAMPLES = ["ⲁⲛⲁⲩ", "ماء", "water", "حب", "ⲙⲟⲩ"];
const KEYS = "ⲁ ⲃ ⲅ ⲇ ⲉ ⲍ ⲏ ⲑ ⲓ ⲕ ⲗ ⲙ ⲛ ⲝ ⲟ ⲡ ⲣ ⲥ ⲧ ⲩ ⲫ ⲭ ⲯ ⲱ ϣ ϥ ϧ ϩ ϫ ϭ ϯ".split(" ");

const $ = (id) => document.getElementById(id);
const input = $("q"), form = $("form"), clearBtn = $("clear"), kbBtn = $("kbBtn"), keypad = $("keypad");
const listEl = $("list"), statusEl = $("status"), chipsEl = $("chips");
const panel = $("panel"), panelBody = $("panelBody"), backdrop = $("backdrop");
const wide = window.matchMedia("(min-width: 980px)");

let seq = 0;
let items = [];
let selected = -1;
let activeId = null;
let lastQuery = "";

function el(tag, props = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (v !== false && v != null) node.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids) if (kid != null) node.append(kid);
  return node;
}
const copText = (s) => String(s ?? "").replaceAll("`", "\u0300");
const hasCoptic = (s) => /[\u2c80-\u2cff\u03e2-\u03ef]/u.test(s);
const ICON = {
  chev: '<svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg>',
  stop: '<svg viewBox="0 0 24 24"><path d="M7 5h4v14H7zm6 0h4v14h-4z"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15"/></svg>',
  share: '<svg viewBox="0 0 24 24"><path d="M12 15V4m0 0L8 8m4-4 4 4M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/></svg>',
};
const withIcon = (html, text) => { const s = el("span"); s.innerHTML = html; return [s.firstChild, text]; };

// ---- تخزين محلي آمن ----
const store = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* مغلق في التصفح الخاص */ } },
};

// ---- الحالة والرسائل ----
function setStatus(text) { statusEl.textContent = text; }
function toast(text) {
  const t = el("div", { class: "toast", text });
  Object.assign(t.style, { position: "fixed", insetInline: "0", bottom: "calc(24px + env(safe-area-inset-bottom))", margin: "0 auto", width: "fit-content", maxWidth: "88vw", padding: "10px 18px", borderRadius: "999px", background: "var(--ink)", color: "var(--bg)", zIndex: 99, fontSize: "14px" });
  document.body.append(t);
  setTimeout(() => t.remove(), 1800);
}

// ---- البحث ----
function showMessage(title, text) {
  items = []; selected = -1;
  listEl.replaceChildren(el("li", {}, el("div", { class: "empty" }, el("b", { text: title }), text)));
}

function meaningNode(meaning, query) {
  const node = el("span", { class: "m" });
  const list = matchParts(meaning, query);
  list.forEach((part, i) => {
    if (i) node.append("، ");
    node.append(part.matched ? el("mark", { text: part.text }) : part.text);
  });
  return node;
}

function renderResults(query, data) {
  items = data.results;
  selected = -1;
  if (!items.length) {
    const one = [...query].length < 2;
    showMessage(one ? "اكتب حرفًا آخر" : "لا توجد نتيجة مطابقة", one ? "ابدأ بحرفين على الأقل لتظهر المطابقات." : "جرّب كتابة أول حروف الكلمة، أو اللغة المعتادة لك (قبطي أو عربي أو إنجليزي).");
    setStatus("");
    return;
  }
  const frag = document.createDocumentFragment();
  items.forEach((item, index) => {
    const row = el("button", { class: `item${item.id === activeId ? " active" : ""}`, type: "button", "data-i": index },
      el("span", { class: "w", text: copText(item.coptic) || "—" }),
      meaningNode(item.meaning, query),
      el("span", { class: "go", "aria-hidden": "true" }));
    row.querySelector(".go").innerHTML = ICON.chev;
    frag.append(el("li", {}, row));
  });
  listEl.replaceChildren(frag);
  const shown = items.length;
  setStatus(data.total > shown ? `أفضل ${shown} نتيجة` : `${data.total} ${data.total === 1 ? "نتيجة" : "نتائج"}`);
  // تحميل تفاصيل أول نتيجة مسبقًا ليفتح فورًا عند الضغط
  detail(items[0].id).catch(() => {});
}

async function runSearch(raw, { updateUrl = true } = {}) {
  const query = String(raw ?? "").trim();
  clearBtn.hidden = !input.value;
  if (!query) {
    seq++;
    lastQuery = "";
    document.body.classList.remove("has-q");
    listEl.replaceChildren();
    setStatus("");
    renderChips();
    if (updateUrl) history.replaceState(history.state, "", location.pathname);
    return;
  }
  lastQuery = query;
  document.body.classList.add("has-q");
  const mine = ++seq;
  const slow = setTimeout(() => {
    if (mine !== seq || listEl.children.length) return;
    listEl.replaceChildren(...Array.from({ length: 5 }, () => el("li", {}, el("div", { class: "sk" }))));
  }, 140);
  try {
    const data = await search(query);
    clearTimeout(slow);
    if (mine !== seq) return;
    renderResults(query, data);
  } catch (error) {
    clearTimeout(slow);
    if (mine !== seq) return;
    console.error(error);
    showMessage("تعذّر البحث", "تحقق من اتصالك بالإنترنت ثم حاول مرة أخرى.");
    setStatus("");
  }
  if (updateUrl && mine === seq) history.replaceState(history.state, "", `${location.pathname}?q=${encodeURIComponent(query)}`);
}

// ---- بطاقة التفاصيل ----
let humanIds = null;
async function loadHumanIds() {
  if (humanIds) return humanIds;
  try {
    const response = await fetch(`${HUMAN_AUDIO}/manifest.json`);
    humanIds = new Set(response.ok ? await response.json() : []);
  } catch { humanIds = new Set(); }
  return humanIds;
}

let currentAudio = null;
let resetCurrent = null;
function stopAudio() {
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  if (resetCurrent) { const reset = resetCurrent; resetCurrent = null; reset(); }
}
function tryPlay(url, onEnd) {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    let started = false;
    audio.addEventListener("error", () => reject(new Error("audio")), { once: true });
    audio.addEventListener("ended", onEnd, { once: true });
    audio.addEventListener("playing", () => { started = true; resolve(audio); }, { once: true });
    audio.src = url;
    audio.play().catch((error) => { if (!started) reject(error); });
  });
}

function playButton(record) {
  const button = el("button", { class: "play", type: "button", "aria-label": "استمع إلى النطق", title: "استمع إلى النطق", "data-s": "idle" });
  const set = (state) => {
    button.dataset.s = state;
    button.innerHTML = state === "playing" ? ICON.stop : ICON.play;
    button.setAttribute("aria-label", state === "playing" ? "إيقاف النطق" : "استمع إلى النطق");
  };
  set("idle");
  const reset = () => set("idle");
  button.addEventListener("click", async () => {
    if (button.dataset.s === "playing" || button.dataset.s === "loading") { stopAudio(); return; }
    stopAudio();
    resetCurrent = reset;
    set("loading");
    const sources = [];
    if (record.aid != null) {
      if ((await loadHumanIds()).has(record.aid)) sources.push(`${HUMAN_AUDIO}/${record.aid}.ogg`);
      sources.push(`${AUDIO_BASE}/${record.aid}.ogg`);
    }
    for (const url of sources) {
      try {
        const audio = await tryPlay(url, () => { currentAudio = null; resetCurrent = null; reset(); });
        if (resetCurrent !== reset) { audio.pause(); return; }
        currentAudio = audio;
        set("playing");
        return;
      } catch { /* جرّب المصدر التالي */ }
    }
    const text = spokenText(record);
    if (text && "speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US"; utterance.rate = 0.5;
      const done = () => { resetCurrent = null; reset(); };
      utterance.addEventListener("end", done); utterance.addEventListener("error", done);
      window.speechSynthesis.speak(utterance);
      set("playing");
      return;
    }
    resetCurrent = null;
    button.dataset.s = "none";
    setTimeout(reset, 1800);
  });
  return button;
}

function section(title, ...kids) { return el("section", { class: "sec" }, el("h3", { text: title }), ...kids); }

function renderDetail(record) {
  const tags = el("div", { class: "tags" });
  if (record.kind) tags.append(el("span", { class: "tag", text: record.kind }));
  if (record.origin) tags.append(el("span", { class: "tag o", text: `الأصل: ${record.origin}` }));

  const ipa = [record.pronunciation, record.phonetic].filter(Boolean).join("  ·  ");
  const head = el("div", { class: "hd" },
    el("div", {}, el("h2", { class: "word", text: copText(record.coptic) }), ipa ? el("p", { class: "ipa", text: ipa }) : null),
    playButton(record));

  const body = [tags, head];
  if (record.meanings.length) body.push(section("المعنى", el("ol", { class: "meanings" }, ...record.meanings.map((m) => el("li", { text: m })))));
  const rows = [["EN", record.translation_en || record.english], ["FR", record.translation_fr], ["DE", record.translation_de]].filter(([, v]) => v);
  if (rows.length) body.push(section("ترجمات", el("dl", { class: "tr" }, ...rows.flatMap(([k, v]) => [el("dt", { text: k }), el("dd", { text: v })]))));
  if (record.greek && record.origin === "يوناني") body.push(section("الأصل اليوناني", el("p", { class: "ipa", style: "font-size:20px;color:var(--ink)", text: record.greek })));

  const copy = el("button", { class: "btn", type: "button" }, ...withIcon(ICON.copy, "نسخ الكلمة"));
  copy.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(record.coptic.replaceAll("`", "")); toast("تم نسخ الكلمة"); } catch { toast("تعذّر النسخ"); }
  });
  const share = el("button", { class: "btn", type: "button" }, ...withIcon(ICON.share, "مشاركة"));
  share.addEventListener("click", async () => {
    const url = `${location.origin}${location.pathname}?w=${record.row}`;
    const text = `${copText(record.coptic)} — ${record.meanings.slice(0, 2).join("، ")}`;
    try {
      if (navigator.share) await navigator.share({ title: "ⲭⲏⲙⲓ — القاموس القبطي", text, url });
      else { await navigator.clipboard.writeText(url); toast("تم نسخ الرابط"); }
    } catch { /* ألغى المستخدم المشاركة */ }
  });
  body.push(el("div", { class: "acts" }, copy, share), el("p", { class: "fine", text: `مدخل رقم ${record.row + 1}` }));
  panelBody.replaceChildren(...body);
  panelBody.scrollTop = 0;
}

function showPanel() {
  panel.setAttribute("aria-hidden", "false");
  if (!wide.matches) { panel.classList.add("open"); backdrop.hidden = false; document.body.style.overflow = "hidden"; }
}
function hidePanel() {
  stopAudio();
  panel.classList.remove("open");
  panel.setAttribute("aria-hidden", "true");
  backdrop.hidden = true;
  document.body.style.overflow = "";
  activeId = null;
  listEl.querySelectorAll(".item.active").forEach((n) => n.classList.remove("active"));
}
function closePanel() {
  if (history.state?.w != null && !wide.matches) history.back();
  else hidePanel();
}

async function openEntry(id, { push = true } = {}) {
  let record;
  try { record = await detail(id); } catch { toast("تعذّر فتح المدخل، حاول مرة أخرى"); return; }
  if (!record) { toast("لم يُعثر على هذا المدخل"); return; }
  stopAudio();
  activeId = record.row;
  renderDetail(record);
  showPanel();
  listEl.querySelectorAll(".item.active").forEach((n) => n.classList.remove("active"));
  const index = items.findIndex((item) => item.id === record.row);
  if (index >= 0) listEl.children[index]?.firstChild?.classList.add("active");
  if (push) {
    const url = `${location.pathname}?${lastQuery ? `q=${encodeURIComponent(lastQuery)}&` : ""}w=${record.row}`;
    if (wide.matches || history.state?.w != null) history.replaceState({ w: record.row }, "", url);
    else history.pushState({ w: record.row }, "", url);
    if (lastQuery) rememberQuery(lastQuery);
  }
  // رابط مباشر بدون بحث: املأ القائمة بالكلمات القريبة
  if (!lastQuery) {
    const seed = record.coptic.split(/[\s,()]+/u)[0].replaceAll("`", "");
    if (seed) { input.value = seed; void runSearch(seed, { updateUrl: false }); }
  }
}

// ---- الاقتراحات والسجل ----
function rememberQuery(query) {
  const list = [query, ...store.get("recent", []).filter((q) => q !== query)].slice(0, 6);
  store.set("recent", list);
}
function renderChips() {
  const recent = store.get("recent", []);
  const make = (q) => el("button", { class: `chip${hasCoptic(q) ? " cop" : ""}`, type: "button", "data-q": q, text: q });
  const nodes = [];
  if (recent.length) nodes.push(el("span", { class: "chip-label", text: "آخر بحث:" }), ...recent.map(make));
  nodes.push(el("span", { class: "chip-label", text: "جرّب:" }), ...EXAMPLES.map(make));
  chipsEl.replaceChildren(...nodes);
}

// ---- لوحة الحروف القبطية ----
function buildKeypad() {
  keypad.replaceChildren(...KEYS.map((k) => el("button", { type: "button", "data-k": k, text: k, "aria-label": `الحرف ${k}` })),
    el("button", { type: "button", class: "back", "data-k": "⌫", "aria-label": "حذف", text: "⌫" }));
}
keypad.addEventListener("click", (event) => {
  const key = event.target.closest("[data-k]")?.dataset.k;
  if (!key) return;
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? start;
  if (key === "⌫") {
    if (start !== end) input.setRangeText("", start, end, "end");
    else if (start > 0) input.setRangeText("", start - 1, start, "end");
  } else input.setRangeText(key, start, end, "end");
  input.dispatchEvent(new Event("input", { bubbles: true }));
});
kbBtn.addEventListener("click", () => {
  const open = keypad.hidden;
  keypad.hidden = !open;
  kbBtn.setAttribute("aria-expanded", String(open));
  input.inputMode = open ? "none" : "search"; // لا تُظهر لوحة الجهاز مع لوحة القبطية
  if (open) { if (!keypad.children.length) buildKeypad(); } else input.focus();
});

// ---- الأحداث ----
input.addEventListener("input", () => void runSearch(input.value));
form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (selected >= 0 && items[selected]) void openEntry(items[selected].id);
  else if (items.length === 1 || (items.length && input.value.trim())) void openEntry(items[0].id);
  input.blur();
});
clearBtn.addEventListener("click", () => { input.value = ""; hidePanel(); void runSearch(""); input.focus(); });
chipsEl.addEventListener("click", (event) => {
  const q = event.target.closest("[data-q]")?.dataset.q;
  if (q) { input.value = q; void runSearch(q); }
});
listEl.addEventListener("click", (event) => {
  const row = event.target.closest(".item");
  if (!row) return;
  selected = Number(row.dataset.i);
  void openEntry(items[selected].id);
});
$("closePanel").addEventListener("click", closePanel);
backdrop.addEventListener("click", closePanel);
window.addEventListener("popstate", (event) => {
  if (event.state?.w != null) void openEntry(event.state.w, { push: false });
  else hidePanel();
});
function moveSelection(delta) {
  if (!items.length) return;
  selected = Math.max(0, Math.min(items.length - 1, selected + delta));
  listEl.querySelectorAll(".item.sel").forEach((n) => n.classList.remove("sel"));
  const row = listEl.children[selected]?.firstChild;
  row?.classList.add("sel");
  row?.scrollIntoView({ block: "nearest" });
}
document.addEventListener("keydown", (event) => {
  if (event.key === "/" && document.activeElement !== input && !event.ctrlKey && !event.metaKey) { event.preventDefault(); input.focus(); return; }
  if (event.key === "Escape") {
    if (panel.classList.contains("open")) closePanel();
    else if (input.value) { input.value = ""; void runSearch(""); }
  }
  if (document.activeElement === input) {
    if (event.key === "ArrowDown") { event.preventDefault(); moveSelection(1); }
    if (event.key === "ArrowUp") { event.preventDefault(); moveSelection(-1); }
  }
});
$("themeBtn").addEventListener("click", () => {
  const dark = document.documentElement.dataset.theme === "dark" || (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
  const next = dark ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("theme", next); } catch { /* التصفح الخاص */ }
});

// ---- البدء ----
renderChips();
(async () => {
  try {
    const manifest = await init();
    $("count").textContent = count().toLocaleString("en-US");
    if ("serviceWorker" in navigator) navigator.serviceWorker.register(`sw.js?v=${manifest.v}`).catch(() => {});
  } catch (error) {
    console.error(error);
    showMessage("تعذّر تحميل القاموس", "تحقق من اتصالك ثم أعد تحميل الصفحة.");
    return;
  }
  const params = new URLSearchParams(location.search);
  const q = params.get("q");
  const w = params.get("w");
  if (q) { input.value = q; await runSearch(q, { updateUrl: false }); }
  if (w) await openEntry(Number(w), { push: false });
  if (!q && !w) input.focus({ preventScroll: true });
})();
