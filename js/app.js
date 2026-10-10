import { CONFIG } from "./config.js";
import { init, recordCount, search, spokenText, HELP_TEXT, WELCOME_TEXT, COMMAND_FALLBACK_TEXT } from "./engine.js";

const chat = document.getElementById("chat");
const form = document.getElementById("composer");
const input = document.getElementById("input");
const sendBtn = document.getElementById("send");
const statusEl = document.getElementById("status");
const helpBtn = document.getElementById("helpBtn");
const clearBtn = document.getElementById("clearBtn");

let ready = false;
let busy = false;

// ---------- أدوات DOM ----------
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else node.setAttribute(key, value);
  }
  for (const child of children) if (child) node.append(child);
  return node;
}

function scrollDown() {
  chat.scrollTop = chat.scrollHeight;
}

function addBubble(node) {
  chat.append(node);
  scrollDown();
  return node;
}

// ---------- عرض رسائل المحرك ----------
function fieldNode([label, value]) {
  const row = el("div", { class: "field", dir: "auto" });
  row.append(el("b", { text: `${label}: ` }), el("span", { class: "v", text: value }));
  return row;
}

function keyButton(text, onClick) {
  const button = el("button", { class: "key", type: "button", dir: "auto", text });
  button.addEventListener("click", onClick);
  return button;
}

// يملأ فقاعة بمحتوى رسالة (entry / suggest / text).
function fill(bubble, msg) {
  bubble.replaceChildren();
  bubble.classList.remove("wide");
  if (msg.kind === "text") {
    bubble.append(el("p", { dir: "auto", text: msg.text }));
    return;
  }
  if (msg.kind === "entry") {
    msg.fields.forEach((field) => bubble.append(fieldNode(field)));
    if (msg.more) {
      const keys = el("div", { class: "keys" });
      const button = keyButton(msg.more.text, () => showResult(msg.more.run()));
      keys.append(button);
      bubble.append(keys);
      bubble.classList.add("wide");
    }
    return;
  }
  // suggest
  bubble.classList.add("wide");
  bubble.append(el("p", { dir: "auto", text: msg.title }));
  const keys = el("div", { class: "keys" });
  msg.buttons.forEach((b) => keys.append(keyButton(b.text, () => showResult(b.run()))));
  bubble.append(keys);
  if (msg.nav.length) {
    const nav = el("div", { class: "keys nav" });
    msg.nav.forEach((b) => nav.append(keyButton(b.text, () => {
      const next = b.run();
      if (next) {
        fill(bubble, next);
        bubble.scrollIntoView({ block: "nearest" });
      }
    })));
    bubble.append(nav);
  }
}

function showResult(msg) {
  if (!msg) return;
  const bubble = addBubble(el("div", { class: "msg" }));
  fill(bubble, msg);
  if (msg.kind === "entry" && msg.voice) addBubble(voiceBubble(msg.voice));
  scrollDown();
}

// ---------- النطق ----------
let currentAudio = null;
let currentReset = null;

function stopCurrent() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  if (currentReset) {
    currentReset();
    currentReset = null;
  }
}

function playUrl(url, onEnd) {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    audio.preload = "auto";
    let started = false;
    audio.addEventListener("error", () => reject(new Error("audio error")), { once: true });
    audio.addEventListener("ended", onEnd, { once: true });
    audio.addEventListener("playing", () => {
      started = true;
      resolve(audio);
    }, { once: true });
    audio.src = url;
    audio.play().catch((error) => {
      if (!started) reject(error);
    });
  });
}

function speak(record, onEnd) {
  const text = spokenText(record);
  if (!CONFIG.SPEECH_FALLBACK || !text || !("speechSynthesis" in window)) return false;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.5;
  utterance.addEventListener("end", onEnd);
  utterance.addEventListener("error", onEnd);
  window.speechSynthesis.speak(utterance);
  return true;
}

// قائمة التسجيلات المضمّنة (audio-human/manifest.json) حتى لا نطلب ملفات غير موجودة.
let humanIds = null;
async function loadHumanIds() {
  if (humanIds) return humanIds;
  try {
    const response = await fetch(`${CONFIG.HUMAN_AUDIO_URL}/manifest.json`);
    humanIds = new Set(response.ok ? await response.json() : []);
  } catch {
    humanIds = new Set();
  }
  return humanIds;
}

async function sources(record) {
  const list = [];
  if (record?.id == null) return list;
  const id = encodeURIComponent(record.id);
  if (CONFIG.HUMAN_AUDIO && (await loadHumanIds()).has(Number(record.id))) list.push(`${CONFIG.HUMAN_AUDIO_URL}/${id}.ogg`);
  list.push(`${CONFIG.AUDIO_BASE_URL.replace(/\/+$/u, "")}/${id}.ogg`);
  return list;
}

