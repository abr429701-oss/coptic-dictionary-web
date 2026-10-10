import { CONFIG } from "./config.js";
import { spokenText } from "./engine.js";

const form = document.getElementById("searchForm");
const input = document.getElementById("input");
const clearBtn = document.getElementById("clearBtn");
const statusEl = document.getElementById("status");
const recordCountEl = document.getElementById("recordCount");
const resultsEl = document.getElementById("results");
const resultsTitle = document.getElementById("resultsTitle");
const resultBadge = document.getElementById("resultBadge");
const examplesEl = document.getElementById("examples");

let engineReady = false;
let queuedSearch = "";
let latestQuery = "";
let activeSuggestions = null;
let searchSequence = 0;
let debounceTimer = null;
let currentAudio = null;
let currentReset = null;
const pendingRequests = new Map();
let requestId = 0;

let resolveReady;
let rejectReady;
const workerReady = new Promise((resolve, reject) => {
  resolveReady = resolve;
  rejectReady = reject;
});
const workerUrl = new URL("./search-worker.js", import.meta.url);
workerUrl.searchParams.set("v", "33f9e7e");
const worker = new Worker(workerUrl, { type: "module" });

function workerRequest(op, payload = {}) {
  const id = ++requestId;
  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
    worker.postMessage({ id, op, ...payload });
  });
}

function hydrate(value) {
  if (Array.isArray(value)) return value.map(hydrate);
  if (!value || typeof value !== "object") return value;
  if (Number.isInteger(value.__workerAction)) {
    const actionId = value.__workerAction;
    return () => workerRequest("action", { actionId });
  }
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, hydrate(child)]));
}

worker.addEventListener("message", ({ data }) => {
  if (data.type === "ready") {
    engineReady = true;
    resolveReady(data.count);
    recordCountEl.textContent = data.count.toLocaleString("en-US");
    statusEl.textContent = "جاهز للبحث";
    if (queuedSearch) {
      const query = queuedSearch;
      queuedSearch = "";
      void runSearch(query);
    }
    return;
  }
  if (data.type === "init-error") {
    rejectReady(new Error(data.message));
    statusEl.textContent = "تعذّر تحميل القاموس";
    renderNotice("تعذّر تجهيز قاعدة البحث. تحقق من الاتصال ثم أعد تحميل الصفحة.", "error");
    return;
  }
  const pending = pendingRequests.get(data.id);
  if (!pending) return;
  pendingRequests.delete(data.id);
  if (data.error) pending.reject(new Error(data.error));
  else pending.resolve(hydrate(data.result));
});
worker.addEventListener("error", (event) => {
  rejectReady(event.error ?? new Error("تعذّر تشغيل محرك البحث"));
  for (const pending of pendingRequests.values()) pending.reject(event.error ?? new Error("تعذّر تشغيل محرك البحث"));
  pendingRequests.clear();
  statusEl.textContent = "تعذّر تشغيل البحث";
});

function el(tag, props = {}, ...children) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "class") element.className = value;
    else if (key === "text") element.textContent = value;
    else element.setAttribute(key, value);
  }
  for (const child of children) if (child) element.append(child);
  return element;
}

function isCoptic(value) {
  return /[Ⲁ-⳿Ϣ-ϯ]/u.test(String(value ?? ""));
}

function languageFor(query) {
  if (/[؀-ۿ]/u.test(query)) return "العربية";
  if (isCoptic(query)) return "القبطية";
  if (/[àâçéèêëîïôùûüÿœ]/iu.test(query)) return "Français";
  if (/[äöüß]/iu.test(query)) return "Deutsch";
  return "English";
}

function showInitial() {
  resultsTitle.textContent = "ابدأ بكلمة تبحث عنها";
  resultBadge.textContent = "بحث مباشر";
  resultsEl.replaceChildren(
    el("div", { class: "empty-state" },
      el("span", { class: "empty-glyph", "aria-hidden": "true", text: "ⲁ" }),
      el("h3", { text: "قاموس، لا قوائم معقّدة." }),
      el("p", { text: "اكتب كلمة أو جزءًا منها لتظهر المطابقات فورًا. يعمل البحث بالقبطية والعربية والإنجليزية والفرنسية والألمانية." })
    )
  );
}

