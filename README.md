# ⲭⲏⲙⲓ — القاموس القبطي

موقع ثابت سريع للقاموس القبطي البحيري. لا يحمّل القاموس كاملًا: يُبنى من Google Sheets فهرسٌ مجزّأ إلى ملفات صغيرة،
ويحمّل المتصفح الملف الصغير الخاص بما تكتبه فقط (عادةً أقل من 40KB)، ثم يُخزَّن محليًا عبر Service Worker.

## كيف يعمل
- `scripts/sheet_to_json.py` ينزّل الشيت إلى `data/dictionary.json` (كل 30 دقيقة عبر GitHub Actions).
- `scripts/build-site.mjs` يبني الفهرس المجزّأ `i/` وتفاصيل المداخل `d/` والملفات الثابتة إلى `_site`، ثم يُنشر.
- `js/search.js` البحث، `js/app.js` الواجهة، `js/norm.js` تطبيع النص (مشترك بين البناء والمتصفح).

## محليًا
```bash
npm run build && npm start   # http://localhost:8000  (يبني ثم يخدم _site)
npm test
```
