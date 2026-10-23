// مصطلحات تتبع لغة الواجهة: أشهر التقويم القبطي، ونوع الكلمة وأصلها، واختيار المعنى بلغة العرض.
// مشترك بين المتصفح واختبارات Node (لا يعتمد على DOM).
import { normalize } from "./norm.js";

// ---------- التقويم القبطي ----------
export const COPTIC_MONTHS = {
  ar: ["توت", "بابه", "هاتور", "كيهك", "طوبة", "أمشير", "برمهات", "برمودة", "بشنس", "بؤونة", "أبيب", "مسرى", "النسئ"],
  en: ["Thout", "Paopi", "Hathor", "Koiak", "Toba", "Meshir", "Paremhat", "Parmouti", "Pashons", "Paoni", "Epip", "Mesori", "Nasie"],
  fr: ["Thout", "Paopi", "Hathor", "Koiak", "Toba", "Meshir", "Paremhat", "Parmouti", "Pashons", "Paoni", "Épiph", "Mesori", "Nasie"],
  de: ["Thout", "Paopi", "Hathor", "Koiak", "Toba", "Meshir", "Paremhat", "Parmute", "Pachons", "Paoni", "Epip", "Mesori", "Nasie"],
};

// التاريخ القبطي لتاريخ اليوم المحلي، بالخوارزمية القياسية عبر رقم اليوم اليولياني (دقيق في السنوات الكبيسة).
const COPTIC_EPOCH = 1825029.5;
const copticToJD = (year, month, day) => day + (month - 1) * 30 + (year - 1) * 365 + Math.floor(year / 4) + COPTIC_EPOCH - 1;
function gregorianToJD(year, month, day) {
  const a = Math.floor((14 - month) / 12), y = year + 4800 - a, m = month + 12 * a - 3;
  const jdn = day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
  return jdn - 0.5;
}
export function copticParts(now = new Date()) {
  const jd = Math.floor(gregorianToJD(now.getFullYear(), now.getMonth() + 1, now.getDate())) + 0.5;
  const year = Math.floor((4 * (jd - COPTIC_EPOCH) + 1463) / 1461);
  const month = 1 + Math.floor((jd - copticToJD(year, 1, 1)) / 30);
  const day = jd + 1 - copticToJD(year, month, 1);
  return { year, month, day };
}
export function copticDate(now = new Date(), lang = "ar") {
  const { year, month, day } = copticParts(now);
  const names = COPTIC_MONTHS[lang] || COPTIC_MONTHS.ar;
  return `${day} ${names[month - 1]} ${year}`;
}

// ---------- نوع الكلمة ----------
// المفتاح عربي (يُطبَّع كما يُطبَّع النص)، والقيم: [إنجليزي، فرنسي، ألماني].
const TERMS = new Map();
const MODS = new Set(); // المذكر/المؤنث/الجمع: تُضاف بعد الفاصلة، وتُلصق بـ "و" (ومؤنث = and feminine).
const add = (ar, en, fr, de, isMod = false) => {
  for (const key of [].concat(ar).map(normalize)) { TERMS.set(key, { en, fr, de }); if (isMod) MODS.add(key); }
};
add(["مذكر", "مذكرة"], "masculine", "masculin", "maskulin", true);
add(["مؤنث", "مؤنثة"], "feminine", "féminin", "feminin", true);
add("جمع", "plural", "pluriel", "Plural", true);

add("اسم", "noun", "nom", "Substantiv");
add("فعل", "verb", "verbe", "Verb");
add("صفة", "adjective", "adjectif", "Adjektiv");
add(["ظرف", "adv."], "adverb", "adverbe", "Adverb");
add("ظرف زمان", "adverb of time", "adverbe de temps", "Zeitadverb");
add("ظرف مكان", "adverb of place", "adverbe de lieu", "Ortsadverb");
add("حرف جر", "preposition", "préposition", "Präposition");
add(["حرف عطف", "أداة عطف", "أداة ربط", "أداة وصل"], "conjunction", "conjonction", "Konjunktion");
add("حرف", "letter", "lettre", "Buchstabe");
add(["حرف مذكر"], "particle, masculine", "particule, masculin", "Partikel, maskulin");
add(["حرف مؤنث"], "particle, feminine", "particule, féminin", "Partikel, feminin");
add(["رقم", "عدد"], "numeral", "nombre", "Zahlwort");
add("جملة", "phrase", "phrase", "Satz");
add("توكيد", "emphasis", "insistance", "Betonung");
add("حال", "adverbial", "adverbial", "adverbial");
add("غير محدد", "unspecified", "non précisé", "nicht angegeben");
add("يوناني", "Greek", "grec", "griechisch");
add("زائدة", "prefix", "préfixe", "Präfix");
add("بادئة", "prefix", "préfixe", "Präfix");
add("prefix", "prefix", "préfixe", "Präfix");
add(["لاحقة", "suffix"], "suffix", "suffixe", "Suffix");