function renderNotice(message, type = "empty") {
  resultsTitle.textContent = type === "error" ? "تعذّر البحث" : "لا توجد مطابقة";
  resultBadge.textContent = type === "error" ? "مشكلة تحميل" : "0 نتائج";
  const notice = el("div", { class: "no-result" },
    el("span", { class: "no-result-mark", "aria-hidden": "true", text: type === "error" ? "!" : "⌕" }),
    el("div", {},
      el("h3", { text: type === "error" ? "تعذّر الوصول إلى القاموس" : "لم نعثر على مدخل مطابق" }),
      el("p", { text: message })
    )
  );
  resultsEl.replaceChildren(notice);
}

function renderLoading(query) {
  resultsTitle.textContent = `البحث عن «${query}»`;
  resultBadge.textContent = "جارٍ البحث";
  resultsEl.replaceChildren(
    el("div", { class: "searching-state" },
      el("span", { class: "spinner", "aria-hidden": "true" }),
      el("span", { text: "جارٍ فحص المداخل…" })
    )
  );
}

function renderSuggestions(message, query = latestQuery) {
  activeSuggestions = message;
  resultsTitle.textContent = `مطابقات «${query}»`;
  resultBadge.textContent = `اقتراحات · ${languageFor(query)}`;
  const heading = el("div", { class: "suggestions-heading" },
    el("span", { text: message.title || "اختر المدخل الأقرب إلى بحثك" }),
    el("span", { text: `${message.buttons.length} في هذه الصفحة` })
  );
  const list = el("div", { class: "result-list", role: "list" });
  message.buttons.forEach((item, index) => {
    const word = item.text || "مدخل";
    const isCop = isCoptic(word);
    const button = el("button", { class: "result-item", type: "button", role: "listitem" },
      el("span", { class: "result-item-main" },
        el("span", { class: `result-item-word${isCop ? " is-coptic" : ""}`, dir: "auto", text: word }),
        el("span", { class: "result-item-subtitle", text: "عرض المعنى والتفاصيل" })
      ),
      el("span", { class: "result-item-arrow", "aria-hidden": "true", text: "←" })
    );
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        const result = await item.run();
        if (result) renderMessage(result, query);
      } catch (error) {
        console.error(error);
        renderNotice("تعذّر فتح هذا المدخل. أعد المحاولة.", "error");
      } finally {
        button.disabled = false;
      }
    });
    list.append(button);
  });
  const content = el("div", {}, heading, list);
  if (message.nav?.length) {
    const pagination = el("div", { class: "pagination" });
    message.nav.forEach((item) => {
      const button = el("button", { class: "pager-btn", type: "button", text: item.text });
      button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          const next = await item.run();
          if (next) renderSuggestions(next, query);
        } catch (error) {
          console.error(error);
          renderNotice("تعذّر تحميل الصفحة التالية من النتائج.", "error");
        }
      });
      pagination.append(button);
    });
    content.append(pagination);
  }
  resultsEl.replaceChildren(content);
}

