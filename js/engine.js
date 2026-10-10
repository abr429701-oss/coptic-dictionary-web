// محرك البحث — منقول حرفيًا من منطق Worker الخاص بالبوت (src/index.js)، بدون أي اعتماد على Telegram.
// بدل إرسال الرسائل، تُرجع الدوال "رسائل" بسيطة تعرضها الواجهة (app.js):
//   { kind: "entry",   fields: [[label, value]], more: {text, run} | null, voice: {...} | null }
//   { kind: "suggest", title, buttons: [{text, run}], nav: [{text, run}] }
//   { kind: "text",    text }
// الأزرار (run) دوال تُرجع رسالة جديدة، وأزرار التنقل بين الصفحات تستبدل الرسالة نفسها (مثل editMessageText).
import { translateFieldValue } from "./field-translations.js";

export const BOT_TITLE = "📖 القاموس القبطي البحيري";
export const HELP_TEXT = "أهلًا بك في القاموس.\n\nاكتب الكلمة مباشرة، مثل:\nⲁⲛⲁⲩ\nwater\nماء\n\nسأبحث في القبطية والعربية والإنجليزية والفرنسية والألمانية والنطق.\n\nاكتب الكلمة أو أول حروفها لتظهر لك اقتراحات بالكلمات التي تبدأ بها.";
export const WELCOME_TEXT = "مرحبًا بك في القاموس الرقمي الناطق للغة القبطية, تفضل الان بكتابة أي كلمة للبحث عنها";
export const COMMAND_FALLBACK_TEXT = "اكتب الكلمة مباشرة للبحث أو استخدم \u2066/start\u2069 للبدء.";

let records = [];
export function init(data) {
  records = data;
}
export const recordCount = () => records.length;

const ACCENT_MAP = { ὲ: "ⲉ", έ: "ⲉ", ὶ: "ⲓ", ί: "ⲓ", ὸ: "ⲟ", ό: "ⲟ", ὼ: "ⲱ", ώ: "ⲱ", ὴ: "ⲏ", ή: "ⲏ", ὰ: "ⲁ", ά: "ⲁ", ὺ: "ⲩ", ύ: "ⲩ" };
const ALEF_MAP = { أ: "ا", إ: "ا", آ: "ا", ٱ: "ا", ى: "ي", ة: "ه" };

const PLAIN_ASCII = /^[\x20-\x5f\x61-\x7e]*$/u;
const MARK_CHARS = /[̀-ͯؐ-ًؚ-ٰٟۖ-ۭـ]/u;
const MARK_CHARS_ALL = /[̀-ͯؐ-ًؚ-ٰٟۖ-ۭـ]/gu;
const FOLD_CHARS = /[أإآٱىةὲέὶίὸόὼώὴήὰάὺύ`]/u;
const FOLD_CHARS_ALL = /[أإآٱىةὲέὶίὸόὼώὴήὰάὺύ`]/gu;
const FOLD_MAP = { ...ALEF_MAP, ...ACCENT_MAP, "`": "" };

export function normalize(value) {
  const text = String(value ?? "");
  if (PLAIN_ASCII.test(text)) return text.toLowerCase().replace(/\s+/gu, " ").trim();
  let out = text.normalize("NFKC").toLowerCase();
  if (MARK_CHARS.test(out)) out = out.replace(MARK_CHARS_ALL, "");
  if (FOLD_CHARS.test(out)) out = out.replace(FOLD_CHARS_ALL, (char) => FOLD_MAP[char] ?? "");
  return out.replace(/\s+/gu, " ").trim();
}

function lazy(build) {
  let value;
  let ready = false;
  return () => {
    if (!ready) {
      value = build();
      ready = true;
    }
    return value;
  };
}

const SEARCH_FIELDS = ["coptic", "pronunciation", "english", "phonetic", "translation_en", "translation_fr", "translation_de"];

const recordIndexById = lazy(() => {
  const map = new Map();
  records.forEach((record, index) => {
    if (record.id != null && !map.has(record.id)) map.set(record.id, index);
  });
  return map;
});

const ARABIC_LETTER = /[؀-ۿ]/u;
const COPTIC_LETTER = /[Ⲁ-⳿Ϣ-ϯ]/u;
const GREEK_LETTER = /[Ͱ-Ͽἀ-῿]/u;
const LATIN_LETTER = /[a-z]/iu;