add("أداة", "particle", "particule", "Partikel");
add("أداة نفي", "negative particle", "particule négative", "Negationspartikel");
add("أداة ملكية", "possessive particle", "particule possessive", "Possessivpartikel");
add("أداة استفهام", "interrogative particle", "particule interrogative", "Fragepartikel");
add(["أداة تأكيد"], "emphatic particle", "particule d'insistance", "Betonungspartikel");
add("أداة تعجب", "exclamation particle", "particule d'exclamation", "Ausrufepartikel");
add("أداة إشارة", "demonstrative particle", "particule démonstrative", "Demonstrativpartikel");
add("أداة شرط", "conditional particle", "particule conditionnelle", "Konditionalpartikel");
add("أداة تعريف", "definite article", "article défini", "bestimmter Artikel");
add("أداة تنكير", "indefinite article", "article indéfini", "unbestimmter Artikel");
add("أداة تنبيه", "attention particle", "particule d'avertissement", "Aufmerksamkeitspartikel");
add("أداة تمني", "wish particle", "particule de souhait", "Wunschpartikel");
add("أداة نداء", "vocative particle", "particule vocative", "Vokativpartikel");
add("أداة مقارنة", "comparative particle", "particule comparative", "Vergleichspartikel");
add("أداة جمع", "plural particle", "particule de pluriel", "Pluralpartikel");
add(["أداة مفعول", "علامة المفعول"], "object marker", "marque d'objet", "Objektmarker");
add("علامة المصدر", "infinitive marker", "marque de l'infinitif", "Infinitivmarker");
add("علامة المضاف إليه", "genitive marker", "marque du génitif", "Genitivmarker");
add("علامة الحال", "circumstantial marker", "marque circonstancielle", "Umstandsmarker");
add("علامة اسم الفاعل", "participle marker", "marque du participe", "Partizipmarker");
add("علامة الماضي", "past-tense marker", "marque du passé", "Vergangenheitsmarker");
add("علامة زمن المستقبل", "future-tense marker", "marque du futur", "Futurmarker");

add("ضمير", "pronoun", "pronom", "Pronomen");
add("ضمير ملكية", "possessive pronoun", "pronom possessif", "Possessivpronomen");
add("ضمير وصل", "relative pronoun", "pronom relatif", "Relativpronomen");
add("ضمير مفعول", "object pronoun", "pronom objet", "Objektpronomen");
add(["ضمير إشارة", "اسم إشارة"], "demonstrative pronoun", "pronom démonstratif", "Demonstrativpronomen");
add("اسم استفهام", "interrogative pronoun", "pronom interrogatif", "Interrogativpronomen");
add("اسم موصول", "relative pronoun", "pronom relatif", "Relativpronomen");

add("فعل حالة", "stative verb", "verbe d'état", "Zustandsverb");
add("فعل أمر", "imperative verb", "verbe à l'impératif", "Imperativverb");
add("فعل وجود", "existential verb", "verbe d'existence", "Existenzverb");
add("فعل منعكس", "reflexive verb", "verbe réfléchi", "reflexives Verb");

// ملاحظات الاستخدام: تُطابَق كاملةً.
const NOTES = new Map();
const note = (ar, en, fr, de) => NOTES.set(normalize(ar), { en, fr, de });
note("صيغة مصدرية للفعل يأتي بعدها أداة المفعول ثم المفعول", "infinitive form, followed by the object marker and then the object", "forme infinitive, suivie de la marque d'objet puis de l'objet", "Infinitivform, danach folgen der Objektmarker und das Objekt");
note("صيغة للفعل يأتي بعدها المفعول مباشرة بدون أداة مفعول", "verb form, followed directly by the object with no object marker", "forme verbale, suivie directement de l'objet sans marque d'objet", "Verbform, das Objekt folgt direkt ohne Objektmarker");
note("صيغة ضميرية يأتي بعدها ضمير مفعول", "pronominal form, followed by an object pronoun", "forme pronominale, suivie d'un pronom objet", "Pronominalform, danach folgt ein Objektpronomen");
note("صيغة ضميرية", "pronominal form", "forme pronominale", "Pronominalform");
note("صيغة وصفية", "qualitative (stative) form", "forme qualitative (état)", "Qualitativ (Zustandsform)");
note("صيغة مركبة", "compound form", "forme composée", "zusammengesetzte Form");
note("صيغة تفضيل", "comparative form", "forme comparative", "Komparativform");
note("صيغة أمر", "imperative form", "forme impérative", "Imperativform");
note("يأتي قبلها الضمير", "preceded by the pronoun", "précédée du pronom", "davor steht das Pronomen");
note("يأتي بعدها ضمير", "followed by a pronoun", "suivie d'un pronom", "danach folgt ein Pronomen");

