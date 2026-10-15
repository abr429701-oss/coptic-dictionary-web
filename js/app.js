import { init, search, detail, count, matchParts } from "./search.js?b=__B__";
import { spokenText } from "./speech.js?b=__B__";

const AUDIO_BASE = "https://raw.githubusercontent.com/abr429701-oss/coptic-dictionary-bot/audio";
const HUMAN_AUDIO = "audio-human";
let humanAudioIds = new Set();
const humanAudioReady = fetch(`${HUMAN_AUDIO}/manifest.json`).then((response) => response.json()).then((ids) => { humanAudioIds = new Set(ids.map(Number)); }).catch(() => {});
const REGISTER_URL = "https://copticdictionry.neocities.org/login";
const SHEET_ID = "17n8MgiCIe4xVRXqM7W74zCSeqwo6pX8L-Pj2wSsl0ek";
const NOTIFICATIONS_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out%3Acsv&sheet=bot&range=B2%3AB`;
const MAX_FREE_SEARCHES = 2;
const KEYS = [
  ["ⲁ","ⲃ","ⲅ","ⲇ","ⲉ","ⲋ"], ["ⲍ","ⲏ","ⲑ","ⲓ","ⲕ","ⲗ"], ["ⲙ","ⲛ","ⲝ","ⲟ","ⲡ","ⲣ"],
  ["ⲥ","ⲧ","ⲩ","ⲫ","ⲭ","ⲯ"], ["ⲱ","ϣ","ϥ","ϧ","ϩ","ϫ"], ["ϭ","ϯ","ⳉ","̀"]
];
const $ = (id) => document.getElementById(id);
const input = $("wordInput"), form = $("searchForm"), clearButton = $("clearButton");
const suggestions = $("suggestions"), keyboard = $("coptic-keyboard"), searchButton = $("searchButton");
const resultsContainer = $("results-container"), message = $("searchMessage"), loader = $("loaderContainer");
const store = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private browsing */ } }
};
const clean = (s) => String(s ?? "").replaceAll("`", "̀");
const make = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "text") node.textContent = value;
    else if (key === "class") node.className = value;
    else if (key === "html") node.innerHTML = value;
    else if (value !== false && value != null) node.setAttribute(key, value === true ? "" : value);
  }
  for (const child of children) if (child != null) node.append(child);
  return node;
};
function toast(text) {
  const node = make("div", { class: "toast", text });
  Object.assign(node.style, { position: "fixed", insetInline: "0", bottom: "calc(20px + env(safe-area-inset-bottom))", margin: "0 auto", width: "fit-content", maxWidth: "88vw", padding: "10px 18px", borderRadius: "999px", background: "#211d10", border: "1px solid #b99a31", color: "#f3db63", zIndex: 99, fontSize: "14px", boxShadow: "0 8px 20px #0009" });
  document.body.append(node); setTimeout(() => node.remove(), 2200);
}
function playSfx(id) { const audio = $(id); if (audio) { audio.currentTime = 0; audio.play().catch(() => {}); } }
function updateDate() {
  const now = new Date();
  const months = ["توت","بابه","هاتور","كيهك","طوبة","أمشير","برمهات","برمودة","بشنس","بؤونة","أبيب","مسرى","النسئ"];
  const epoch = new Date(284, 7, 29);
  const diff = Math.floor((now - epoch) / 86400000);
  const year = Math.floor(diff / 365.25);
  let dayOfYear = diff - Math.floor(year * 365.25), month = 0;
  while (dayOfYear >= 30 && month < 12) { dayOfYear -= 30; month++; }
  const coptic = `${dayOfYear + 1} ${months[month]} ${year + 1}`;
  const weekday = new Intl.DateTimeFormat("ar-EG", { weekday: "long" }).format(now);
  const gregorian = new Intl.DateTimeFormat("ar-EG", { year: "numeric", month: "long", day: "numeric" }).format(now);
  $("date-display").replaceChildren(make("div", { text: weekday }), make("div", { text: coptic }), make("div", { text: gregorian }));
}