function toTokens(normalized) {
  return normalized.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/gu, " ").trim();
}
function tokens(value) {
  return toTokens(normalize(value));
}
function hasWholeWords(text, needle) {
  return needle !== "" && ` ${text} `.includes(` ${needle} `);
}

const SUGGESTION_PAGE_SIZE = 10;
const SHORT_QUERY_MAX = 2;
const MORE_BUTTON_TEXT = {
  ar: "اعرض المزيد من الكلمات",
  en: "Show more words",
  fr: "Afficher plus de mots",
  de: "Mehr Wörter anzeigen",
};
const UI_TEXT = {
  ar: { word: "الكلمة", meaning: "المعنى", kind: "النوع", origin: "الأصل", choose: "اختر من الاقتراحات التالية:", previous: "السابق", pageNext: "التالي", noResult: "القاموس قيد التطوير حاليًا وسيتم إضافة معنى هذه الكلمة لاحقًا" },
  en: { word: "Word", meaning: "Meaning", kind: "Part of speech", origin: "Origin", choose: "Choose from the following suggestions:", previous: "Previous", pageNext: "Next", noResult: "The dictionary is still under development; this word will be added later" },
  fr: { word: "Mot", meaning: "Sens", kind: "Nature", origin: "Origine", choose: "Choisissez parmi les suggestions suivantes :", previous: "Précédent", pageNext: "Suivant", noResult: "Le dictionnaire est encore en développement ; ce mot sera ajouté plus tard" },
  de: { word: "Wort", meaning: "Bedeutung", kind: "Wortart", origin: "Herkunft", choose: "Wählen Sie aus den folgenden Vorschlägen:", previous: "Zurück", pageNext: "Weiter", noResult: "Das Wörterbuch wird noch entwickelt; dieses Wort wird später hinzugefügt" },
};

function uiLanguage(searchKey = "") {
  const kind = searchKey ? scriptKind(normalize(searchKey)) : "ar";
  if (kind === "el") return "en";
  return UI_TEXT[kind] ? kind : "ar";
}
function uiTextFor(searchKey = "") {
  return UI_TEXT[uiLanguage(searchKey)] ?? UI_TEXT.ar;
}
function localizedValue(value, language) {
  return translateFieldValue(value, language);
}
function splitMeaning(value) {
  return String(value ?? "").split(/\s*[،,]\s*/u).map((part) => part.trim()).filter(Boolean);
}

// ---- الفهارس (تُبنى مرة واحدة عند أول بحث) ----
const searchIndex = lazy(() => {
  const meaning = [];
  const termTokens = [];
  const textExact = new Map();
  const textFirst = new Map();
  const meaningExact = new Map();
  const meaningFirst = new Map();
  const addRow = (map, key, row) => {
    if (!key) return;
    const rows = map.get(key);
    if (!rows) map.set(key, [row]);
    else if (rows[rows.length - 1] !== row) rows.push(row);
  };
  records.forEach((record, row) => {
    const terms = SEARCH_FIELDS.flatMap((field) => splitMeaning(record[field]).map(normalize))
      .filter(Boolean).map((value) => ({ value, tokens: toTokens(value) })).filter((term) => term.tokens);
    termTokens.push(terms.map((term) => term.tokens));
    const firstTerms = new Set();
    for (const term of terms) {
      addRow(textExact, term.value, row);
      const first = term.tokens.split(" ", 1)[0];
      if (first) firstTerms.add(first);
    }
    for (const first of firstTerms) addRow(textFirst, first, row);
    const parts = splitMeaning(record.meaning).map(normalize);
    const partTokens = parts.map(toTokens);
    meaning.push(partTokens);
    const firstParts = new Set();
    for (let i = 0; i < parts.length; i += 1) {
      addRow(meaningExact, partTokens[i], row);
      const first = partTokens[i]?.split(" ", 1)[0];
      if (first) firstParts.add(first);
    }
    for (const first of firstParts) addRow(meaningFirst, first, row);
  });
  return { meaning, termTokens, textExact, textFirst, meaningExact, meaningFirst };
});

function matchedPartIndex(record, normalizedQuery) {
  if (!ARABIC_LETTER.test(normalizedQuery)) return -1;
  const needle = tokens(normalizedQuery);
  const parts = splitMeaning(record.meaning);
  const exact = parts.findIndex((part) => tokens(part) === needle);
  if (exact >= 0) return exact;
  return parts.findIndex((part) => normalize(part).startsWith(normalizedQuery) || hasWholeWords(tokens(part), needle));
}

