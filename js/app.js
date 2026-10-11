// واجهة الموقع: تخاطب عامل الويب (كل العمل الثقيل داخل العامل)، وتعرض بطاقات النتائج.
// الواجهة لا تلمس بيانات القاموس إطلاقًا — لذلك لا تتجمد الصفحة أول ما تفتح.

const $ = (id) => document.getElementById(id);
const input = $("input");
const clearBtn = $("clear");
const statusEl = $("status");
const liveDot = $("liveDot");
const loadbar = $("loadbar");
const resultsHead = $("resultsHead");
const resultsTitle = $("resultsTitle");
const resultsMeta = $("resultsMeta");
const cards = $("cards");
const moreBtn = $("more");
const emptyEl = $("empty");
const factCount = $("factCount");

const PAGE = 12;
let seq = 0;
let latest = "";
let booted = false;
let bootError = null;
let current = null;
let shown = 0;
let ids = null;              // إملاء الكلمة -> رقم الكلمة (لملفات النطق)
let humanIds = new Set();    // معرفات ذات تسجيل بشري

const workerUrl = new URL("./worker.js", import.meta.url);
workerUrl.searchParams.set("v", "neo1");
const worker = new Worker(workerUrl, { type: "module" });

worker.addEventListener("message", ({ data }) => {
  if (data.type === "progress") {
    statusEl.textContent = data.detail;
    loadbar.classList.add("on");
    return;
  }
  if (data.type === "ready") {
    booted = true;
    loadbar.classList.remove("on");
    liveDot.hidden = false;
    factCount.textContent = data.count.toLocaleString("ar-EG");
    statusEl.textContent = data.cached ? "جاهز — نسخة محلية محدَّثة" : "جاهز — متصل بالمصدر مباشرة";
    if (latest) runSearch(latest); // لو كتب المستخدم قبل اكتمال التحميل
    return;
  }
  if (data.type === "boot-error") {
    bootError = data.message;
    loadbar.classList.remove("on");
    statusEl.textContent = "تعذّر التحميل";
    renderNotice(`تعذّر تحميل القاموس من المصدر: ${data.message}. تأكد من الاتصال ثم حدّث الصفحة.`, true);
    return;
  }
  if (data.id != null && data.reply) {
    const reply = data.reply;
    if (reply.error) { statusEl.textContent = "تعذّر البحث"; return; }
    if (reply.empty) { showEmpty(); return; }
    current = reply;
    shown = 0;
    statusEl.textContent = "جاهز";
    resultsMeta.textContent = `${reply.total.toLocaleString("ar-EG")} نتيجة · ${reply.tookMs} م‌ث`;
    renderPage();
  }
});

worker.addEventListener("error", (event) => {
  bootError = event.message ?? "خطأ غير متوقع";
  loadbar.classList.remove("on");
  statusEl.textContent = "تعذّر التشغيل";
});

// ── التمهيد ───────────────────────────────
worker.postMessage({ id: ++seq, op: "boot" });
loadIdMap();
loadHumanIds();

async function loadIdMap() {
  try {
    const res = await fetch("data/word_ids.json", { cache: "force-cache" });
    if (res.ok) {
      const registry = await res.json();
      ids = registry.ids ?? null;
      worker.postMessage({ op: "ids", ids });
      if (latest) runSearch(latest);
    }
  } catch { /* بدون معرفات: يبقى النطق الاحتياطي فقط */ }
}

async function loadHumanIds() {
  try {
    const res = await fetch("audio-human/manifest.json", { cache: "force-cache" });
    if (res.ok) humanIds = new Set(await res.json());
  } catch { humanIds = new Set(); }
}

// ── إدخال البحث ───────────────────────────────
let debounce = null;
input.addEventListener("input", () => {
  clearBtn.hidden = !input.value;
  clearTimeout(debounce);
  const q = input.value.trim();
  if (!q) { showEmpty(); return; }
  debounce = setTimeout(() => runSearch(q), 150);
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    clearTimeout(debounce);
    runSearch(input.value.trim());
  }
});

document.querySelectorAll(".chip").forEach((chip) =>
  chip.addEventListener("click", () => {
    input.value = chip.dataset.q;
    clearBtn.hidden = false;
    runSearch(chip.dataset.q);
    input.focus();
  })
);

clearBtn.addEventListener("click", () => {
  input.value = "";
  clearBtn.hidden = true;
  showEmpty();
  input.focus();
});

moreBtn.addEventListener("click", () => { shown += PAGE; renderPage(); });

function runSearch(q) {
  latest = q;
  if (!booted) { statusEl.textContent = "لحظة — يجهّز القاموس أول مرة…"; return; }
  seq++;
  worker.postMessage({ id: seq, op: "search", query: q });
}

