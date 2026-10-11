# FBI Portal

واجهة بوابة ثابتة تعمل من ملف HTML واحد، ومهيأة للنشر على Netlify.

## الملفات

- `index.html`: نقطة الدخول التي يستخدمها Netlify.
- `fbi_portal10.html`: النسخة الأصلية من الواجهة.
- `fbi_seal.png`: صورة الختم المستخدمة في الواجهة.
- `netlify.toml`: إعداد النشر.

## تشغيل محلي

```bash
python3 -m http.server 8080
```

ثم افتح `http://localhost:8080`.

## النشر

اربط هذا المجلد بمستودع GitHub، ثم في Netlify اختر **Add new site → Import an existing project → GitHub**. إعدادات النشر:

- Build command: فارغ
- Publish directory: `.`

بعد الربط، كل تعديل يتم دفعه إلى الفرع الرئيسي في GitHub سيؤدي إلى نشر تلقائي في Netlify.

## Firebase

إعدادات Firebase داخل الصفحة ما زالت قيمًا تجريبية. يلزم استبدالها بإعدادات مشروع Firebase الحقيقي وتكوين قواعد Firestore قبل استخدام البيانات.
