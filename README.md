# F.T.D — Cloudflare version

- `public/`  → الموقع (الملفات الثابتة فقط، هذا هو اللي يُرفع كـ assets)
- `worker.js` → الـ API وقاعدة البيانات المشتركة (Cloudflare D1)
- `wrangler.jsonc` → إعدادات النشر

Deploy command: `npx wrangler deploy` — Build command: فارغ.