function voiceRecordForSearch(record, searchKey) {
  if (scriptKind(normalize(searchKey)) !== "el" || record?.id == null) return record;
  const copticIndex = recordIndexById().get(record.id);
  return copticIndex == null ? record : records[copticIndex];
}

function suggestionLabel(record, normalizedQuery) {
  if (ARABIC_LETTER.test(normalizedQuery)) {
    const part = matchedPartIndex(record, normalizedQuery);
    const meanings = splitMeaning(record.meaning);
    return (meanings[part >= 0 ? part : 0] || meanings[0] || record.english || "—").trim().slice(0, 48);
  }
  if (COPTIC_LETTER.test(normalizedQuery)) return String(record.coptic ?? "").replaceAll("`", "").trim().slice(0, 48) || "—";
  const kind = scriptKind(normalizedQuery);
  if (kind === "el") return String(record.greek ?? "").replaceAll("`", "").trim().slice(0, 48) || "—";
  if (kind === "fr") return String(record.translation_fr ?? "").trim().slice(0, 48) || "—";
  if (kind === "de") return String(record.translation_de ?? "").trim().slice(0, 48) || "—";
  if (kind === "en") return String(record.translation_en ?? record.english ?? "").trim().slice(0, 48) || String(record.phonetic ?? "").trim().slice(0, 48) || "—";
  return String(record.greek ?? record.coptic ?? record.english ?? "—").replaceAll("`", "").trim().slice(0, 48);
}

// ---- عرض بطاقة الكلمة ----
function formatRecord(record, partIndex = -1, searchedWord = "") {
  const parts = splitMeaning(record.meaning);
  const arabicPart = partIndex >= 0 && parts[partIndex] ? parts[partIndex] : parts.join("، ");
  const isCopticSearch = searchedWord === "" || scriptKind(normalize(searchedWord)) === "cop";
  const language = isCopticSearch ? "ar" : uiLanguage(searchedWord);
  const labels = UI_TEXT[language] ?? UI_TEXT.ar;
  const displayedWord = searchedWord || record.coptic;
  const fields = !isCopticSearch
    ? [
        [labels.word, displayedWord],
        [labels.meaning, record.coptic],
        [labels.kind, localizedValue(record.kind, language)],
        [labels.origin, localizedValue(record.origin, language)],
      ]
    : [
        [UI_TEXT.ar.word, displayedWord],
        [UI_TEXT.ar.meaning, arabicPart],
        [UI_TEXT.ar.kind, record.kind],
        [UI_TEXT.ar.origin, record.origin],
      ];
  const lines = [];
  for (const [label, raw] of fields) {
    const value = String(raw ?? "").trim();
    if (value) lines.push([label, value]);
  }
  return lines;
}

const SAME_WORD_FIELDS = ["coptic", "english", "phonetic", "translation_en", "translation_fr", "translation_de"];

const sameWordRows = lazy(() => {
  const map = new Map();
  records.forEach((record, row) => {
    for (const field of SAME_WORD_FIELDS) {
      const value = normalize(record[field] ?? "");
      if (!value) continue;
      const list = map.get(value);
      if (!list) map.set(value, [row]);
      else if (list[list.length - 1] !== row) list.push(row);
    }
  });
  return map;
});

function groupRows(index) {
  const base = records[index];
  const rows = new Set();
  for (const field of SAME_WORD_FIELDS) {
    const value = normalize(base?.[field] ?? "");
    if (value) for (const row of sameWordRows().get(value) ?? []) rows.add(row);
  }
  return [...rows].sort((a, b) => a - b);
}

function meaningOptions(index, normalizedQuery = "", preferredPart = -1) {
  const base = records[index];
  if (!base) return [];
  const group = groupRows(index).map((row) => ({ record: records[row], row }));
  const options = [];
  const add = (row, part) => {
    const partText = splitMeaning(records[row]?.meaning)[part] ?? "";
    const key = normalize(partText) || `${row}:${part}`;
    if (!options.some((item) => item.key === key)) options.push({ key, index: row, part });
  };
  const firstPart = preferredPart >= 0 ? preferredPart : matchedPartIndex(base, normalizedQuery);
  if (firstPart >= 0) add(index, firstPart);
  else if (splitMeaning(base.meaning).length) add(index, 0);
  for (const { record, row } of group) {
    const parts = splitMeaning(record.meaning);
    for (let part = 0; part < parts.length; part += 1) add(row, part);
  }
  return options;
}