// ── العرض ───────────────────────────────
function showEmpty() {
  current = null;
  resultsHead.hidden = true;
  moreBtn.hidden = true;
  cards.replaceChildren();
  emptyEl.hidden = false;
}

function renderNotice(text, isError) {
  resultsHead.hidden = true;
  emptyEl.hidden = true;
  moreBtn.hidden = true;
  cards.replaceChildren(Object.assign(document.createElement("div"), {
    className: `notice${isError ? " error" : ""}`,
    textContent: text,
  }));
}

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

function renderPage() {
  emptyEl.hidden = true;
  resultsHead.hidden = false;
  const slice = current.results.slice(0, Math.max(shown, PAGE));
  const nodes = slice.map((r, i) => cardNode(r, i));
  cards.replaceChildren(...nodes);
  shown = slice.length;
  moreBtn.hidden = current.results.length <= shown;
  resultsTitle.replaceChildren(`نتائج «${input.value.trim()}»`);
}

function cardNode(r, index) {
  const card = el("article", "card");
  card.style.animationDelay = `${Math.min(index, 10) * 25}ms`;

  const top = el("div", "card-top");
  top.append(el("span", "word", r.coptic));
  if (r.ipa) top.append(el("span", "ipa", `/${r.ipa}/`));

  const tags = el("div", "tags");
  if (r.kind) tags.append(el("span", "tag", r.kind));
  if (r.gender) tags.append(el("span", "tag", r.gender));
  if (r.origin) tags.append(el("span", "tag origin", r.origin));
  if (tags.children.length) top.append(tags);

  const voice = voiceBtn(r);
  if (voice) top.append(voice);
  card.append(top);

  if (r.meaning) card.append(el("p", "meaning", r.meaning));

  const translations = el("div", "translations");
  for (const item of r.translations ?? []) {
    const span = el("span");
    const b = document.createElement("b");
    b.textContent = item.label ? `${item.label}: ` : "";
    span.append(b, item.text);
    translations.append(span);
  }
  if (translations.children.length) card.append(translations);
  return card;
}

// ── النطق ───────────────────────────────
// المصادر بالترتيب: تسجيل بشري (إن وُجد)، تسجيل البوت برقم الكلمة، ثم نطق المتصفح.
const BOT_AUDIO = "https://raw.githubusercontent.com/abr429701-oss/coptic-dictionary-bot/audio";
const HUMAN_AUDIO = "audio-human";

function voiceBtn(r) {
  const id = ids?.[r.coptic.toLowerCase()] ?? null;
  if (id == null && !r.ipa) return null;
  const button = el("button", "voice");
  button.type = "button";
  button.setAttribute("aria-label", "استمع إلى النطق");
  button.dataset.state = "idle";
  button.innerHTML =
    '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg><span>النطق</span>';
  const label = button.querySelector("span");
  const set = (state, text, playing) => {
    button.dataset.state = state;
    label.textContent = text;
    button.querySelector("svg").innerHTML = playing
      ? '<path d="M7 5h4v14H7zm6 0h4v14h-4z" fill="currentColor"/>'
      : '<path d="M8 5v14l11-7z" fill="currentColor"/>';
  };
  const reset = () => set("idle", "النطق", false);

  button.addEventListener("click", async () => {
    if (button.dataset.state !== "idle") { stopAudio(); reset(); return; }
    stopAudio();
    set("loading", "تحميل…", false);
    const sources = [];
    if (id != null) {
      if (humanIds.has(id)) sources.push(`${HUMAN_AUDIO}/${id}.ogg`);
      sources.push(`${BOT_AUDIO}/${id}.ogg`);
    }
    for (const url of sources) {
      try {
        const audio = new Audio(url);
        audio.preload = "none";
        currentAudio = audio;
        await audio.play();
        set("playing", "إيقاف", true);
        audio.onended = audio.onerror = () => { currentAudio = null; reset(); };
        return;
      } catch { /* جرّب المصدر التالي */ }
    }
    if (speakTTS(r)) { set("playing", "إيقاف", true); return; }
    set("idle", "لا يوجد تسجيل", false);
    setTimeout(reset, 2000);
  });
  return button;
}

let currentAudio = null;
function stopAudio() {
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

function speakTTS(r) {
  if (!("speechSynthesis" in window) || !r?.ipa) return false;
  const utterance = new SpeechSynthesisUtterance(r.ipa);
  utterance.lang = "en-US";
  utterance.rate = 0.5;
  utterance.onend = utterance.onerror = resetPlayingVoice;
  window.speechSynthesis.speak(utterance);
  return true;
}

function resetPlayingVoice() {
  const playing = document.querySelector('.voice[data-state="playing"]');
  if (playing) { playing.dataset.state = "idle"; playing.querySelector("span").textContent = "النطق"; }
}
