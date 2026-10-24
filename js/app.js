import { init, search, detail, count, matchParts } from "./search.js?b=__B__";
import { parts, normalize, words } from "./norm.js?b=__B__";
import { spokenText } from "./speech.js?b=__B__";
import { copticDate, describeKind, originLabel, isGreekOrigin, meaningFor } from "./terms.js?b=__B__";

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
  ar: { searchPlaceholder:"اكتب كلمة للبحث…", searchButton:"ابحث", searchHeading:"من كلمةٍ إلى حكاية", loading:"جاري البحث…", enterWord:"الرجاء إدخال كلمة للبحث!", results:"{n} نتيجة", resultOne:"نتيجة واحدة", noResult:"الكلمة غير موجودة حاليًا؛ ستتم الإضافة قريبًا.", searchError:"حدث خطأ في البحث؛ تحقق من الاتصال وحاول مرة أخرى.", detailError:"تعذّر تحميل تفاصيل المدخل.", moreResults:"اضغط لمعرفة المزيد من المعاني　⌄", backToResults:"رجوع إلى النتائج", fieldWord:"الكلمة", fieldMeaning:"المعنى", fieldKind:"النوع", fieldOrigin:"الأصل", audioUnavailable:"لا يتوفر ملف صوت للتنزيل لهذا المدخل.", audioPlayError:"تعذّر تشغيل الملف الصوتي؛ جرّب النطق الآلي.", speechUnavailable:"لا يتوفر نطق لهذا المدخل.", copied:"تم نسخ النص", copyError:"تعذّر النسخ", shareError:"تعذّر إنشاء بطاقة المشاركة؛ حاول مرة أخرى.", shareToolError:"تعذّر تحميل أداة إنشاء الصورة.", learnLink:"🤖 بوت تيليجرام — القاموس القبطي", footerDesc:"القاموس القبطي Ⲭⲏⲙⲓ هو أول قاموس قبطي ناطق على الإنترنت، وسيفيدك كثيراً على تحسين لغتك القبطية، نتمنى لك تجربة فريدة.", downloadApp:"📱 حمّل تطبيق القاموس", qrTitle:"حمّل تطبيق القاموس على الموبايل", qrHint:"امسح الباركود بالكاميرا لتحميل التطبيق", directDownload:"أو اضغط هنا للتحميل المباشر ↓", qrError:"تعذّر جلب رابط التحميل.", qrLoading:"جاري التحميل…", newNotification:"هناك إشعار جديد!", notificationsTitle:"الإشعارات الجديدة", skip:"انتقل إلى البحث", brandCaption:"ⲭⲏⲙⲓ · القاموس القبطي", shareTitle:"القاموس القبطي · ⲭⲏⲙⲓ", dateLocale:"ar-EG", wotdLabel:"كلمة اليوم", recentLabel:"عمليات البحث الأخيرة", recentClear:"مسح", entriesCount:"{n} مدخل في القاموس", themeDark:"الوضع الليلي", themeLight:"الوضع النهاري", toTop:"العودة للأعلى", menu:"القائمة", notificationsMenu:"الإشعارات", fieldGreek:"الكلمة اليونانية", fieldUsage:"طريقة الاستخدام", fieldArabic:"بالعربية", shareCardTitle:"مشاركة بطاقة صورة", copyMeaning:"نسخ المعنى", audioPlay:"تشغيل/إيقاف النطق", audioMute:"كتم الصوت", audioVolume:"مستوى الصوت", audioPosition:"موضع التشغيل", audioDownload:"تنزيل الصوت", kbBackspace:"⌫ حذف", kbClear:"مسح الكل", kbClose:"إغلاق", notificationsLoading:"جاري تحميل الإشعارات…", notificationsError:"تعذّر تحميل الإشعارات الآن.", notificationsEmpty:"لا توجد إشعارات جديدة", dictLoadError:"تعذّر تحميل القاموس؛ تحقق من الاتصال ثم أعد تحميل الصفحة.", shareApp:"حمّل تطبيق القاموس القبطي", contactUs:"تواصل معنا", whatsapp:"💬 واتساب", telegramContact:"✈️ تيليجرام" },
  en: { searchPlaceholder:"Type a word to search…", searchButton:"Search", searchHeading:"From a word to a story", loading:"Searching…", enterWord:"Please enter a word to search!", results:"{n} results", resultOne:"1 result", noResult:"This word is not yet available; it will be added soon.", searchError:"Search error; check your connection and try again.", detailError:"Could not load entry details.", moreResults:"Tap for more meanings　⌄", backToResults:"Back to results", fieldWord:"Word", fieldMeaning:"Meaning", fieldKind:"Type", fieldOrigin:"Origin", audioUnavailable:"No audio file available for download for this entry.", audioPlayError:"Could not play the audio; try text-to-speech.", speechUnavailable:"No pronunciation available for this entry.", copied:"Text copied", copyError:"Copy failed", shareError:"Could not create share card; try again.", shareToolError:"Could not load the image tool.", learnLink:"🤖 Telegram Bot — Coptic Dictionary", footerDesc:"Coptic Dictionary Ⲭⲏⲙⲓ is the first spoken Coptic dictionary on the internet. It will help you improve your Coptic. We wish you a unique experience.", downloadApp:"📱 Download the Dictionary App", qrTitle:"Download the Dictionary App", qrHint:"Scan the QR code with your camera to download the app", directDownload:"Or click here for direct download ↓", qrError:"Could not fetch the download link.", qrLoading:"Loading…", newNotification:"New notification!", notificationsTitle:"New notifications", skip:"Skip to search", brandCaption:"ⲭⲏⲙⲓ · Coptic Dictionary", shareTitle:"Coptic Dictionary · ⲭⲏⲙⲓ", dateLocale:"en-GB", wotdLabel:"Word of the day", recentLabel:"Recent searches", recentClear:"Clear", entriesCount:"{n} dictionary entries", themeDark:"Dark mode", themeLight:"Light mode", toTop:"Back to top", menu:"Menu", notificationsMenu:"Notifications", fieldGreek:"Greek word", fieldUsage:"Usage", fieldArabic:"Arabic", shareCardTitle:"Share as image", copyMeaning:"Copy meaning", audioPlay:"Play or pause pronunciation", audioMute:"Mute", audioVolume:"Volume", audioPosition:"Playback position", audioDownload:"Download audio", kbBackspace:"⌫ Delete", kbClear:"Clear all", kbClose:"Close", notificationsLoading:"Loading notifications…", notificationsError:"Could not load notifications right now.", notificationsEmpty:"No new notifications", dictLoadError:"Could not load the dictionary; check your connection and reload the page.", shareApp:"Get the Coptic Dictionary app", contactUs:"Contact us", whatsapp:"💬 WhatsApp", telegramContact:"✈️ Telegram" },
  fr: { searchPlaceholder:"Tapez un mot à rechercher…", searchButton:"Rechercher", searchHeading:"D'un mot à une histoire", loading:"Recherche…", enterWord:"Veuillez saisir un mot à rechercher !", results:"{n} résultats", resultOne:"1 résultat", noResult:"Ce mot n'est pas encore disponible ; il sera bientôt ajouté.", searchError:"Erreur de recherche ; vérifiez votre connexion et réessayez.", detailError:"Impossible de charger les détails de l'entrée.", moreResults:"Appuyez pour plus de sens　⌄", backToResults:"Retour aux résultats", fieldWord:"Mot", fieldMeaning:"Sens", fieldKind:"Type", fieldOrigin:"Origine", audioUnavailable:"Aucun fichier audio disponible pour cette entrée.", audioPlayError:"Impossible de lire l'audio ; essayez la synthèse vocale.", speechUnavailable:"Aucune prononciation disponible.", copied:"Texte copié", copyError:"Échec de la copie", shareError:"Impossible de créer la carte de partage ; réessayez.", shareToolError:"Impossible de charger l'outil d'image.", learnLink:"🤖 Bot Telegram — Dictionnaire copte", footerDesc:"Le Dictionnaire copte Ⲭⲏⲙⲓ est le premier dictionnaire copte parlé sur Internet. Il vous aidera à améliorer votre copte. Nous vous souhaitons une expérience unique.", downloadApp:"📱 Télécharger l'application", qrTitle:"Télécharger l'application du dictionnaire", qrHint:"Scannez le code QR avec votre appareil photo pour télécharger l'application", directDownload:"Ou cliquez ici pour le téléchargement direct ↓", qrError:"Impossible de récupérer le lien de téléchargement.", qrLoading:"Chargement…", newNotification:"Nouvelle notification !", notificationsTitle:"Nouvelles notifications", skip:"Aller à la recherche", brandCaption:"ⲭⲏⲙⲓ · Dictionnaire copte", shareTitle:"Dictionnaire copte · ⲭⲏⲙⲓ", dateLocale:"fr-FR", wotdLabel:"Mot du jour", recentLabel:"Recherches récentes", recentClear:"Effacer", entriesCount:"{n} entrées dans le dictionnaire", themeDark:"Mode sombre", themeLight:"Mode clair", toTop:"Haut de page", menu:"Menu", notificationsMenu:"Notifications", fieldGreek:"Mot grec", fieldUsage:"Emploi", fieldArabic:"En arabe", shareCardTitle:"Partager en image", copyMeaning:"Copier le sens", audioPlay:"Lire ou mettre en pause la prononciation", audioMute:"Couper le son", audioVolume:"Volume", audioPosition:"Position de lecture", audioDownload:"Télécharger l'audio", kbBackspace:"⌫ Effacer", kbClear:"Tout effacer", kbClose:"Fermer", notificationsLoading:"Chargement des notifications…", notificationsError:"Impossible de charger les notifications pour le moment.", notificationsEmpty:"Aucune nouvelle notification", dictLoadError:"Impossible de charger le dictionnaire ; vérifiez votre connexion puis rechargez la page.", shareApp:"Téléchargez l'application du dictionnaire copte", contactUs:"Nous contacter", whatsapp:"💬 WhatsApp", telegramContact:"✈️ Telegram" },
  de: { searchPlaceholder:"Wort zum Suchen eingeben…", searchButton:"Suchen", searchHeading:"Von einem Wort zu einer Geschichte", loading:"Suche…", enterWord:"Bitte geben Sie ein Suchwort ein!", results:"{n} Ergebnisse", resultOne:"1 Ergebnis", noResult:"Dieses Wort ist noch nicht verfügbar; es wird bald hinzugefügt.", searchError:"Suchfehler; Verbindung prüfen und erneut versuchen.", detailError:"Details konnten nicht geladen werden.", moreResults:"Tippen für weitere Bedeutungen　⌄", backToResults:"Zurück zu den Ergebnissen", fieldWord:"Wort", fieldMeaning:"Bedeutung", fieldKind:"Typ", fieldOrigin:"Herkunft", audioUnavailable:"Keine Audiodatei zum Download verfügbar.", audioPlayError:"Audio konnte nicht abgespielt werden; Sprachsynthese versuchen.", speechUnavailable:"Keine Aussprache verfügbar.", copied:"Text kopiert", copyError:"Kopieren fehlgeschlagen", shareError:"Share-Karte konnte nicht erstellt werden.", shareToolError:"Bildtool konnte nicht geladen werden.", learnLink:"🤖 Telegram-Bot — Koptisches Wörterbuch", footerDesc:"Das Koptische Wörterbuch Ⲭⲏⲙⲓ ist das erste gesprochene koptische Wörterbuch im Internet. Es hilft Ihnen, Ihr Koptisch zu verbessern. Wir wünschen Ihnen ein einzigartiges Erlebnis.", downloadApp:"📱 App herunterladen", qrTitle:"Wörterbuch-App herunterladen", qrHint:"Scannen Sie den QR-Code mit der Kamera, um die App herunterzuladen", directDownload:"Oder hier klicken für Direktdownload ↓", qrError:"Download-Link konnte nicht abgerufen werden.", qrLoading:"Laden…", newNotification:"Neue Benachrichtigung!", notificationsTitle:"Neue Benachrichtigungen", skip:"Zur Suche springen", brandCaption:"ⲭⲏⲙⲓ · Koptisches Wörterbuch", shareTitle:"Koptisches Wörterbuch · ⲭⲏⲙⲓ", dateLocale:"de-DE", wotdLabel:"Wort des Tages", recentLabel:"Letzte Suchen", recentClear:"Löschen", entriesCount:"{n} Einträge im Wörterbuch", themeDark:"Dunkelmodus", themeLight:"Hellmodus", toTop:"Nach oben", menu:"Menü", notificationsMenu:"Benachrichtigungen", fieldGreek:"Griechisches Wort", fieldUsage:"Verwendung", fieldArabic:"Auf Arabisch", shareCardTitle:"Als Bild teilen", copyMeaning:"Bedeutung kopieren", audioPlay:"Aussprache abspielen oder pausieren", audioMute:"Stummschalten", audioVolume:"Lautstärke", audioPosition:"Wiedergabeposition", audioDownload:"Audio herunterladen", kbBackspace:"⌫ Löschen", kbClear:"Alles löschen", kbClose:"Schließen", notificationsLoading:"Benachrichtigungen werden geladen…", notificationsError:"Benachrichtigungen konnten gerade nicht geladen werden.", notificationsEmpty:"Keine neuen Benachrichtigungen", dictLoadError:"Das Wörterbuch konnte nicht geladen werden; Verbindung prüfen und Seite neu laden.", shareApp:"Koptisches Wörterbuch als App laden", contactUs:"Kontakt", whatsapp:"💬 WhatsApp", telegramContact:"✈️ Telegram" }
};
let currentLang = "ar";
function t(key, vars) {
  let val = (I18N[currentLang] || I18N.ar)[key] ?? I18N.ar[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) val = val.replaceAll(`{${k}}`, String(v));
  return val;
}
const resultsText = (n) => (n === 1 ? t("resultOne") : t("results", { n: n.toLocaleString(t("dateLocale")) }));
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
  refreshChrome();
  rerenderView();
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
  const weekday = new Intl.DateTimeFormat(t("dateLocale"), { weekday: "long" }).format(now);
  const gregorian = new Intl.DateTimeFormat(t("dateLocale"), { year: "numeric", month: "long", day: "numeric" }).format(now);
  $("date-display").replaceChildren(make("div", { text: weekday }), make("div", { text: copticDate(now, currentLang) }), make("div", { text: gregorian }));
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
    const button = make("button", { class: "suggestion", type: "button", role: "option" }, wordSpan);
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
  const play = make("button", { class: "audio-control", type: "button", title: t("audioPlay"), "aria-label": t("audioPlay"), text: "▶" });
  const mute = make("button", { class: "audio-control", type: "button", title: t("audioMute"), "aria-label": t("audioMute"), text: "🔊" });
  const volume = make("input", { class: "audio-volume", type: "range", min: "0", max: "1", step: "0.01", value: "1", "aria-label": t("audioVolume") });
  const progress = make("div", { class: "audio-progress", role: "slider", tabindex: "0", "aria-label": t("audioPosition"), "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": "0" });
  const progressFill = make("span"); progress.append(progressFill);
  const elapsed = make("span", { class: "audio-time", text: "00:00" });
  const duration = make("span", { class: "audio-time", text: "00:00" });
  const download = make("button", { class: "download-button", type: "button", title: t("audioDownload"), "aria-label": t("audioDownload"), text: "↓" });
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
// حقائق الكلمة بلغة العرض: النوع (مع ملاحظة الاستخدام) والأصل والكلمة اليونانية.
function wordFacts(record, lang) {
  const reference = Array.isArray(record.referenceMatches) ? record.referenceMatches[0] : null;
  const kind = describeKind(reference?.kind || record.kind, lang);
  const rawOrigin = reference?.origin || record.origin;
  return {
    kind: kind.main, note: kind.note,
    origin: originLabel(rawOrigin, lang),
    greek: isGreekOrigin(rawOrigin) ? String(record.greek ?? "").trim() : "",
  };
}
function factTile(label, value, className = "", attrs = {}) {
  return make("div", { class: `fact ${className}`.trim() }, make("dt", { text: label }), make("dd", { ...attrs, text: value }));
}
function factList(facts, className) {
  const rows = [
    facts.kind && factTile(t("fieldKind"), facts.kind),
    facts.origin && factTile(t("fieldOrigin"), facts.origin),
    facts.greek && factTile(t("fieldGreek"), facts.greek, "greek", { lang: "el", dir: "ltr" }),
    facts.note && factTile(t("fieldUsage"), facts.note, "wide"),
  ].filter(Boolean);
  return rows.length ? make("dl", { class: className }, ...rows) : null;
}
const textDir = (lang) => (lang === "ar" ? "rtl" : "ltr");

