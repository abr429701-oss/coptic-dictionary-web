// نص النطق الاحتياطي: حين لا يوجد تسجيل صوتي يقرأ المتصفح هذا النص بصوته.
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