// الحدّ محلي في هذا المتصفح فقط: لا عنوان IP، ولا تسجيل زيارات.
function searchCount() { return Number(store.get("khmi-search-count", 0)) || 0; }
function setSearchCount(value) { store.set("khmi-search-count", value); }
function remainingSearches() { return Math.max(0, MAX_FREE_SEARCHES - searchCount()); }
function updateQuotaNote() {
  const remaining = remainingSearches();
  $("quotaNote").textContent = remaining ? `يتبقى ${remaining} بحث قبل التسجيل في هذا المتصفح.` : "وصلت إلى حدّ البحث المحلي؛ استخدم زر «تسجيل» للمتابعة.";
}
function showRegistrationGate() {
  loader.hidden = true;
  searchButton.disabled = false;
  resultsContainer.replaceChildren();
  message.replaceChildren();
  const box = make("div", { class: "register-notice" });
  box.append(make("strong", { text: "للاستمرار في البحث، سجّل الدخول." }), make("br"), make("span", { text: "حدّ البحث محفوظ على هذا المتصفح فقط، ولا نجمع عنوان IP." }), make("br"));
  const link = make("a", { href: REGISTER_URL, target: "_blank", rel: "noopener noreferrer", text: "فتح صفحة التسجيل" });
  box.append(link, make("br"), make("button", { class: "more-results-btn", type: "button", text: "أكملت التسجيل — استكمل البحث" }));
  box.querySelector("button").addEventListener("click", () => { setSearchCount(0); updateQuotaNote(); message.textContent = "تمت إعادة الحدّ محليًا. يمكنك البحث الآن."; box.remove(); });
  message.append(box);
}
function renderSuggestions(query, rows) {
  const unique = new Set();
  const options = [];
  for (const row of rows) {
    const word = clean(row.coptic).trim();
    const label = `${word} ${row.meaning || ""}`;
    if (word && !unique.has(word)) { unique.add(word); options.push({ word, meaning: row.meaning || "" }); }
    if (options.length >= 7) break;
  }
  if (!query || !options.length) { suggestions.hidden = true; suggestions.replaceChildren(); return; }
  suggestions.replaceChildren(...options.map((option) => {
    const button = make("button", { class: "suggestion", type: "button", role: "option" }, make("span", { class: "s-word cop", text: option.word }), make("span", { class: "s-meaning", text: option.meaning }));
    button.addEventListener("click", () => { input.value = option.word; suggestions.hidden = true; void performSearch(option.word); });
    return make("li", {}, button);
  }));
  suggestions.hidden = false;
}
let suggestSeq = 0;
async function updateSuggestions(query) {
  const current = ++suggestSeq;
  const q = query.trim();
  if (!q) { suggestions.hidden = true; suggestions.replaceChildren(); return; }
  try { const result = await search(q); if (current === suggestSeq && input.value.trim() === q) renderSuggestions(q, result.results); }
  catch { if (current === suggestSeq) { suggestions.hidden = true; } }
}
function renderMeaning(value, query) {
  const wrap = make("span", { class: "meaning" });
  const parts = matchParts(value || "", query);
  parts.forEach((part, index) => { if (index) wrap.append("، "); wrap.append(part.matched ? make("mark", { text: part.text }) : document.createTextNode(part.text)); });
  if (!parts.length) wrap.textContent = value || "—";
  return wrap;
}
function resolveAudio(record) {
  const matches = Array.isArray(record.referenceMatches) ? record.referenceMatches : [];
  const first = matches.find((item) => item.audioUrl);
  if (first) return { url: first.audioUrl, name: first.audioFilename || "coptic-pronunciation.ogg" };
  if (record.aid != null && humanAudioIds.has(Number(record.aid))) return { url: `${HUMAN_AUDIO}/${record.aid}.ogg`, name: `${record.aid}.ogg` };
  if (record.aid != null) return { url: `${AUDIO_BASE}/${record.aid}.ogg`, name: `${record.aid}.ogg` };
  return null;
}
function formatTime(time) {
  if (!Number.isFinite(time)) return "00:00";
  const m = Math.floor(time / 60), s = Math.floor(time % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
function buildAudioPlayer(record, query) {
  const source = resolveAudio(record);
  const player = make("div", { class: "audio-player-container" });
  const audio = new Audio(); audio.preload = "none";
  if (source) audio.src = source.url;
  const play = make("button", { class: "audio-control", type: "button", title: "تشغيل/إيقاف النطق", "aria-label": "تشغيل النطق", text: "▶" });
  const mute = make("button", { class: "audio-control", type: "button", title: "كتم الصوت", "aria-label": "كتم الصوت", text: "🔊" });
  const volume = make("input", { class: "audio-volume", type: "range", min: "0", max: "1", step: "0.01", value: "1", "aria-label": "مستوى الصوت" });
  const progress = make("div", { class: "audio-progress", role: "slider", tabindex: "0", "aria-label": "موضع التشغيل", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": "0" });
  const progressFill = make("span"); progress.append(progressFill);
  const elapsed = make("span", { class: "audio-time", text: "00:00" });
  const duration = make("span", { class: "audio-time", text: "00:00" });
  const download = make("button", { class: "download-button", type: "button", title: "تنزيل الصوت", "aria-label": "تنزيل الصوت", text: "↓" });
  play.addEventListener("click", async () => {
    playSfx("clickSound");
    if (audio.src) {
      if (audio.paused) {
        try { await audio.play(); play.textContent = "Ⅱ"; }
        catch { toast("تعذّر تشغيل الملف الصوتي؛ جرّب النطق الآلي."); speakFallback(record); }
      } else { audio.pause(); play.textContent = "▶"; }
    } else { speakFallback(record); play.textContent = "Ⅱ"; }
  });
  audio.addEventListener("ended", () => { play.textContent = "▶"; progressFill.style.width = "0%"; elapsed.textContent = "00:00"; });
  audio.addEventListener("loadedmetadata", () => { duration.textContent = formatTime(audio.duration); });
  audio.addEventListener("timeupdate", () => { elapsed.textContent = formatTime(audio.currentTime); const pct = audio.duration ? audio.currentTime / audio.duration * 100 : 0; progressFill.style.width = `${pct}%`; progress.setAttribute("aria-valuenow", String(Math.round(pct))); });
  audio.addEventListener("pause", () => { if (!audio.ended) play.textContent = "▶"; });
  mute.addEventListener("click", () => { audio.muted = !audio.muted; mute.textContent = audio.muted ? "🔇" : "🔊"; });
  volume.addEventListener("input", () => { audio.volume = Number(volume.value); if (audio.volume) audio.muted = false; mute.textContent = audio.muted ? "🔇" : "🔊"; });
  const seek = (event) => { if (!audio.src || !Number.isFinite(audio.duration)) return; const rect = progress.getBoundingClientRect(); const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)); audio.currentTime = ratio * audio.duration; };
  progress.addEventListener("click", seek);
  progress.addEventListener("keydown", (event) => { if (["ArrowLeft","ArrowRight"].includes(event.key) && audio.src && Number.isFinite(audio.duration)) { audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + (event.key === "ArrowRight" ? 5 : -5))); } });
  download.addEventListener("click", () => {
    if (!source) { toast("لا يتوفر ملف صوت للتنزيل لهذا المدخل."); return; }
    const anchor = make("a", { href: source.url, download: `${clean(record.coptic).replace(/\s+/g,"_")}-${source.name}`, target: "_blank", rel: "noopener noreferrer" });
    document.body.append(anchor); anchor.click(); anchor.remove(); playSfx("copySound");
  });
  if (!source) player.dataset.fallback = "speech";
  player.append(play, mute, volume, progress, elapsed, duration, download);
  player._audio = audio;
  return player;
}
function speakFallback(record) {
  const text = spokenText(record);
  if (!text || !("speechSynthesis" in window)) { toast("لا يتوفر نطق لهذا المدخل."); return; }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text); utterance.lang = "en-US"; utterance.rate = 0.62;
  utterance.addEventListener("end", () => { const button = document.querySelector(".audio-control"); if (button) button.textContent = "▶"; });
  window.speechSynthesis.speak(utterance);
}
function safeFilename(text) { return String(text || "coptic-dictionary").replace(/[\\/:*?"<>|]/g, "-").slice(0, 70); }
async function shareCard(card, record, query) {
  if (typeof window.html2canvas !== "function") { toast("تعذّر تحميل أداة إنشاء الصورة."); return; }
  playSfx("clickSound");
  const stage = $("shareStage");
  const refs = Array.isArray(record.referenceMatches) ? record.referenceMatches : [];
  const originalMeaning = refs.find((item) => item.meaning)?.meaning || record.meanings.join("، ");
  const info = make("div", { class: "share-information" });
  for (const [label, value] of [["الكلمة", query], ["القبطية", clean(record.coptic)], ["المعنى", originalMeaning], ["النوع", record.kind], ["الأصل", record.origin]]) {
    if (!value) continue;
    const line = make("p"); line.append(make("strong", { text: `${label}: ` }), document.createTextNode(value)); info.append(line);
  }
  const avatars = make("div", { class: "share-avatars" });
  const first = make("div", { class: "share-mark", text: "ⲭ" }); avatars.append(first);
  const avatar = make("img", { src: "assets/share-abram.png", alt: "" });
  const flag = make("img", { src: "assets/share-egypt.svg", alt: "" });
  avatars.append(avatar, flag);
  const date = make("div", { class: "share-date", text: `${$("date-display").textContent.replace(/\s+/g, " · ")} · ⲭⲏⲙⲓ` });
  const photo = make("img", { class: "share-photo", src: "assets/share-photo.jpg", alt: "" });
  const exportNode = make("div", { class: "share-export" }, avatars, make("h2", { class: "share-title", text: "القاموس القبطي · ⲭⲏⲙⲓ" }), info, date, photo);
  stage.replaceChildren(exportNode);
  try {
    await Promise.all([...exportNode.querySelectorAll("img")].map((img) => img.decode().catch(() => {})));
    const canvas = await window.html2canvas(exportNode, { scale: 2, backgroundColor: "#15130e", useCORS: true, logging: false });
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("image export failed");
    const filename = `${safeFilename(query)}-${safeFilename(record.coptic)}.png`;
    if (navigator.share && navigator.canShare?.({ files: [new File([blob], filename, { type: "image/png" })] })) {
      await navigator.share({ title: "ⲭⲏⲙⲓ — القاموس القبطي", files: [new File([blob], filename, { type: "image/png" })] });
    } else {
      const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 3000);
    }
  } catch (error) { console.error(error); toast("تعذّر إنشاء بطاقة المشاركة؛ حاول مرة أخرى."); }
  finally { stage.replaceChildren(); }
}
function cardLine(label, value, className = "") {
  const line = make("div", { class: "result-line" });
  line.append(make("strong", { text: `${label}:` }), make("span", { class: className, text: value || "—" }));
  return line;
}
async function createResultCard(item, query, index) {
  const record = await detail(item.id);
  await humanAudioReady;
  const card = make("article", { class: "result-card" });
  const share = make("button", { class: "share-button", type: "button", title: "مشاركة بطاقة صورة", "aria-label": "مشاركة بطاقة صورة", text: "↗" });
  share.addEventListener("click", () => void shareCard(card, record, query)); card.append(share);
  const info = make("div", { class: "info-section" });
  info.append(cardLine("الكلمة", query), cardLine("القبطية", clean(record.coptic), "coptic-word cop"));
  const meaning = make("div", { class: "result-line" });
  meaning.append(make("strong", { text: "المعنى:" }));
  const meaningContent = make("span"); meaningContent.append(renderMeaning(record.meaning || item.meaning, query));
  if (!/[\u0600-\u06ff]/u.test(record.meaning || item.meaning || "")) {
    const copy = make("button", { class: "copy-button", type: "button", title: "نسخ المعنى", "aria-label": "نسخ المعنى", text: "▢" });
    copy.addEventListener("click", async () => { try { await navigator.clipboard.writeText(record.meaning || item.meaning); playSfx("copySound"); toast("تم نسخ النص"); } catch { toast("تعذّر النسخ"); } });
    meaningContent.append(copy);
  }
  meaning.append(meaningContent); info.append(meaning);
  const reference = Array.isArray(record.referenceMatches) ? record.referenceMatches[0] : null;
  info.append(cardLine("النوع", reference?.kind || record.kind), cardLine("الأصل", reference?.origin || record.origin));
  if (record.translation_en || record.translation_fr || record.translation_de) {
    const trans = make("div", { class: "result-line type-origin" });
    trans.append(make("strong", { text: "ترجمات:" }));
    const values = [record.translation_en && `EN: ${record.translation_en}`, record.translation_fr && `FR: ${record.translation_fr}`, record.translation_de && `DE: ${record.translation_de}`].filter(Boolean);
    trans.append(make("span", { text: values.join(" · ") })); info.append(trans);
  }
  info.append(buildAudioPlayer(record, query)); card.append(info);
  return card;
}
let resultRows = [], currentIndex = 0, currentQuery = "", searchSequence = 0;
async function displayCurrentResult() {
  const seq = searchSequence;
  const item = resultRows[currentIndex];
  if (!item) return;
  try {
    const card = await createResultCard(item, currentQuery, currentIndex);
    if (seq !== searchSequence) return;
    resultsContainer.replaceChildren(card);
    if (resultRows.length > currentIndex + 1) {
      const more = make("button", { class: "more-results-btn", type: "button", text: "اضغط لمعرفة المزيد من المعاني　⌄" });
      more.addEventListener("click", () => { currentIndex++; void displayCurrentResult(); });
      resultsContainer.append(more);
    }
  } catch (error) { console.error(error); message.textContent = "تعذّر تحميل تفاصيل المدخل."; }
}
async function performSearch(raw) {
  const query = String(raw ?? "").trim();
  if (!query) { ++searchSequence; loader.hidden = true; searchButton.disabled = false; message.textContent = "الرجاء إدخال كلمة للبحث!"; resultsContainer.replaceChildren(); input.focus(); return; }
  suggestions.hidden = true;
  const seq = ++searchSequence;
  if (searchCount() >= MAX_FREE_SEARCHES) { showRegistrationGate(); updateQuotaNote(); return; }
  setSearchCount(searchCount() + 1); updateQuotaNote();
  currentQuery = query; currentIndex = 0; resultRows = [];
  message.textContent = ""; resultsContainer.replaceChildren(); loader.hidden = false; searchButton.disabled = true; playSfx("clickSound");
  try {
    const data = await search(query);
    if (seq !== searchSequence) return;
    resultRows = data.results;
    if (!resultRows.length) { message.textContent = "الكلمة غير موجودة حاليًا؛ ستتم الإضافة قريبًا."; message.classList.add("error"); playSfx("errorSound"); return; }
    message.textContent = `${data.total.toLocaleString("ar-EG")} نتيجة`;
    message.classList.remove("error");
    playSfx("successSound");
    await displayCurrentResult();
    const params = new URLSearchParams(location.search); params.set("q", query); params.delete("w"); history.replaceState({}, "", `${location.pathname}?${params}`);
  } catch (error) {
    if (seq !== searchSequence) return;
    console.error(error); message.textContent = "حدث خطأ في البحث؛ تحقق من الاتصال وحاول مرة أخرى."; message.classList.add("error"); playSfx("errorSound");
  } finally { loader.hidden = true; searchButton.disabled = false; }
}

function buildKeyboard() {
  const rows = KEYS.map((characters) => make("div", { class: "key-row" }, ...characters.map((character) => make("button", { class: "coptic-key cop", type: "button", "data-char": character, text: character }))));
  const special = make("div", { class: "key-row" },
    make("button", { class: "coptic-key special", type: "button", "data-action": "backspace", text: "⌫ حذف" }),
    make("button", { class: "coptic-key special", type: "button", "data-char": "̀", text: "̀" }),
    make("button", { class: "coptic-key special", type: "button", "data-action": "clear", text: "مسح الكل" }),
    make("button", { class: "coptic-key special", type: "button", "data-action": "close", text: "إغلاق" }));
  keyboard.replaceChildren(...rows, special);
}
$("keyboardTrigger").addEventListener("click", () => {
  keyboard.hidden = !keyboard.hidden;
  $("keyboardTrigger").setAttribute("aria-expanded", String(!keyboard.hidden));
  if (!keyboard.hidden && !keyboard.children.length) buildKeyboard();
  input.inputMode = keyboard.hidden ? "search" : "none";
});
keyboard.addEventListener("click", (event) => {
  const button = event.target.closest("[data-char],[data-action]"); if (!button) return;
  const action = button.dataset.action;
  const start = input.selectionStart ?? input.value.length, end = input.selectionEnd ?? start;
  if (action === "backspace") { if (start !== end) input.setRangeText("", start, end, "end"); else if (start > 0) input.setRangeText("", start - 1, start, "end"); }
  else if (action === "clear") input.value = "";
  else if (action === "close") { keyboard.hidden = true; $("keyboardTrigger").setAttribute("aria-expanded", "false"); input.inputMode = "search"; }
  else input.setRangeText(button.dataset.char, start, end, "end");
  input.dispatchEvent(new Event("input", { bubbles: true })); input.focus();
});

input.addEventListener("input", () => { clearButton.hidden = !input.value; void updateSuggestions(input.value); });
form.addEventListener("submit", (event) => { event.preventDefault(); void performSearch(input.value); });
clearButton.addEventListener("click", () => { ++searchSequence; loader.hidden = true; searchButton.disabled = false; input.value = ""; clearButton.hidden = true; suggestions.hidden = true; resultsContainer.replaceChildren(); message.textContent = ""; input.focus(); });
$("registerButton").addEventListener("click", () => {
  window.open(REGISTER_URL, "_blank", "noopener,noreferrer");
  toast("فُتحت صفحة التسجيل. بعد إكمالها، استكمل البحث من رسالة الحدّ المحلي.");
});

document.addEventListener("click", (event) => { if (!event.target.closest(".search-area")) suggestions.hidden = true; });
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") { suggestions.hidden = true; if (!keyboard.hidden) keyboard.hidden = true; }
  if (event.key === "/" && document.activeElement !== input && !event.ctrlKey && !event.metaKey) { event.preventDefault(); input.focus(); }
});

