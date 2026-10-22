import { init, search, detail, count, matchParts } from "./search.js?b=__B__";
import { parts, normalize, words } from "./norm.js?b=__B__";
import { spokenText } from "./speech.js?b=__B__";

const AUDIO_BASE = "https://raw.githubusercontent.com/abr429701-oss/coptic-dictionary-bot/audio";
const HUMAN_AUDIO = "audio-human";
let humanAudioIds = new Set();
const humanAudioReady = fetch(`${HUMAN_AUDIO}/manifest.json`).then((response) => response.json()).then((ids) => { humanAudioIds = new Set(ids.map(Number)); }).catch(() => {});
const SHEET_ID = "17n8MgiCIe4xVRXqM7W74zCSeqwo6pX8L-Pj2wSsl0ek";
const APP_SHEET_ID = "1kZKjF2KDsGT0HslGSenN-pDTzx4FpX0QDPqX0ZOnriY";
const APP_CONFIG_URL = `https://docs.google.com/spreadsheets/d/${APP_SHEET_ID}/gviz/tq?tqx=out:json&sheet=APP_CONFIG&range=B:B`;
const NOTIFICATIONS_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out%3Acsv&sheet=bot&range=B2%3AB`;
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
const I18N = {
  ar: { searchPlaceholder:"اكتب كلمة للبحث…", searchButton:"ابحث", searchHeading:"من كلمةٍ إلى حكاية", loading:"جاري البحث…", enterWord:"الرجاء إدخال كلمة للبحث!", results:"{n} نتيجة", noResult:"الكلمة غير موجودة حاليًا؛ ستتم الإضافة قريبًا.", searchError:"حدث خطأ في البحث؛ تحقق من الاتصال وحاول مرة أخرى.", detailError:"تعذّر تحميل تفاصيل المدخل.", moreResults:"اضغط لمعرفة المزيد من المعاني　⌄", backToResults:"رجوع إلى النتائج", fieldWord:"الكلمة", fieldMeaning:"المعنى", fieldKind:"النوع", fieldOrigin:"الأصل", audioUnavailable:"لا يتوفر ملف صوت للتنزيل لهذا المدخل.", audioPlayError:"تعذّر تشغيل الملف الصوتي؛ جرّب النطق الآلي.", speechUnavailable:"لا يتوفر نطق لهذا المدخل.", copied:"تم نسخ النص", copyError:"تعذّر النسخ", shareError:"تعذّر إنشاء بطاقة المشاركة؛ حاول مرة أخرى.", shareToolError:"تعذّر تحميل أداة إنشاء الصورة.", learnLink:"🤖 بوت تيليجرام — القاموس القبطي", footerDesc:"القاموس القبطي Ⲭⲏⲙⲓ هو أول قاموس قبطي ناطق على الإنترنت، وسيفيدك كثيراً على تحسين لغتك القبطية، نتمنى لك تجربة فريدة.", downloadApp:"📱 حمّل تطبيق القاموس", qrTitle:"حمّل تطبيق القاموس على الموبايل", qrHint:"امسح الباركود بالكاميرا لتحميل التطبيق", directDownload:"أو اضغط هنا للتحميل المباشر ↓", qrError:"تعذّر جلب رابط التحميل.", qrLoading:"جاري التحميل…", newNotification:"هناك إشعار جديد!", notificationsTitle:"الإشعارات الجديدة", skip:"انتقل إلى البحث", brandCaption:"ⲭⲏⲙⲓ · القاموس القبطي", shareTitle:"القاموس القبطي · ⲭⲏⲙⲓ", dateLocale:"ar-EG" },
  en: { searchPlaceholder:"Type a word to search…", searchButton:"Search", searchHeading:"From a word to a story", loading:"Searching…", enterWord:"Please enter a word to search!", results:"{n} results", noResult:"This word is not yet available; it will be added soon.", searchError:"Search error; check your connection and try again.", detailError:"Could not load entry details.", moreResults:"Tap for more meanings　⌄", backToResults:"Back to results", fieldWord:"Word", fieldMeaning:"Meaning", fieldKind:"Type", fieldOrigin:"Origin", audioUnavailable:"No audio file available for download for this entry.", audioPlayError:"Could not play the audio; try text-to-speech.", speechUnavailable:"No pronunciation available for this entry.", copied:"Text copied", copyError:"Copy failed", shareError:"Could not create share card; try again.", shareToolError:"Could not load the image tool.", learnLink:"🤖 Telegram Bot — Coptic Dictionary", footerDesc:"Coptic Dictionary Ⲭⲏⲙⲓ is the first spoken Coptic dictionary on the internet. It will help you improve your Coptic. We wish you a unique experience.", downloadApp:"📱 Download the Dictionary App", qrTitle:"Download the Dictionary App", qrHint:"Scan the QR code with your camera to download the app", directDownload:"Or click here for direct download ↓", qrError:"Could not fetch the download link.", qrLoading:"Loading…", newNotification:"New notification!", notificationsTitle:"New notifications", skip:"Skip to search", brandCaption:"ⲭⲏⲙⲓ · Coptic Dictionary", shareTitle:"Coptic Dictionary · ⲭⲏⲙⲓ", dateLocale:"en-GB" },
  fr: { searchPlaceholder:"Tapez un mot à rechercher…", searchButton:"Rechercher", searchHeading:"D'un mot à une histoire", loading:"Recherche…", enterWord:"Veuillez saisir un mot à rechercher !", results:"{n} résultats", noResult:"Ce mot n'est pas encore disponible ; il sera bientôt ajouté.", searchError:"Erreur de recherche ; vérifiez votre connexion et réessayez.", detailError:"Impossible de charger les détails de l'entrée.", moreResults:"Appuyez pour plus de sens　⌄", backToResults:"Retour aux résultats", fieldWord:"Mot", fieldMeaning:"Sens", fieldKind:"Type", fieldOrigin:"Origine", audioUnavailable:"Aucun fichier audio disponible pour cette entrée.", audioPlayError:"Impossible de lire l'audio ; essayez la synthèse vocale.", speechUnavailable:"Aucune prononciation disponible.", copied:"Texte copié", copyError:"Échec de la copie", shareError:"Impossible de créer la carte de partage ; réessayez.", shareToolError:"Impossible de charger l'outil d'image.", learnLink:"🤖 Bot Telegram — Dictionnaire copte", footerDesc:"Le Dictionnaire copte Ⲭⲏⲙⲓ est le premier dictionnaire copte parlé sur Internet. Il vous aidera à améliorer votre copte. Nous vous souhaitons une expérience unique.", downloadApp:"📱 Télécharger l'application", qrTitle:"Télécharger l'application du dictionnaire", qrHint:"Scannez le code QR avec votre appareil photo pour télécharger l'application", directDownload:"Ou cliquez ici pour le téléchargement direct ↓", qrError:"Impossible de récupérer le lien de téléchargement.", qrLoading:"Chargement…", newNotification:"Nouvelle notification !", notificationsTitle:"Nouvelles notifications", skip:"Aller à la recherche", brandCaption:"ⲭⲏⲙⲓ · Dictionnaire copte", shareTitle:"Dictionnaire copte · ⲭⲏⲙⲓ", dateLocale:"fr-FR" },
  de: { searchPlaceholder:"Wort zum Suchen eingeben…", searchButton:"Suchen", searchHeading:"Von einem Wort zu einer Geschichte", loading:"Suche…", enterWord:"Bitte geben Sie ein Suchwort ein!", results:"{n} Ergebnisse", noResult:"Dieses Wort ist noch nicht verfügbar; es wird bald hinzugefügt.", searchError:"Suchfehler; Verbindung prüfen und erneut versuchen.", detailError:"Details konnten nicht geladen werden.", moreResults:"Tippen für weitere Bedeutungen　⌄", backToResults:"Zurück zu den Ergebnissen", fieldWord:"Wort", fieldMeaning:"Bedeutung", fieldKind:"Typ", fieldOrigin:"Herkunft", audioUnavailable:"Keine Audiodatei zum Download verfügbar.", audioPlayError:"Audio konnte nicht abgespielt werden; Sprachsynthese versuchen.", speechUnavailable:"Keine Aussprache verfügbar.", copied:"Text kopiert", copyError:"Kopieren fehlgeschlagen", shareError:"Share-Karte konnte nicht erstellt werden.", shareToolError:"Bildtool konnte nicht geladen werden.", learnLink:"🤖 Telegram-Bot — Koptisches Wörterbuch", footerDesc:"Das Koptische Wörterbuch Ⲭⲏⲙⲓ ist das erste gesprochene koptische Wörterbuch im Internet. Es hilft Ihnen, Ihr Koptisch zu verbessern. Wir wünschen Ihnen ein einzigartiges Erlebnis.", downloadApp:"📱 App herunterladen", qrTitle:"Wörterbuch-App herunterladen", qrHint:"Scannen Sie den QR-Code mit der Kamera, um die App herunterzuladen", directDownload:"Oder hier klicken für Direktdownload ↓", qrError:"Download-Link konnte nicht abgerufen werden.", qrLoading:"Laden…", newNotification:"Neue Benachrichtigung!", notificationsTitle:"Neue Benachrichtigungen", skip:"Zur Suche springen", brandCaption:"ⲭⲏⲙⲓ · Koptisches Wörterbuch", shareTitle:"Koptisches Wörterbuch · ⲭⲏⲙⲓ", dateLocale:"de-DE" }
};
let currentLang = "ar";
function t(key, vars) {
  let val = (I18N[currentLang] || I18N.ar)[key] ?? I18N.ar[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) val = val.replaceAll(`{${k}}`, String(v));
  return val;
}
function detectLang(text) {
  if (/[\u0600-\u06FF]/.test(text)) return "ar";
  if (/[\u2C80-\u2CFF\u03E2-\u03EF]/.test(text)) return "ar";
  if (/[äöüßÄÖÜ]/.test(text)) return "de";
  if (/[éèêëàâùûîïçœÉÈÊËÀÂÙÛÎÏÇŒ]/.test(text)) return "fr";
  const lower = text.toLowerCase();
  if (/\b(le|la|les|un|une|des|de|du|et|ou|est|sont|pour|avec|sans|sous|sur|dans|par|mais|donc|car|que|qui|quoi|dont|non|oui|je|tu|il|elle|nous|vous|ils|elles|cet|cette|ces|mon|ma|mes|ton|ta|tes|son|sa|ses|notre|nos|votre|vos|leur|leurs|comment|pourquoi|quand)\b/.test(lower)) return "fr";
  if (/\b(der|die|das|ein|eine|einen|einem|einer|eines|und|oder|ist|sind|von|zu|mit|für|auf|in|im|an|am|bei|nach|seit|aus|aber|wenn|weil|dass|nicht|kein|keine|ja|nein|ich|du|er|sie|es|wir|ihr|mir|dich|mich|sich|was|wer|wie|wo|wann|warum)\b/.test(lower)) return "de";
  return "en";
}
function setLang(lang) {
  if (lang === currentLang) return;
  currentLang = lang;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  $("wordInput").dir = lang === "ar" ? "rtl" : "ltr";
  $("wordInput").placeholder = t("searchPlaceholder");
  $("searchButtonText").textContent = t("searchButton");
  $("searchHeading").textContent = t("searchHeading");
  $("loaderText").textContent = t("loading");
  $("learnLink").textContent = t("learnLink");
  $("notificationBar").textContent = t("newNotification");
  $("notificationsTitle").textContent = t("notificationsTitle");
  $("skipLink").textContent = t("skip");
  $("brandCaption").textContent = t("brandCaption");
  $("appDownloadBtn").textContent = t("downloadApp");
  $("qrTitle").textContent = t("qrTitle");
  $("qrHint").textContent = t("qrHint");
  $("appDirectLink").textContent = t("directDownload");
  document.title = `ⲤⲞⲠⲦⲒⲤ ⲬⲎⲘⲒ — ${t("brandCaption")}`;
  updateDate();
}
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
function playSfx(id) { /* أصوات الأزرار معطلة */ }
function updateDate() {
  const now = new Date();
  const months = ["توت","بابه","هاتور","كيهك","طوبة","أمشير","برمهات","برمودة","بشنس","بؤونة","أبيب","مسرى","النسئ"];
  const epoch = new Date(284, 7, 29);
  const diff = Math.floor((now - epoch) / 86400000);
  const year = Math.floor(diff / 365.25);
  let dayOfYear = diff - Math.floor(year * 365.25), month = 0;
  while (dayOfYear >= 30 && month < 12) { dayOfYear -= 30; month++; }
  const coptic = `${dayOfYear + 1} ${months[month]} ${year + 1}`;
  const weekday = new Intl.DateTimeFormat(t("dateLocale"), { weekday: "long" }).format(now);
  const gregorian = new Intl.DateTimeFormat(t("dateLocale"), { year: "numeric", month: "long", day: "numeric" }).format(now);
  $("date-display").replaceChildren(make("div", { text: weekday }), make("div", { text: coptic }), make("div", { text: gregorian }));
}

// يطابق جزءًا من المعنى مع الاستعلام: كل كلمة في الاستعلام موجودة في الجزء (آخر كلمة تطابق بادئة فقط).
function partMatches(part, query) {
  const needles = words(query);
  if (!needles.length) return true;
  const tokens = words(part);
  return needles.every((n, i) => tokens.some((t) => t === n || (i === needles.length - 1 && t.startsWith(n))));
}
function renderSuggestions(query, rows) {
  const q = query.trim().toLowerCase();
  const isCopticQuery = /[\u2C80-\u2CFF\u03E2-\u03EF]/.test(q);
  const seen = new Set();
  const options = [];
  for (const row of rows) {
    const coptic = clean(row.coptic).trim();
    if (!coptic) continue;
    const meaningWords = parts(row.meaning || "");
    if (!isCopticQuery && meaningWords.length > 0) {
      for (const mw of meaningWords) {
        if (q && !partMatches(mw, query)) continue;
        const key = normalize(mw);
        if (seen.has(key)) continue;
        seen.add(key);
        options.push({ word: mw, coptic });
        if (options.length >= 7) break;
      }
    } else {
      if (seen.has(coptic)) continue;
      seen.add(coptic);
      options.push({ word: coptic, coptic, meaning: meaningWords.join("، ") });
    }
    if (options.length >= 7) break;
  }
  if (!query || !options.length) { suggestions.hidden = true; suggestions.replaceChildren(); return; }
  suggestions.replaceChildren(...options.map((option) => {
    const isCopticWord = option.word === option.coptic;
    const wordSpan = make("span", { class: "s-word" + (isCopticWord ? " cop" : ""), text: option.word });
    const subText = isCopticWord ? (option.meaning || "") : option.coptic;
    const subSpan = make("span", { class: "s-meaning" + (isCopticWord ? "" : " cop"), text: subText });
    const button = make("button", { class: "suggestion", type: "button", role: "option" }, wordSpan, subSpan);
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
function renderMeaning(value, query, selectedMeaning) {
  const wrap = make("div", { class: "meaning-list" });
  const all = matchParts(value || "", query);
  if (!all.length) { wrap.textContent = value || "—"; return wrap; }
  let list = all.filter((p) => p.matched);
  if (selectedMeaning) {
    // المعنى المحدد الذي ضغط عليه المستخدم هو الوحيد الذي يظهر (سطر واحد).
    const exact = all.filter((p) => normalize(p.text) === normalize(selectedMeaning));
    if (exact.length) list = exact;
  }
  if (!list.length) list = all; // احتياط: إن لم يوجد مطابق اعرض كل المعاني
  list.forEach((part) => {
    const line = make("div", { class: "meaning-item" });
    line.append(part.matched ? make("mark", { text: part.text }) : document.createTextNode(part.text));
    wrap.append(line);
  });
  return wrap;
}
function resolveAudio(record) {
  if (record.audio_url) return { url: record.audio_url, name: "coptic-pronunciation.ogg" };
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
  const player = make("div", { class: "audio-player-container" });
  const audio = new Audio(); audio.preload = "none";
  let sourcePromise = null;
  function ensureSource() {
    if (!sourcePromise) {
      sourcePromise = humanAudioReady.catch(() => {}).then(() => {
        const src = resolveAudio(record) || null;
        if (src) audio.src = src.url; else player.dataset.fallback = "speech";
        return src;
      });
    }
    return sourcePromise;
  }
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
    const src = await ensureSource();
    if (src) {
      if (audio.paused) {
        try { await audio.play(); play.textContent = "Ⅱ"; }
        catch { toast(t("audioPlayError")); speakFallback(record); }
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
  download.addEventListener("click", async () => {
    const src = await ensureSource();
    if (!src) { toast(t("audioUnavailable")); return; }
    const anchor = make("a", { href: src.url, download: `${clean(record.coptic).replace(/\s+/g,"_")}-${src.name}`, target: "_blank", rel: "noopener noreferrer" });
    document.body.append(anchor); anchor.click(); anchor.remove(); playSfx("copySound");
  });
  player.append(play, mute, volume, progress, elapsed, duration, download);
  player._audio = audio;
  return player;
}
function speakFallback(record) {
  const text = spokenText(record);
  if (!text || !("speechSynthesis" in window)) { toast(t("speechUnavailable")); return; }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text); utterance.lang = "en-US"; utterance.rate = 0.62;
  utterance.addEventListener("end", () => { const button = document.querySelector(".audio-control"); if (button) button.textContent = "▶"; });
  window.speechSynthesis.speak(utterance);
}
function safeFilename(text) { return String(text || "coptic-dictionary").replace(/[\\/:*?"<>|]/g, "-").slice(0, 70); }
async function shareCard(card, record, query) {
  if (typeof window.html2canvas !== "function") { toast(t("shareToolError")); return; }
  playSfx("clickSound");
  const stage = $("shareStage");
  const refs = Array.isArray(record.referenceMatches) ? record.referenceMatches : [];
  const originalMeaning = refs.find((item) => item.meaning)?.meaning || record.meanings.join("، ");
  const info = make("div", { class: "share-information" });
  for (const [label, value] of [[t("fieldWord"), clean(record.coptic)], [t("fieldMeaning"), originalMeaning], [t("fieldKind"), record.kind], [t("fieldOrigin"), record.origin]]) {
    if (!value) continue;
    const line = make("p"); line.append(make("strong", { text: `${label}: ` }), document.createTextNode(value)); info.append(line);
  }
  const avatars = make("div", { class: "share-avatars" });
  avatars.append(make("img", { class: "share-logo", src: "assets/site-logo-192.png", alt: "Coptic Dictionary logo" }));
  // العنوان + التاريخ القبطي (اتجاه صحيح غير معكوس) + التاريخ الميلادي أسفل الصور الثلاثة
  const dateDivs = $("date-display").querySelectorAll("div");
  const copticDate = dateDivs[1]?.textContent?.trim() || "";
  const gregorianDate = dateDivs[2]?.textContent?.trim() || "";
  const shareHead = make("div", { class: "share-head" });
  shareHead.append(make("h2", { class: "share-title cop", text: "ⲤⲞⲠⲦⲒⲤ ⲬⲎⲘⲒ" }));
  const datesLine = make("div", { class: "share-dates" });
  if (copticDate) datesLine.append(make("span", { dir: "ltr", class: "share-date-coptic cop", text: copticDate }));
  if (copticDate && gregorianDate) datesLine.append(document.createTextNode(" · "));
  if (gregorianDate) datesLine.append(make("span", { class: "share-date-greg", text: gregorianDate }));
  shareHead.append(datesLine);
  const children = [avatars, shareHead, info];
  // باركود تحميل التطبيق (نفس نظام نافذة التحميل) أسفل البطاقة فوقه نص التحميل
  const appLink = await fetchLatestAppLink();
  if (appLink) {
    const qrBlock = make("div", { class: "share-qr-block" });
    const caption = make("p", { class: "share-qr-caption", dir: "ltr" });
    caption.append(document.createTextNode("Download "), make("span", { class: "cop", text: "ⲤⲞⲠⲦⲒⲤ ⲬⲎⲘⲒ" }), document.createTextNode(" App"));
    qrBlock.append(caption);
    const qr = make("img", { class: "share-qr", alt: "App download QR", width: "180", height: "180" });
    qr.crossOrigin = "anonymous";
    qr.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(appLink)}`;
    qrBlock.append(qr);
    children.push(qrBlock);
  }
  const exportNode = make("div", { class: "share-export" }, ...children);
  stage.replaceChildren(exportNode);
  try {
    await Promise.all([...exportNode.querySelectorAll("img")].map((img) => img.decode().catch(() => {})));
    const canvas = await window.html2canvas(exportNode, { scale: 2, backgroundColor: "#f4ecdc", useCORS: true, logging: false });
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("image export failed");
    const filename = `${safeFilename(query)}-${safeFilename(record.coptic)}.png`;
    if (navigator.share && navigator.canShare?.({ files: [new File([blob], filename, { type: "image/png" })] })) {
      await navigator.share({ title: t("shareTitle"), files: [new File([blob], filename, { type: "image/png" })] });
    } else {
      const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 3000);
    }
  } catch (error) { console.error(error); toast(t("shareError")); }
  finally { stage.replaceChildren(); }
}
function cardLine(label, value, className = "") {
  const line = make("div", { class: "result-line" });
  line.append(make("strong", { text: `${label}:` }), make("span", { class: className, text: value || "—" }));
  return line;
}
async function createResultCard(item, query, index, selectedMeaning) {
  const record = await detail(item.id);
  const card = make("article", { class: "result-card" });
  const share = make("button", { class: "share-button", type: "button", title: "مشاركة بطاقة صورة", "aria-label": "مشاركة بطاقة صورة", text: "↗" });
  share.addEventListener("click", () => void shareCard(card, record, query)); card.append(share);

  // ترويسة البطاقة: الكلمة القبطية كبيرة + النطق + شارات النوع والأصل
  const header = make("div", { class: "card-header" });
  header.append(make("h2", { class: "card-coptic cop", text: clean(record.coptic) || "—" }));
  const phonetic = clean(record.pronunciation || record.phonetic || "");
  if (phonetic) header.append(make("div", { class: "card-phonetic", text: phonetic }));
  const reference = Array.isArray(record.referenceMatches) ? record.referenceMatches[0] : null;
  const kind = reference?.kind || record.kind;
  const origin = reference?.origin || record.origin;
  if (kind || origin) {
    const badges = make("div", { class: "card-badges" });
    if (kind) badges.append(make("span", { class: "badge badge-kind", text: kind }));
    if (origin) badges.append(make("span", { class: "badge badge-origin", text: origin }));
    header.append(badges);
  }
  card.append(header);

  const info = make("div", { class: "info-section" });
  const meaning = make("div", { class: "result-line meaning-line" });
  meaning.append(make("strong", { text: `${t("fieldMeaning")}:` }));
  const meaningContent = make("span"); meaningContent.append(renderMeaning(record.meaning || item.meaning, query, selectedMeaning));
  if (!/[\u0600-\u06ff]/u.test(record.meaning || item.meaning || "")) {
    const copy = make("button", { class: "copy-button", type: "button", title: "نسخ المعنى", "aria-label": "نسخ المعنى", text: "▢" });
    copy.addEventListener("click", async () => { try { await navigator.clipboard.writeText(record.meaning || item.meaning); playSfx("copySound"); toast(t("copied")); } catch { toast(t("copyError")); } });
    meaningContent.append(copy);
  }
  meaning.append(meaningContent); info.append(meaning);
  info.append(buildAudioPlayer(record, query)); card.append(info);
  return card;
}
let liveSeq = 0;
async function liveSearch(raw) {
  const query = String(raw ?? "").trim();
  // تبديل اللغة أصبح يدويًا فقط من الأزرار أعلى الصفحة.
  suggestions.hidden = true;
  if (!query) { ++liveSeq; resultsContainer.replaceChildren(); message.textContent = ""; message.classList.remove("error"); loader.hidden = true; searchButton.disabled = false; return; }
  const seq = ++liveSeq;
  message.textContent = ""; message.classList.remove("error"); resultsContainer.replaceChildren(); loader.hidden = false; searchButton.disabled = true; playSfx("clickSound");
  try {
    const data = await search(query);
    if (seq !== liveSeq) return;
    loader.hidden = true; searchButton.disabled = false;
    if (!data.results.length) { message.textContent = t("noResult"); message.classList.add("error"); playSfx("errorSound"); return; }
    message.textContent = t("results", { n: data.total.toLocaleString(t("dateLocale")) });
    renderResultList(data.results, query);
    playSfx("successSound");
    const params = new URLSearchParams(location.search); params.set("q", query); params.delete("w"); history.replaceState({}, "", `${location.pathname}?${params}`);
  } catch (error) {
    if (seq !== liveSeq) return;
    loader.hidden = true; searchButton.disabled = false;
    console.error(error); message.textContent = t("searchError"); message.classList.add("error"); playSfx("errorSound");
  }
}
function renderResultList(rows, query) {
  resultsContainer.replaceChildren();
  const q = query.trim().toLowerCase();
  const isCopticQuery = /[\u2C80-\u2CFF\u03E2-\u03EF]/.test(q);
  const list = make("div", { class: "result-list" });
  const appendCopticItems = () => {
    const seen = new Set();
    for (const item of rows) {
      const coptic = clean(item.coptic).trim();
      if (!coptic || seen.has(coptic)) continue;
      seen.add(coptic);
      const btn = make("button", { class: "result-item", type: "button" });
      btn.append(make("span", { class: "ri-word cop", text: coptic }));
      btn.addEventListener("click", () => { void showDetail(item, query); });
      list.append(btn);
    }
  };
  if (isCopticQuery) {
    appendCopticItems();
  } else {
    const seen = new Set();
    const nq = normalize(query);
    const wordItems = [];
    for (const item of rows) {
      const meaningWords = parts(item.meaning || "");
      for (const mw of meaningWords) {
        if (!partMatches(mw, query)) continue;
        const key = normalize(mw);
        if (seen.has(key)) continue;
        seen.add(key);
        wordItems.push({ word: mw, item });
        if (wordItems.length >= 60) break;
      }
      if (wordItems.length >= 60) break;
    }
    if (!wordItems.length) {
      // استعلام لاتيني (إنجليزي/فرنسي/ألماني): المعنى عربي فلا يطابق، اعرض الكلمة القبطية لكل نتيجة.
      appendCopticItems();
    } else {
      wordItems.sort((a, b) => {
        const ap = normalize(a.word).startsWith(nq) ? 0 : 1;
        const bp = normalize(b.word).startsWith(nq) ? 0 : 1;
        if (ap !== bp) return ap - bp;
        return normalize(a.word).length - normalize(b.word).length || a.word.localeCompare(b.word);
      });
      wordItems.forEach(({ word, item }) => {
        const btn = make("button", { class: "result-item", type: "button" });
        const span = make("span", { class: "ri-word", text: word });
        if (normalize(word).startsWith(nq)) span.classList.add("ri-word-match");
        btn.append(span);
        btn.addEventListener("click", () => { void showDetail(item, query, word); });
        list.append(btn);
      });
    }
  }
  resultsContainer.append(list);
}
async function showDetail(item, query, selectedMeaning) {
  const seq = liveSeq;
  loader.hidden = false;
  try {
    const card = await createResultCard(item, query, 0, selectedMeaning);
    if (seq !== liveSeq) return;
    const back = make("button", { class: "more-results-btn back-btn", type: "button", text: "← " + t("backToResults") });
    back.addEventListener("click", () => void liveSearch(query));
    resultsContainer.replaceChildren(back, card);
    resultsContainer.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) { console.error(error); message.textContent = t("detailError"); }
  finally { loader.hidden = true; }
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
      const more = make("button", { class: "more-results-btn", type: "button", text: t("moreResults") });
      more.addEventListener("click", () => { currentIndex++; void displayCurrentResult(); });
      resultsContainer.append(more);
    }
  } catch (error) { console.error(error); message.textContent = t("detailError"); }
}
async function performSearch(raw) {
  const query = String(raw ?? "").trim();
  // تبديل اللغة أصبح يدويًا فقط من الأزرار أعلى الصفحة.
  if (!query) { ++searchSequence; loader.hidden = true; searchButton.disabled = false; message.textContent = t("enterWord"); resultsContainer.replaceChildren(); input.focus(); return; }
  suggestions.hidden = true;
  const seq = ++searchSequence;
  currentQuery = query; currentIndex = 0; resultRows = [];
  message.textContent = ""; resultsContainer.replaceChildren(); loader.hidden = false; searchButton.disabled = true; playSfx("clickSound");
  try {
    const data = await search(query);
    if (seq !== searchSequence) return;
    resultRows = data.results;
    if (!resultRows.length) { message.textContent = t("noResult"); message.classList.add("error"); playSfx("errorSound"); return; }
    message.textContent = t("results", { n: data.total.toLocaleString(t("dateLocale")) });
    message.classList.remove("error");
    playSfx("successSound");
    loader.hidden = true; searchButton.disabled = false;
    void displayCurrentResult();
    const params = new URLSearchParams(location.search); params.set("q", query); params.delete("w"); history.replaceState({}, "", `${location.pathname}?${params}`);
  } catch (error) {
    if (seq !== searchSequence) return;
    console.error(error); message.textContent = t("searchError"); message.classList.add("error"); playSfx("errorSound");
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

let typeTimer = null;
input.addEventListener("input", () => { clearButton.hidden = !input.value; clearTimeout(typeTimer); typeTimer = setTimeout(() => void liveSearch(input.value), 180); });
form.addEventListener("submit", (event) => { event.preventDefault(); clearTimeout(typeTimer); void liveSearch(input.value); input.blur(); });
clearButton.addEventListener("click", () => { ++searchSequence; loader.hidden = true; searchButton.disabled = false; input.value = ""; clearButton.hidden = true; suggestions.hidden = true; resultsContainer.replaceChildren(); message.textContent = ""; input.focus(); });

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
let appLinkCache = null;
async function fetchLatestAppLink() {
  if (appLinkCache) return appLinkCache;
  try {
    const res = await fetch(APP_CONFIG_URL);
    const text = await res.text();
    const m = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*?)\);?/);
    const json = JSON.parse(m ? m[1] : "{}");
    const rows = json?.table?.rows || [];
    let last = "";
    for (const row of rows) { const v = row?.c?.[0]?.v; if (v != null && String(v).trim()) last = String(v).trim(); }
    appLinkCache = last || null;
    return appLinkCache;
  } catch (e) { console.error(e); return null; }
}
function openQrModal() {
  const modal = $("qrModal"); modal.hidden = false;
  const box = $("qrCodeContainer"); box.innerHTML = `<span class="qr-loading">${t("qrLoading")}</span>`;
  $("appDirectLink").hidden = true;
  fetchLatestAppLink().then((link) => {
    if (!link) { box.innerHTML = `<span class="qr-loading">${t("qrError")}</span>`; return; }
    box.innerHTML = "";
    const img = new Image(); img.alt = "QR"; img.width = 200; img.height = 200;
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(link)}`;
    box.append(img);
    const direct = $("appDirectLink"); direct.href = link; direct.hidden = false;
  });
}
$("appDownloadBtn").addEventListener("click", openQrModal);
$("closeQrModal").addEventListener("click", () => { $("qrModal").hidden = true; });
$("qrModal").addEventListener("click", (e) => { if (e.target === $("qrModal")) $("qrModal").hidden = true; });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") $("qrModal").hidden = true; });
(async () => {
  updateDate(); setInterval(updateDate, 60_000);
  // تبديل اللغة يدويًا فقط من الأزرار أعلى الصفحة (يُحفظ اختيار المستخدم)
  const applyLangActive = () => document.querySelectorAll(".lang-btn").forEach((b) => b.classList.toggle("active", b.dataset.lang === currentLang));
  const savedLang = store.get("khmi-lang", "ar");
  if (I18N[savedLang]) setLang(savedLang);
  applyLangActive();
  document.querySelectorAll(".lang-btn").forEach((btn) => btn.addEventListener("click", () => {
    const lang = btn.dataset.lang;
    if (!I18N[lang] || lang === currentLang) return;
    store.set("khmi-lang", lang);
    setLang(lang);
    applyLangActive();
  }));
  try {
    const manifest = await init(); $("count").textContent = count().toLocaleString("en-US");
    if ("serviceWorker" in navigator && window.__DEV_LIVE__) navigator.serviceWorker.getRegistrations().then((registrations) => registrations.forEach((registration) => registration.unregister())).catch(() => {});
    else if ("serviceWorker" in navigator) navigator.serviceWorker.register(`sw.js?v=${manifest.v}`).catch(() => {});
  } catch (error) { console.error(error); message.textContent = "تعذّر تحميل القاموس؛ تحقق من الاتصال ثم أعد تحميل الصفحة."; message.classList.add("error"); return; }
  await loadNotifications(); setInterval(loadNotifications, 60_000);
  const params = new URLSearchParams(location.search); const query = params.get("q");
  if (query) { input.value = query; clearButton.hidden = false; await liveSearch(query); }
})();