function renderEntry(message, query = latestQuery) {
  resultsTitle.textContent = `مدخل في القاموس`;
  resultBadge.textContent = languageFor(query);
  const fields = message.fields ?? [];
  const [headLabel, headValue] = fields[0] ?? ["الكلمة", query];
  const title = el("h3", { class: `entry-word${isCoptic(headValue) ? " is-coptic" : ""}`, dir: "auto", text: headValue || query });
  const card = el("article", { class: "entry-card" });
  const top = el("div", { class: "entry-actions-top" },
    el("span", { class: "entry-label", text: `مدخل معجمي · ${headLabel}` })
  );
  if (activeSuggestions) {
    const back = el("button", { class: "back-to-results", type: "button", text: "← العودة إلى النتائج" });
    back.addEventListener("click", () => renderSuggestions(activeSuggestions, query));
    top.append(back);
  }
  card.append(top, title);
  const definition = el("dl", { class: "entry-fields" });
  fields.slice(1).forEach(([label, value]) => {
    if (!String(value ?? "").trim()) return;
    const item = el("div", { class: "entry-field" });
    const dt = el("dt", { text: label });
    const dd = el("dd", { dir: "auto", text: value });
    if (isCoptic(value)) dd.classList.add("is-coptic");
    item.append(dt, dd);
    definition.append(item);
  });
  if (definition.childElementCount) card.append(definition);

  const footer = el("div", { class: "entry-footer" });
  if (message.voice) footer.append(voiceButton(message.voice));
  if (message.more) {
    const more = el("button", { class: "entry-more", type: "button", text: message.more.text || "معنى آخر" });
    more.addEventListener("click", async () => {
      more.disabled = true;
      try {
        const next = await message.more.run();
        if (next) renderMessage(next, query);
      } catch (error) {
        console.error(error);
      } finally {
        more.disabled = false;
      }
    });
    footer.append(more);
  }
  if (footer.childElementCount) card.append(footer);
  resultsEl.replaceChildren(card);
}

function renderMessage(message, query = latestQuery) {
  if (!message) return;
  if (message.kind === "entry") renderEntry(message, query);
  else if (message.kind === "suggest") renderSuggestions(message, query);
  else renderNotice(message.text || "لا توجد نتائج. جرّب كلمة أخرى.");
}

async function runSearch(rawQuery, { updateAddress = true } = {}) {
  const query = String(rawQuery ?? "").trim();
  if (!query) {
    searchSequence += 1;
    latestQuery = "";
    activeSuggestions = null;
    showInitial();
    statusEl.textContent = engineReady ? "جاهز للبحث" : "يُحضّر القاموس…";
    if (updateAddress) history.replaceState(null, "", location.pathname);
    return;
  }
  latestQuery = query;
  activeSuggestions = null;
  input.value = query;
  clearBtn.hidden = false;
  if (updateAddress) history.replaceState(null, "", `${location.pathname}?q=${encodeURIComponent(query)}`);
  if (!engineReady) {
    queuedSearch = query;
    resultsTitle.textContent = "يُحضّر القاموس";
    resultBadge.textContent = "لحظات";
    resultsEl.replaceChildren(el("div", { class: "searching-state" },
      el("span", { class: "spinner", "aria-hidden": "true" }),
      el("span", { text: "سيبدأ البحث تلقائيًا فور تجهيز قاعدة البيانات." })
    ));
    return;
  }

  const sequence = ++searchSequence;
  statusEl.textContent = `البحث في ${recordCountEl.textContent} مدخل…`;
  renderLoading(query);
  try {
    const result = await workerRequest("search", { query });
    if (sequence !== searchSequence) return;
    statusEl.textContent = "اكتمل البحث";
    renderMessage(result, query);
  } catch (error) {
    if (sequence !== searchSequence) return;
    console.error(error);
    statusEl.textContent = "تعذّر البحث";
    renderNotice("تعذّر تنفيذ البحث. تحقق من الاتصال ثم أعد المحاولة.", "error");
  }
}

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
    audio.preload = "none";
    let started = false;
    audio.addEventListener("error", () => reject(new Error("audio error")), { once: true });
    audio.addEventListener("ended", onEnd, { once: true });
    audio.addEventListener("playing", () => {
      started = true;
      resolve(audio);
    }, { once: true });
    audio.src = url;
    audio.play().catch((error) => { if (!started) reject(error); });
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

let humanIds = null;
async function loadHumanIds() {
  if (humanIds) return humanIds;
  try {
    const response = await fetch(`${CONFIG.HUMAN_AUDIO_URL}/manifest.json`, { cache: "force-cache" });
    humanIds = new Set(response.ok ? await response.json() : []);
  } catch {
    humanIds = new Set();
  }
  return humanIds;
}