// الإشعارات: قراءة العمود B فقط من التبويب المرجعي، مع علامة مشاهدة خاصة بهذا المتصفح.
function parseCSV(text) {
  const rows = []; let row = [], value = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted && ch === '"' && text[i + 1] === '"') { value += '"'; i++; }
    else if (ch === '"') quoted = !quoted;
    else if (ch === "," && !quoted) { row.push(value); value = ""; }
    else if ((ch === "\n" || ch === "\r") && !quoted) { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(value); rows.push(row); row = []; value = ""; }
    else value += ch;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  return rows;
}
let notifications = [], newNotificationCount = 0;
async function loadNotifications() {
  const list = $("notificationsList");
  try {
    const url = `${NOTIFICATIONS_URL}&t=${Date.now()}`;
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const rows = parseCSV(await response.text());
    // Do not retain or render any other column: the query itself is constrained to B2:B.
    notifications = rows.map((row) => row[0]?.trim()).filter(Boolean).slice(-10).reverse();
    const previousTotal = Number(store.get("khmi-notification-total", 0)) || 0;
    newNotificationCount = Math.max(0, notifications.length - Number(store.get("khmi-notification-seen", notifications.length)));
    if (notifications.length > previousTotal && previousTotal > 0) {
      newNotificationCount = Math.min(notifications.length, notifications.length - previousTotal);
      const bar = $("notificationBar"); bar.hidden = false; setTimeout(() => { bar.hidden = true; }, 3000);
    }
    store.set("khmi-notification-total", notifications.length);
    if (!$('notificationsWindow').hidden) { store.set("khmi-notification-seen", notifications.length); newNotificationCount = 0; }
    renderNotifications();
  } catch (error) {
    console.warn("تعذر تحميل الإشعارات", error);
    if (!notifications.length) $("notificationsList").replaceChildren(make("p", { class: "notification-empty", text: "تعذّر تحميل الإشعارات الآن." }));
  }
}
function renderNotifications() {
  const list = $("notificationsList");
  if (!notifications.length) { list.replaceChildren(make("p", { class: "notification-empty", text: "لا توجد إشعارات جديدة" })); }
  else list.replaceChildren(...notifications.map((text, index) => make("div", { class: `notification-item${index < newNotificationCount ? " new" : ""}`, text })));
  const badge = $("notificationBadge"); badge.hidden = newNotificationCount <= 0; badge.textContent = newNotificationCount > 9 ? "9+" : String(newNotificationCount);
}
function toggleNotifications(open) {
  const windowEl = $("notificationsWindow"); const show = open ?? windowEl.hidden;
  windowEl.hidden = !show; $("notificationsButton").setAttribute("aria-expanded", String(show));
  if (show) { void loadNotifications(); store.set("khmi-notification-seen", notifications.length); newNotificationCount = 0; renderNotifications(); }
}
$("notificationsButton").addEventListener("click", () => toggleNotifications());
$("closeNotifications").addEventListener("click", () => toggleNotifications(false));

// ---- بدء التطبيق ----
(async () => {
  updateDate(); setInterval(updateDate, 60_000); updateQuotaNote();
  try {
    const manifest = await init(); $("count").textContent = count().toLocaleString("en-US");
    if ("serviceWorker" in navigator && window.__DEV_LIVE__) navigator.serviceWorker.getRegistrations().then((registrations) => registrations.forEach((registration) => registration.unregister())).catch(() => {});
    else if ("serviceWorker" in navigator) navigator.serviceWorker.register(`sw.js?v=${manifest.v}`).catch(() => {});
  } catch (error) { console.error(error); message.textContent = "تعذّر تحميل القاموس؛ تحقق من الاتصال ثم أعد تحميل الصفحة."; message.classList.add("error"); return; }
  await loadNotifications(); setInterval(loadNotifications, 60_000);
  const params = new URLSearchParams(location.search); const query = params.get("q");
  if (query) { input.value = query; clearButton.hidden = false; await performSearch(query); }
})();