function voiceBubble(voice) {
  const bars = Array.from({ length: 22 }, (_, i) => el("i", { style: `height:${6 + ((i * 7) % 13)}px` }));
  const label = el("span", { class: "label", text: "تشغيل" });
  const play = el("span", { class: "play", "aria-hidden": "true" });
  play.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>';
  const button = el("button", { class: "voice", type: "button", "data-state": "idle", "aria-label": "تشغيل النطق" },
    play, el("span", { class: "wave" }, ...bars), label);

  const setState = (state, text) => {
    button.dataset.state = state;
    label.textContent = text;
    play.innerHTML = state === "playing"
      ? '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M7 6h4v12H7zm6 0h4v12h-4z" fill="currentColor"/></svg>'
      : '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>';
  };
  const reset = () => setState("idle", "تشغيل");

  button.addEventListener("click", async () => {
    if (button.dataset.state === "playing" || button.dataset.state === "loading") {
      stopCurrent();
      return;
    }
    stopCurrent();
    currentReset = reset;
    setState("loading", "…");
    for (const url of await sources(voice.record)) {
      try {
        const audio = await playUrl(url, () => {
          currentAudio = null;
          currentReset = null;
          reset();
        });
        if (currentReset !== reset) { audio.pause(); return; }   // المستخدم أوقف أو شغّل غيره أثناء التحميل
        currentAudio = audio;
        setState("playing", "إيقاف");
        return;
      } catch {
        // جرّب المصدر التالي
      }
    }
    if (speak(voice.record, () => { currentReset = null; reset(); })) {
      setState("playing", "إيقاف");
      return;
    }
    currentReset = null;
    setState("idle", "لا يوجد صوت");
    setTimeout(reset, 2500);
  });
  return button;
}

// ---------- الرسائل الثابتة ----------
function addWelcome() {
  const bubble = el("div", { class: "msg" });
  bubble.append(el("img", { class: "welcome-img", src: "assets/welcome.jpg", alt: "" }));
  bubble.append(el("p", { dir: "auto", text: WELCOME_TEXT }));
  addBubble(bubble);
}

function addHelp() {
  addBubble(el("div", { class: "msg" }, el("p", { dir: "auto", text: `📖 القاموس القبطي البحيري\n\n${HELP_TEXT}` })));
}

// ---------- معالجة ما يكتبه المستخدم ----------
function typingBubble() {
  return el("div", { class: "msg", "aria-label": "جارٍ الكتابة" }, el("span", { class: "typing" }, el("i"), el("i"), el("i")));
}

async function handleInput(raw) {
  const text = raw.trim();
  if (!text || busy || !ready) return;
  busy = true;
  addBubble(el("div", { class: "msg mine", dir: "auto", text }));

  if (text === "/start") addWelcome();
  else if (text === "/help") addHelp();
  else if (text.startsWith("/")) addBubble(el("div", { class: "msg" }, el("p", { dir: "auto", text: COMMAND_FALLBACK_TEXT })));
  else {
    const typing = addBubble(typingBubble());
    await new Promise((resolve) => setTimeout(resolve, 0));   // دع المتصفح يرسم مؤشر الكتابة قبل بناء الفهارس أول مرة
    let result = null;
    try {
      result = search(text);
    } catch (error) {
      console.error(error);
    }
    typing.remove();
    if (result) showResult(result);
    else addBubble(el("div", { class: "msg" }, el("p", { text: "حدث خطأ أثناء البحث. حاول مرة أخرى." })));
  }
  busy = false;
  input.focus();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = input.value;
  input.value = "";
  handleInput(value);
});
helpBtn.addEventListener("click", () => { addHelp(); });
clearBtn.addEventListener("click", () => {
  stopCurrent();
  chat.replaceChildren();
  addWelcome();
  input.focus();
});

// ---------- التحميل ----------
async function load() {
  addWelcome();
  try {
    const response = await fetch(CONFIG.DICTIONARY_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    init(await response.json());
  } catch (error) {
    console.error(error);
    statusEl.textContent = "تعذّر تحميل القاموس";
    addBubble(el("div", { class: "msg" }, el("p", { text: "تعذّر تحميل ملف القاموس. تحقق من الاتصال ثم أعد تحميل الصفحة." })));
    return;
  }
  ready = true;
  statusEl.textContent = `${recordCount().toLocaleString("en-US")} سجلًا في القاموس`;
  input.disabled = false;
  sendBtn.disabled = false;
  input.placeholder = "اكتب الكلمة أو أول حروفها";
  input.focus({ preventScroll: true });
  const initial = new URLSearchParams(location.search).get("q");
  if (initial) handleInput(initial);
}

load();