async function audioSources(record) {
  if (record?.id == null) return [];
  const id = encodeURIComponent(record.id);
  const list = [];
  if (CONFIG.HUMAN_AUDIO && (await loadHumanIds()).has(Number(record.id))) list.push(`${CONFIG.HUMAN_AUDIO_URL}/${id}.ogg`);
  list.push(`${CONFIG.AUDIO_BASE_URL.replace(/\/+$/u, "")}/${id}.ogg`);
  return list;
}

function voiceButton(voice) {
  const icon = el("span", { class: "play", "aria-hidden": "true" });
  const label = el("span", { text: "استمع إلى النطق" });
  const button = el("button", { class: "voice", type: "button", "aria-label": "استمع إلى النطق", "data-state": "idle" }, icon, label);
  const setState = (state, text) => {
    button.dataset.state = state;
    label.textContent = text;
    icon.innerHTML = state === "playing"
      ? '<svg viewBox="0 0 24 24" width="13" height="13"><path d="M7 5h4v14H7zm6 0h4v14h-4z" fill="currentColor"/></svg>'
      : '<svg viewBox="0 0 24 24" width="13" height="13"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>';
  };
  const reset = () => setState("idle", "استمع إلى النطق");
  setState("idle", "استمع إلى النطق");
  button.addEventListener("click", async () => {
    if (button.dataset.state === "playing" || button.dataset.state === "loading") {
      stopCurrent();
      return;
    }
    stopCurrent();
    currentReset = reset;
    setState("loading", "جارٍ التحميل…");
    for (const url of await audioSources(voice.record)) {
      try {
        const audio = await playUrl(url, () => {
          currentAudio = null;
          currentReset = null;
          reset();
        });
        if (currentReset !== reset) { audio.pause(); return; }
        currentAudio = audio;
        setState("playing", "إيقاف النطق");
        return;
      } catch { /* تابع إلى مصدر النطق التالي */ }
    }
    if (speak(voice.record, () => { currentReset = null; reset(); })) {
      setState("playing", "إيقاف النطق");
      return;
    }
    currentReset = null;
    setState("idle", "لا يتوفر تسجيل");
    setTimeout(reset, 2200);
  });
  return button;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  clearTimeout(debounceTimer);
  void runSearch(input.value);
});
input.addEventListener("input", () => {
  clearBtn.hidden = !input.value;
  clearTimeout(debounceTimer);
  const query = input.value.trim();
  if (!query) {
    void runSearch("");
    return;
  }
  if ([...query].length >= 2) debounceTimer = setTimeout(() => { void runSearch(query); }, 220);
});
clearBtn.addEventListener("click", () => {
  clearTimeout(debounceTimer);
  input.value = "";
  clearBtn.hidden = true;
  stopCurrent();
  void runSearch("");
  input.focus();
});
examplesEl.addEventListener("click", (event) => {
  const button = event.target.closest("[data-query]");
  if (!button) return;
  input.value = button.dataset.query;
  clearBtn.hidden = false;
  void runSearch(input.value);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "/" && document.activeElement !== input && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    input.focus();
  }
  if (event.key === "Escape" && document.activeElement === input && input.value) {
    input.value = "";
    clearBtn.hidden = true;
    void runSearch("");
  }
});

statusEl.textContent = "يُحضّر القاموس في الخلفية…";
workerReady.then((count) => {
  recordCountEl.textContent = count.toLocaleString("en-US");
  statusEl.textContent = "جاهز للبحث";
  if (queuedSearch) {
    const query = queuedSearch;
    queuedSearch = "";
    void runSearch(query);
  }
}).catch((error) => {
  console.error(error);
  statusEl.textContent = "تعذّر تحميل القاموس";
  renderNotice("تعذّر تجهيز قاعدة البحث. تحقق من الاتصال ثم أعد تحميل الصفحة.", "error");
});

const initialQuery = new URLSearchParams(location.search).get("q");
if (initialQuery) {
  input.value = initialQuery;
  clearBtn.hidden = false;
  void runSearch(initialQuery, { updateAddress: false });
}
