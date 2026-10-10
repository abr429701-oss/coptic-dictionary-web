// إعدادات الموقع. غيّر القيم هنا فقط.
export const CONFIG = {
  // ملف القاموس (يُحدَّث تلقائيًا من Google Sheets عبر GitHub Actions).
  DICTIONARY_URL: "data/dictionary.json",

  // النطق الافتراضي (نفس مصدر البوت): ملفات <رقم الكلمة>.ogg على فرع "audio" في مستودع البوت العام.
  // لو نسخت الملفات إلى مستودعك، ضع هنا مسارها (مثلًا "audio").
  AUDIO_BASE_URL: "https://raw.githubusercontent.com/abr429701-oss/coptic-dictionary-bot/audio",

  // تسجيلات "Matthew / IPA" المضمّنة في الموقع (27 كلمة)، وتُفضَّل على النطق الافتراضي إن وُجدت.
  HUMAN_AUDIO_URL: "audio-human",
  HUMAN_AUDIO: true,

  // لو لم يوجد ملف صوتي للكلمة، يُقرأ نطقها بصوت المتصفح (بديل Google TTS في البوت).
  SPEECH_FALLBACK: true,
};