// ---- البحث كما في بوت Apps Script القديم ----
export function scriptKind(key) {
  if (ARABIC_LETTER.test(key)) return "ar";
  if (COPTIC_LETTER.test(key)) return "cop";
  if (GREEK_LETTER.test(key)) return "el";
  if (LATIN_LETTER.test(key)) {
    const normalized = normalize(key);
    for (const kind of ["fr", "de", "en"]) {
      if (wordIndex(kind).map.has(normalized) || prefixWords(kind, normalized, 1).length) return kind;
    }
    return "en";
  }
  return "other";
}

const WORD_FIELDS = {
  cop: ["coptic"],
  el: [], // البحث باليونانية موقوف عمدًا في البوت الأصلي؛ عمود اليونانية للعرض فقط.
  en: ["english", "phonetic", "translation_en"],
  fr: ["translation_fr"],
  de: ["translation_de"],
  other: ["pronunciation"],
};
const wordIndexes = {};

function wordIndex(kind) {
  if (wordIndexes[kind]) return wordIndexes[kind];
  const map = new Map();
  const add = (text, row) => {
    const label = String(text ?? "").replaceAll("`", "").trim();
    const key = normalize(label);
    if (!key) return;
    const entry = map.get(key);
    if (!entry) map.set(key, { key, label, rows: [row] });
    else if (entry.rows[entry.rows.length - 1] !== row) entry.rows.push(row);
  };
  records.forEach((record, row) => {
    if (kind === "ar") {
      for (const part of splitMeaning(record.meaning)) add(part, row);
    } else {
      for (const field of WORD_FIELDS[kind]) for (const part of splitMeaning(record[field])) add(part, row);
    }
  });
  const sorted = [...map.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  wordIndexes[kind] = { map, sorted };
  return wordIndexes[kind];
}

function prefixWords(kind, key, limit = 5000) {
  const { sorted } = wordIndex(kind);
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (sorted[mid].key < key) low = mid + 1;
    else high = mid;
  }
  const found = [];
  for (let i = low; i < sorted.length && found.length < limit && sorted[i].key.startsWith(key); i += 1) found.push(sorted[i]);
  return found.sort((a, b) => a.rows[0] - b.rows[0]);
}

function exactChain(kind, key) {
  const entry = wordIndex(kind).map.get(key);
  if (!entry) return [];
  const options = [];
  const seen = new Set();
  if (kind === "ar") {
    for (const row of entry.rows) {
      const matchedPart = matchedPartIndex(records[row], key);
      if (matchedPart < 0) continue;
      const partText = splitMeaning(records[row]?.meaning)[matchedPart] ?? "";
      const uniqueKey = `${normalize(records[row]?.coptic ?? row)}|${normalize(partText)}`;
      if (seen.has(uniqueKey)) continue;
      seen.add(uniqueKey);
      options.push({ key: uniqueKey, index: row, part: matchedPart });
    }
  } else if (kind === "cop") {
    for (const row of entry.rows) {
      for (const option of meaningOptions(row, "", -1)) {
        if (seen.has(option.key)) continue;
        seen.add(option.key);
        options.push(option);
      }
    }
  } else {
    for (const row of entry.rows) {
      const key2 = normalize(records[row]?.coptic ?? row);
      if (seen.has(key2)) continue;
      seen.add(key2);
      options.push({ key: key2, index: row, part: -1 });
    }
  }
  return options;
}

function findMatches(query) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [];
  const index = searchIndex();
  if (ARABIC_LETTER.test(normalizedQuery)) {
    const needle = tokens(normalizedQuery);
    if (!needle) return [];
    const exact = index.meaningExact.get(needle) ?? [];
    const exactRows = new Set(exact);
    const matches = [];
    const first = needle.split(" ", 1)[0];
    for (const row of index.meaningFirst.get(first) ?? []) {
      if (!exactRows.has(row) && index.meaning[row].some((item) => hasWholeWords(item, needle))) matches.push(row);
    }
    return exact.concat(matches);
  }
  const needle = toTokens(normalizedQuery);
  if (!needle) return [];
  const exact = index.textExact.get(normalizedQuery) ?? [];
  const exactRows = new Set(exact);
  const partial = [];
  const first = needle.split(" ", 1)[0];
  for (const row of index.textFirst.get(first) ?? []) {
    if (!exactRows.has(row) && index.termTokens[row].some((field) => hasWholeWords(field, needle))) partial.push(row);
  }
  return exact.concat(partial);
}