async function shareCard(card, record, query) {
  if (typeof window.html2canvas !== "function") { toast(t("shareToolError")); return; }
  playSfx("clickSound");
  const lang = currentLang, dir = textDir(lang), now = new Date();
  const stage = $("shareStage");
  const localized = meaningFor(record, lang);
  const facts = wordFacts(record, lang);
  const gregorian = new Intl.DateTimeFormat(t("dateLocale"), { year: "numeric", month: "long", day: "numeric" }).format(now);

  const top = make("header", { class: "share-top" },
    make("img", { class: "share-logo", src: "assets/site-logo-192.png", alt: "" }),
    make("div", { class: "share-brand" },
      make("div", { class: "share-title cop", dir: "ltr", text: "ⲤⲞⲠⲦⲒⲤ ⲬⲎⲘⲒ" }),
      make("div", { class: "share-dates" }, make("span", { dir, text: copticDate(now, lang) }), make("i", { class: "share-sep" }), make("span", { dir, text: gregorian }))));

  const panel = make("section", { class: "share-panel" });
  panel.append(make("div", { class: "share-word cop", dir: "ltr", text: clean(record.coptic) || "—" }));
  const phonetic = clean(record.pronunciation || record.phonetic || "");
  if (phonetic) panel.append(make("div", { class: "share-phonetic", dir: "ltr", text: phonetic }));
  const lines = parts(localized.text).slice(0, 6);
  if (lines.length) {
    panel.append(make("div", { class: "share-label", text: t("fieldMeaning") }),
      make("div", { class: "share-meaning", lang: localized.lang, dir: textDir(localized.lang) }, ...lines.map((line) => make("p", { text: line }))));
  }
  const factsNode = factList(facts, "share-facts");
  if (factsNode) panel.append(factsNode);

  const children = [top, panel];
  // باركود تحميل التطبيق (نفس نظام نافذة التحميل) أسفل البطاقة
  const appLink = await fetchLatestAppLink();
  if (appLink) {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(appLink)}`;
    let qrSrc = qrUrl;
    try { // حوّل الباركود إلى data URL لضمان ظهوره في الصورة المنزلة
      const resp = await fetch(qrUrl);
      const blob = await resp.blob();
      qrSrc = await new Promise((resolve, reject) => { const fr = new FileReader(); fr.onload = () => resolve(fr.result); fr.onerror = reject; fr.readAsDataURL(blob); });
    } catch { /* احتياط: استخدم الرابط المباشر */ }
    const qr = make("img", { class: "share-qr", alt: "", width: "150", height: "150", src: qrSrc });
    children.push(make("footer", { class: "share-foot" }, qr, make("p", { class: "share-qr-caption", text: t("shareApp") })));
  }
  const exportNode = make("div", { class: "share-export", dir, lang }, ...children);
  stage.replaceChildren(exportNode);
  try {
    // الخطوط والصور يجب أن تكتمل قبل الالتقاط وإلا ظهر الخط البديل في الصورة.
    await Promise.all([
      ...[...exportNode.querySelectorAll("img")].map((img) => img.decode().catch(() => {})),
      document.fonts?.load('600 28px "IBM Plex Arabic"', "Aa المعنى"),
      document.fonts?.load('400 28px "IBM Plex Arabic"', "Aa المعنى"),
      document.fonts?.load('64px "Naqlun Coptic"', "ⲙⲁⲓ"),
    ].filter(Boolean)).catch(() => {});
    await document.fonts?.ready;
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
async function createResultCard(item, query, index, selectedMeaning) {
  const record = await detail(item.id);
  const card = make("article", { class: "result-card" });
  const share = make("button", { class: "share-button", type: "button", title: t("shareCardTitle"), "aria-label": t("shareCardTitle"), text: "↗" });
  share.addEventListener("click", () => void shareCard(card, record, query)); card.append(share);

  // الكلمة القبطية كبيرة + النطق
  const hero = make("header", { class: "card-hero" });
  hero.append(make("h2", { class: "card-coptic cop", dir: "ltr", text: clean(record.coptic) || "—" }));
  const phonetic = clean(record.pronunciation || record.phonetic || "");
  if (phonetic) hero.append(make("div", { class: "card-phonetic", dir: "ltr", text: phonetic }));
  card.append(hero);

  // المعنى بلغة العرض، ومعه المعنى العربي سطرًا ثانويًا عند اختلاف اللغة
  const localized = meaningFor(record, currentLang);
  const meaningText = localized.text || item.meaning || "";
  const section = make("section", { class: "card-section" });
  section.append(make("h3", { class: "card-label", text: t("fieldMeaning") }));
  const meaningBox = make("div", { class: "card-meaning", lang: localized.lang, dir: textDir(localized.lang) });
  meaningBox.append(renderMeaning(meaningText, query, selectedMeaning));
  if (localized.lang !== "ar" && meaningText) {
    const copy = make("button", { class: "copy-button", type: "button", title: t("copyMeaning"), "aria-label": t("copyMeaning"), text: "▢" });
    copy.addEventListener("click", async () => { try { await navigator.clipboard.writeText(meaningText); playSfx("copySound"); toast(t("copied")); } catch { toast(t("copyError")); } });
    meaningBox.append(copy);
  }
  section.append(meaningBox);
  const arabic = record.meaning || item.meaning || "";
  if (localized.lang !== "ar" && arabic) {
    section.append(make("div", { class: "card-arabic", lang: "ar", dir: "rtl" }, make("span", { class: "card-arabic-tag", text: t("fieldArabic") }), renderMeaning(arabic, query, selectedMeaning)));
  }
  card.append(section);

  // النوع والأصل (وطريقة الاستخدام والكلمة اليونانية عند وجودها)
  const factsNode = factList(wordFacts(record, currentLang), "card-facts");
  if (factsNode) card.append(factsNode);

  card.append(make("div", { class: "card-audio" }, buildAudioPlayer(record, query)));
  return card;
}
let liveSeq = 0;
async function liveSearch(raw) {
  const query = String(raw ?? "").trim();
  // تبديل اللغة أصبح يدويًا فقط من الأزرار أعلى الصفحة.
  suggestions.hidden = true;
  if (!query) { ++liveSeq; currentCard = null; listObserver?.disconnect(); setLanding(true); resultsContainer.replaceChildren(); message.textContent = ""; message.classList.remove("error"); loader.hidden = true; searchButton.disabled = false; return; }
  const seq = ++liveSeq;
  currentCard = null;
  setLanding(false);
  message.textContent = ""; message.classList.remove("error"); resultsContainer.replaceChildren(); loader.hidden = false; searchButton.disabled = true; playSfx("clickSound");
  try {
    const data = await search(query);
    if (seq !== liveSeq) return;
    loader.hidden = true; searchButton.disabled = false;
    if (!data.results.length) { message.textContent = t("noResult"); message.classList.add("error"); playSfx("errorSound"); return; }
    message.textContent = resultsText(data.total);
    renderResultList(data.results, query);
    playSfx("successSound");
    const params = new URLSearchParams(location.search); params.set("q", query); params.delete("w"); history.replaceState({}, "", `${location.pathname}?${params}`);
  } catch (error) {
    if (seq !== liveSeq) return;
    loader.hidden = true; searchButton.disabled = false;
    console.error(error); message.textContent = t("searchError"); message.classList.add("error"); playSfx("errorSound");
  }
}
// ---- قائمة النتائج: تُبنى على دفعات ويكتمل تحميلها مع التمرير ----
const COPTIC_RE = /[Ⲁ-⳿Ϣ-ϯ]/;
const CHUNK = 60;
let listObserver = null;
function resultEntries(rows, query) {
  const isCopticQuery = COPTIC_RE.test(query.trim().toLowerCase());
  const copticEntries = () => {
    const seen = new Set(), out = [];
    for (const item of rows) {
      const coptic = clean(item.coptic).trim();
      if (!coptic || seen.has(coptic)) continue;
      seen.add(coptic);
      out.push({ item, primary: coptic, secondary: parts(item.meaning || "")[0] || "", copticPrimary: true });
    }
    return out;
  };
  if (isCopticQuery) return copticEntries();
  const nq = normalize(query), seen = new Set(), out = [];
  for (const item of rows) {
    for (const mw of parts(item.meaning || "")) {
      if (!partMatches(mw, query)) continue;
      const key = normalize(mw);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ item, word: mw, primary: mw, secondary: clean(item.coptic).trim(), match: normalize(mw).startsWith(nq), copticPrimary: false });
    }
  }
  // استعلام لاتيني (إنجليزي/فرنسي/ألماني): المعنى عربي فلا يطابق، اعرض الكلمة القبطية لكل نتيجة.
  if (!out.length) return copticEntries();
  out.sort((a, b) => {
    if (a.match !== b.match) return a.match ? -1 : 1;
    return normalize(a.primary).length - normalize(b.primary).length || a.primary.localeCompare(b.primary);
  });
  return out;
}
function buildResultItem(entry, query, index) {
  const btn = make("button", { class: "result-item" + (index < 12 ? " stagger" : ""), type: "button" });
  if (index < 12) btn.style.setProperty("--i", String(index));
  const main = make("span", { class: "ri-word" + (entry.copticPrimary ? " cop" : ""), text: entry.primary });
  if (entry.match) main.classList.add("ri-word-match");
  btn.append(main);
  btn.addEventListener("click", () => { void showDetail(entry.item, query, entry.word); });
  return btn;
}
function renderResultList(rows, query) {
  listObserver?.disconnect();
  resultsContainer.replaceChildren();
  const entries = resultEntries(rows, query);
  const list = make("div", { class: "result-list" });
  resultsContainer.append(list);
  const sentinel = make("div", { class: "list-sentinel", "aria-hidden": "true" });
  let shown = 0;
  const more = () => {
    const end = Math.min(shown + CHUNK, entries.length);
    const frag = document.createDocumentFragment();
    for (; shown < end; shown++) frag.append(buildResultItem(entries[shown], query, shown));
    list.append(frag);
    if (shown >= entries.length) { listObserver?.disconnect(); sentinel.remove(); return; }
    // شاشة طويلة: إن بقي الحارس داخل نطاق الرؤية حمّل الدفعة التالية فورًا.
    if (sentinel.isConnected && sentinel.getBoundingClientRect().top < window.innerHeight + 800) requestAnimationFrame(more);
  };
  if (entries.length > CHUNK) resultsContainer.append(sentinel);
  more();
  if (shown < entries.length) {
    if ("IntersectionObserver" in window) {
      listObserver = new IntersectionObserver((hits) => { if (hits.some((hit) => hit.isIntersecting)) more(); }, { rootMargin: "800px 0px" });
      listObserver.observe(sentinel);
    } else while (shown < entries.length) more();
  }
}

// ---- الصفحة الرئيسية: كلمة اليوم + آخر عمليات البحث ----
const RECENT_KEY = "khmi-recent";
let wotdEntry = null;
function setLanding(visible) {
  $("landing").hidden = !visible;
  if (visible) renderRecent();
}
function rememberQuery(raw) {
  const value = String(raw ?? "").trim();
  if (!value) return;
  store.set(RECENT_KEY, [value, ...store.get(RECENT_KEY, []).filter((x) => x !== value)].slice(0, 8));
}
function renderRecent() {
  const list = store.get(RECENT_KEY, []);
  const box = $("recent");
  box.hidden = !list.length;
  if (!list.length) return;
  $("recentLabel").textContent = t("recentLabel");
  $("recentClear").textContent = t("recentClear");
  $("recentChips").replaceChildren(...list.map((q) => {
    const chip = make("button", { class: "chip" + (COPTIC_RE.test(q) ? " cop" : ""), type: "button", text: q });
    chip.addEventListener("click", () => { input.value = q; clearButton.hidden = false; void liveSearch(q); });
    return chip;
  }));
}
$("recentClear").addEventListener("click", () => { store.set(RECENT_KEY, []); renderRecent(); });
async function loadWordOfDay() {
  const total = count();
  if (!total) return null;
  const seed = Math.floor(Date.now() / 86400000) * 2654435761 % total; // نفس الكلمة طوال اليوم
  for (let step = 0; step < 60; step++) {
    const id = (seed + step * 7) % total;
    const record = await detail(id).catch(() => null);
    if (!record) continue;
    const coptic = clean(record.coptic).trim();
    // كلمة قصيرة لها معنى بكل اللغات الأربع، فتبقى هي نفسها عند تبديل اللغة.
    const firsts = [record.meaning, record.translation_en, record.translation_fr, record.translation_de].map((v) => parts(v || "")[0] || "");
    if (!coptic || coptic.length > 14 || firsts.some((v) => !v || v.length > 56)) continue;
    return { id, record };
  }
  return null;
}
function renderWordOfDay() {
  const el = $("wotd");
  if (!wotdEntry) { el.hidden = true; return; }
  const { record } = wotdEntry;
  const localized = meaningFor(record, currentLang);
  const facts = wordFacts(record, currentLang);
  const meta = [facts.kind, facts.origin].filter(Boolean).map((text) => make("span", { class: "wotd-chip", text }));
  el.replaceChildren(
    make("span", { class: "wotd-label", text: t("wotdLabel") }),
    make("span", { class: "wotd-word cop", dir: "ltr", text: clean(record.coptic).trim() }),
    make("span", { class: "wotd-meaning", lang: localized.lang, dir: textDir(localized.lang), text: parts(localized.text)[0] || "" }),
    ...(meta.length ? [make("span", { class: "wotd-meta" }, ...meta)] : []));
  el.hidden = false;
}
$("wotd").addEventListener("click", () => {
  if (!wotdEntry) return;
  setLanding(false);
  void showDetail({ id: wotdEntry.id, coptic: wotdEntry.record.coptic, meaning: wotdEntry.record.meaning }, "");
});

// ---- الوضع الليلي + عناصر الواجهة التي تتبع اللغة ----
const themeButton = $("themeButton"), toTop = $("toTop");
function applyTheme(mode, save) {
  document.documentElement.dataset.theme = mode;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", mode === "dark" ? "#0f1729" : "#f4ecdc");
  $("themeLabel").textContent = t(mode === "dark" ? "themeLight" : "themeDark");
  if (save) store.set("khmi-theme", mode);
}
const menuButton = $("menuButton"), menuPanel = $("menuPanel");
function setMenu(open) {
  menuPanel.hidden = !open;
  menuButton.setAttribute("aria-expanded", String(open));
}
menuButton.addEventListener("click", () => setMenu(menuPanel.hidden));
// أي اختيار من القائمة يغلقها؛ والضغط خارجها أو Escape يغلقها كذلك.
menuPanel.addEventListener("click", (event) => { if (event.target.closest("button, a")) setMenu(false); });
document.addEventListener("click", (event) => { if (!menuPanel.hidden && !event.target.closest(".header-actions")) setMenu(false); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !menuPanel.hidden) { setMenu(false); menuButton.focus(); } });
themeButton.addEventListener("click", () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark", true));
function refreshChrome() {
  applyTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light", false);
  menuButton.setAttribute("aria-label", t("menu"));
  menuButton.title = t("menu");
  $("notificationsMenuLabel").textContent = t("notificationsMenu");
  $("contactLabel").textContent = t("contactUs"); $("waLink").textContent = t("whatsapp"); $("tgContactLink").textContent = t("telegramContact");
  toTop.setAttribute("aria-label", t("toTop"));
  toTop.title = t("toTop");
  if (count()) $("entryCount").textContent = t("entriesCount", { n: count().toLocaleString(t("dateLocale")) });
  renderWordOfDay();
  renderRecent();
  if (keyboard.children.length) buildKeyboard();
  if (!notificationsReady) $("notificationsList").replaceChildren(make("p", { class: "notification-empty", text: t("notificationsLoading") }));
  else renderNotifications();
}
toTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
let topTicking = false;
window.addEventListener("scroll", () => {
  if (topTicking) return;
  topTicking = true;
  requestAnimationFrame(() => { toTop.hidden = window.scrollY < 800; topTicking = false; });
}, { passive: true });

let currentCard = null;
function rerenderView() {
  if (currentCard) void showDetail(currentCard.item, currentCard.query, currentCard.selectedMeaning);
  else if (input.value.trim()) void liveSearch(input.value);
}
async function showDetail(item, query, selectedMeaning) {
  currentCard = { item, query, selectedMeaning };
  listObserver?.disconnect();
  rememberQuery(query);
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
    message.textContent = resultsText(data.total);
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
    make("button", { class: "coptic-key special", type: "button", "data-action": "backspace", text: t("kbBackspace") }),
    make("button", { class: "coptic-key special", type: "button", "data-char": "̀", text: "̀" }),
    make("button", { class: "coptic-key special", type: "button", "data-action": "clear", text: t("kbClear") }),
    make("button", { class: "coptic-key special", type: "button", "data-action": "close", text: t("kbClose") }));
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
form.addEventListener("submit", (event) => { event.preventDefault(); clearTimeout(typeTimer); const submitted = input.value; void liveSearch(submitted).then(() => { if (resultsContainer.querySelector(".result-item")) rememberQuery(submitted); }); input.blur(); });
clearButton.addEventListener("click", () => { ++searchSequence; loader.hidden = true; searchButton.disabled = false; input.value = ""; clearButton.hidden = true; suggestions.hidden = true; currentCard = null; listObserver?.disconnect(); resultsContainer.replaceChildren(); message.textContent = ""; setLanding(true); input.focus(); });

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
let notifications = [], newNotificationCount = 0, notificationsReady = false;
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
    notificationsReady = true;
    store.set("khmi-notification-total", notifications.length);
    if (!$('notificationsWindow').hidden) { store.set("khmi-notification-seen", notifications.length); newNotificationCount = 0; }
    renderNotifications();
  } catch (error) {
    console.warn("تعذر تحميل الإشعارات", error);
    if (!notifications.length) $("notificationsList").replaceChildren(make("p", { class: "notification-empty", text: t("notificationsError") }));
  }
}
function renderNotifications() {
  const list = $("notificationsList");
  if (!notifications.length) { list.replaceChildren(make("p", { class: "notification-empty", text: t("notificationsEmpty") })); }
  else list.replaceChildren(...notifications.map((text, index) => make("div", { class: `notification-item${index < newNotificationCount ? " new" : ""}`, text })));
  const badge = $("notificationBadge"); badge.hidden = newNotificationCount <= 0; badge.textContent = newNotificationCount > 9 ? "9+" : String(newNotificationCount);
  $("menuBadge").hidden = newNotificationCount <= 0;
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
  refreshChrome();
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
    const manifest = await init(); $("count").textContent = count().toLocaleString("en-US"); refreshChrome();
    loadWordOfDay().then((entry) => { wotdEntry = entry; renderWordOfDay(); }).catch(() => {});
    if ("serviceWorker" in navigator && window.__DEV_LIVE__) navigator.serviceWorker.getRegistrations().then((registrations) => registrations.forEach((registration) => registration.unregister())).catch(() => {});
    else if ("serviceWorker" in navigator) navigator.serviceWorker.register(`sw.js?v=${manifest.v}`).catch(() => {});
  } catch (error) { console.error(error); message.textContent = t("dictLoadError"); message.classList.add("error"); return; }
  await loadNotifications(); setInterval(loadNotifications, 60_000);
  const params = new URLSearchParams(location.search); const query = params.get("q");
  if (query) { input.value = query; clearButton.hidden = false; await liveSearch(query); }
})();
