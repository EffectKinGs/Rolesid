# FBI Portal — تشغيل محلي

الملفات:

- `fbi_portal10.html`: واجهة البوابة كاملة في ملف واحد.
- `fbi_seal.png`: صورة الختم المطلوبة من صفحة HTML.

## التشغيل

يمكن فتح `fbi_portal10.html` مباشرة في المتصفح، لكن التشغيل عبر خادم محلي أفضل:

```bash
python3 -m http.server 8080
```

ثم افتح:

`http://localhost:8080/fbi_portal10.html`

## ملاحظة إعداد Firebase

الملف يحتوي على قيم تجريبية (`YOUR_API_KEY` و`YOUR_PROJECT_ID` وغيرها). لكي تعمل قراءة وكتابة البيانات، استبدلها بإعدادات مشروع Firebase/Firestore الخاص بك، ثم اضبط قواعد Firestore قبل الاستخدام.