// ---- النطق ----
// نص النطق الاحتياطي (كان يُرسل إلى Google TTS في البوت؛ هنا يقرؤه صوت المتصفح).
function speechSpelling(record) {
  const ipa = String(record?.pronunciation || "").trim();
  const copticSpelling = String(record?.coptic || "").trim();
  const sheetSpelling = String(record?.phonetic || "").trim();
  const usesIpa = Boolean(ipa);
  let word = (ipa || sheetSpelling || copticSpelling).trim();
  word = word
    .replaceAll("`", "")
    .replaceAll("ü", "u")
    .replaceAll("ï", "i")
    .replaceAll("ō", "o")
    .replaceAll("ā", "a")
    .replaceAll("ē", "e")
    .replace(/ɑʊ|iː|oː|eː|tʃ|ʃ|ʒ|kʰ|tʰ|pʰ|ŋ|ɣ|x|ɑ|ː/gu, (symbol) => {
      if (!usesIpa) return symbol;
      return { "ɑʊ": "au", "iː": "ee", "oː": "oh", "eː": "eh", tʃ: "tsch", "ʃ": "sh", "ʒ": "j", "kʰ": "kh", "tʰ": "th", "pʰ": "ph", "ŋ": "ng", "ɣ": "gh", x: "kh", "ɑ": "a", "ː": "" }[symbol] ?? symbol;
    })
    .replace(/^i(?=[aeiou])/u, "y")
    .replace(/\s*\/\s*/gu, ", ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 120);
  return word;
}
export function spokenText(record) {
  const word = speechSpelling(record);
  return word ? `${word}, ${word}, ${word}` : "";
}

// ---- بناء الرسائل (ما كان يرسله البوت إلى المحادثة) ----
function chainEntry(chain, step, key, { sendVoice }) {
  return entry(chain, chain[0].index, step, { chainKey: key, searchKey: key, sendVoice });
}

// الخطوة التالية في سلسلة معاني كلمة بحث (x| في البوت).
function chainStep(key, step) {
  const normalizedChainQuery = normalize(key);
  const chain = exactChain(scriptKind(normalizedChainQuery), normalizedChainQuery);
  if (!chain[step]) return null;
  return chainEntry(chain, step, key, { sendVoice: ARABIC_LETTER.test(normalizedChainQuery) });
}

// الخطوة التالية بعد بحث أعطى كلمة واحدة (n| في البوت).
function meaningStep(baseIndex, firstPart, step) {
  const options = meaningOptions(baseIndex, "", firstPart);
  if (!options[step]) return null;
  return entry(options, baseIndex, step, { searchKey: "", sendVoice: false });
}

function entry(options, baseIndex, step, { fallback, chainKey, searchKey = "", sendVoice = true }) {
  const selected = options[step] ?? fallback;
  const record = records[selected?.index];
  if (!record) return null;
  const language = uiLanguage(searchKey);
  const voiceRecord = voiceRecordForSearch(record, searchKey);
  const nextStep = step + 1;
  const key = chainKey ?? (searchKey || null);
  let more = null;
  if (options.length > nextStep) {
    const firstPart = Math.max(0, options[0].part);
    more = {
      text: MORE_BUTTON_TEXT[language] ?? MORE_BUTTON_TEXT.ar,
      run: () => (key !== null ? chainStep(key, nextStep) : meaningStep(baseIndex, firstPart, nextStep)),
    };
  }
  return {
    kind: "entry",
    fields: formatRecord(record, selected.part, searchKey),
    more,
    voice: sendVoice ? { record: voiceRecord, part: selected.part, key: searchKey } : null,
  };
}

function wordSuggestions(query, words, requestedPage) {
  const ui = uiTextFor(query);
  const totalPages = Math.max(1, Math.ceil(words.length / SUGGESTION_PAGE_SIZE));
  const page = Math.max(0, Math.min(requestedPage, totalPages - 1));
  const buttons = words.slice(page * SUGGESTION_PAGE_SIZE, (page + 1) * SUGGESTION_PAGE_SIZE).map((word) => ({
    text: word.label.slice(0, 48),
    run: () => {
      let key = word.key;
      const kind = scriptKind(key);
      let chain = exactChain(kind, key);
      if (!chain.length) {
        const [first] = prefixWords(kind, key, 1);
        if (first) {
          key = first.key;
          chain = exactChain(kind, key);
        }
      }
      return chain.length ? chainEntry(chain, 0, key, { sendVoice: true }) : null;
    },
  }));
  const nav = [];
  if (page > 0) nav.push({ text: ui.previous, replace: true, run: () => searchPage(query, page - 1) });
  if (page < totalPages - 1) nav.push({ text: ui.pageNext, replace: true, run: () => searchPage(query, page + 1) });
  return { kind: "suggest", title: ui.choose, buttons, nav };
}

function recordSuggestions(query, normalizedQuery, matches, requestedPage) {
  const ui = uiTextFor(query);
  const totalPages = Math.max(1, Math.ceil(matches.length / SUGGESTION_PAGE_SIZE));
  const page = Math.max(0, Math.min(requestedPage, totalPages - 1));
  const slice = matches.slice(page * SUGGESTION_PAGE_SIZE, (page + 1) * SUGGESTION_PAGE_SIZE);
  const languageQuery = uiLanguage(query) === "ar" ? "" : query;
  const buttons = slice.map((index) => {
    const part = matchedPartIndex(records[index], normalizedQuery);
    return {
      text: suggestionLabel(records[index], normalizedQuery),
      run: () => pickRecord(index, part >= 0 ? part : -1, languageQuery),
    };
  });
  const nav = [];
  if (page > 0) nav.push({ text: ui.previous, replace: true, run: () => searchPage(query, page - 1) });
  if (page < totalPages - 1) nav.push({ text: ui.pageNext, replace: true, run: () => searchPage(query, page + 1) });
  return { kind: "suggest", title: ui.choose, buttons, nav };
}

// s| في البوت: اختيار كلمة من قائمة الاقتراحات.
function pickRecord(index, partIndex = -1, searchKey = "") {
  const options = searchKey && scriptKind(normalize(searchKey)) !== "cop"
    ? [{ key: String(index), index, part: -1 }]
    : meaningOptions(index, "", partIndex);
  return entry(options, index, 0, { fallback: { index, part: partIndex }, searchKey });
}

// sendSearch في البوت. replacing=true تعني تنقّل بين صفحات رسالة موجودة (لا يُعاد عرض الكلمة الدقيقة).
function runSearch(query, page, replacing) {
  const cleanQuery = String(query ?? "").replace(/[\r\n]+/gu, " ").trim().slice(0, 160);
  const normalizedQuery = normalize(cleanQuery);

  if (normalizedQuery) {
    const kind = scriptKind(normalizedQuery);
    const isShortQuery = [...normalizedQuery.replace(/\s+/gu, "")].length <= SHORT_QUERY_MAX;
    if (!replacing && !isShortQuery) {
      const chain = exactChain(kind, normalizedQuery);
      if (chain.length) return chainEntry(chain, 0, cleanQuery, { sendVoice: true });
    }
    const words = prefixWords(kind, normalizedQuery);
    if (words.length) return wordSuggestions(cleanQuery, words, page);
  }
  const matches = findMatches(cleanQuery);
  if (!matches.length) return { kind: "text", text: uiTextFor(cleanQuery).noResult };
  if (matches.length > 1) return recordSuggestions(cleanQuery, normalizedQuery, matches, page);
  const options = meaningOptions(matches[0], normalizedQuery);
  const selected = options[0] ?? { index: matches[0], part: matchedPartIndex(records[matches[0]], normalizedQuery) };
  const record = records[selected.index];
  const language = uiLanguage(normalizedQuery);
  const voiceRecord = voiceRecordForSearch(record, normalizedQuery);
  let more = null;
  if (options.length > 1) {
    const firstPart = Math.max(0, options[0].part);
    more = {
      text: MORE_BUTTON_TEXT[language] ?? MORE_BUTTON_TEXT.ar,
      run: () => meaningStep(matches[0], firstPart, 1),
    };
  }
  return {
    kind: "entry",
    fields: formatRecord(record, selected.part, normalizedQuery),
    more,
    voice: { record: voiceRecord, part: selected.part, key: normalizedQuery },
  };
}

function searchPage(query, page) {
  return runSearch(query, page, true);
}

/** يعالج ما يكتبه المستخدم ويرجع الرسالة (أو null للأوامر التي تتولاها الواجهة). */
export function search(query) {
  return runSearch(query, 0, false);
}