const AND = { en: "and", fr: "et", de: "und" };
const isNote = (segment) => /^(صيغه|ياتي)/u.test(segment);
const capitalize = (text) => (text ? text[0].toLocaleUpperCase() + text.slice(1) : text);

function wordPieces(segment, lang) {
  const tokens = segment.split(" ");
  const pieces = [];
  for (let i = 0; i < tokens.length;) {
    let used = 0, piece = null;
    for (let n = Math.min(4, tokens.length - i); n > 0 && !piece; n--) {
      const key = tokens.slice(i, i + n).join(" ");
      if (TERMS.has(key)) { piece = { text: TERMS.get(key)[lang] }; used = n; }
      else if (n === 1 && key.length > 2 && key[0] === "و" && MODS.has(key.slice(1))) {
        piece = { text: `${AND[lang]} ${TERMS.get(key.slice(1))[lang]}`, and: true }; used = 1;
      }
    }
    pieces.push(piece || { text: tokens[i] });
    i += used || 1;
  }
  return pieces;
}

// يفصل نوع الكلمة إلى: main (النوع والجنس) و note (طريقة الاستخدام النحوية)، بلغة العرض.
export function describeKind(kind, lang = "ar") {
  // بعض القيم تنسى الفاصلة قبل "صيغة"؛ نضيفها حتى تنفصل ملاحظة الاستخدام.
  const raw = String(kind ?? "").trim().replace(/([^،,\s-])\s+صيغة/gu, "$1، صيغة");
  if (!raw) return { main: "", note: "" };
  if (lang === "ar" || !TERMS.get(normalize("اسم"))?.[lang]) {
    const segments = raw.split(/\s*[،,]\s*/u).filter(Boolean);
    return {
      main: segments.filter((s) => !isNote(normalize(s))).join("، "),
      note: segments.filter((s) => isNote(normalize(s))).join("؛ "),
    };
  }
  const normalized = normalize(raw).replace(/صيغه وصفيه\s*-\s*حال/u, "صيغه وصفيه");
  const segments = normalized.split(/\s*[،,]\s*|\s+-\s+/u).filter(Boolean);
  let main = "";
  const seen = new Set(), notes = [];
  for (const segment of segments) {
    if (isNote(segment)) {
      const translated = NOTES.get(segment)?.[lang] ?? segment;
      if (!notes.includes(translated)) notes.push(translated);
      continue;
    }
    for (const piece of wordPieces(segment, lang)) {
      if (seen.has(piece.text)) continue;
      seen.add(piece.text);
      main = !main ? piece.text : piece.and ? `${main} ${piece.text}` : `${main}, ${piece.text}`;
    }
  }
  return { main: capitalize(main), note: capitalize(notes.join("; ")) };
}

// ---------- الأصل ----------
const ORIGINS = new Map();
const origin = (keys, en, fr, de) => { for (const key of keys) ORIGINS.set(normalize(key), { en, fr, de }); };
origin(["قبطي", "قبطية"], "Coptic", "copte", "Koptisch");
origin(["يوناني", "يونانية"], "Greek", "grec", "Griechisch");
origin(["عبري", "عبرية"], "Hebrew", "hébreu", "Hebräisch");
origin(["لاتيني", "لاتينية"], "Latin", "latin", "Lateinisch");
origin(["آرامي", "آرامية"], "Aramaic", "araméen", "Aramäisch");
origin(["سرياني", "سريانية"], "Syriac", "syriaque", "Syrisch");

export function originLabel(value, lang = "ar") {
  const raw = String(value ?? "").trim();
  if (!raw || lang === "ar") return raw;
  const hit = ORIGINS.get(normalize(raw))?.[lang];
  return hit ? capitalize(hit) : raw;
}
export const isGreekOrigin = (value) => ORIGINS.get(normalize(String(value ?? "")))?.en === "Greek";

// ---------- المعنى بلغة العرض ----------
// يرجع { text, lang }: ترجمة اللغة المختارة إن وُجدت، وإلا المعنى العربي.
export function meaningFor(record, lang = "ar") {
  const arabic = String(record?.meaning ?? "").trim();
  const translated = {
    en: record?.translation_en || record?.english,
    fr: record?.translation_fr,
    de: record?.translation_de,
  }[lang];
  const text = String(translated ?? "").trim();
  return lang !== "ar" && text ? { text, lang } : { text: arabic, lang: "ar" };
}
