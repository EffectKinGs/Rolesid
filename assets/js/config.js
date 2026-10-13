/* ==========================================================
   IAA Portal — الإعدادات المركزية
   كل ما تحتاج تعدله (الأدمن، الرتب، فايربيس، الخريطة) هنا
   ========================================================== */
window.IAA_CONFIG = {
  /* ---------- الهوية ---------- */
  BRAND: 'IAA',
  BRAND_FULL: 'INTERNATIONAL AFFAIRS AGENCY',
  EMAIL_DOMAIN: '@iaa.gov',

  /* ---------- حساب الأدمن (غيّرهم قبل النشر لو بتفتح الموقع للعامة) ---------- */
  ADMIN: {
    email: '11@iaa.gov',
    password: '11',
    name: 'System Administrator',
    rank: 'Director'
  },

  /* ---------- الرتب (من الأعلى للأدنى) ---------- */
  RANKS: [
    'Director',
    'Deputy Director',
    'Associate Deputy Director',
    'Executive Assistant Director',
    'Assistant Director',
    'Deputy Assistant Director',
    'Special Agent in Charge (SAC)',
    'Assistant Special Agent in Charge (ASAC)',
    'Supervisory Special Agent (SSA)',
    'Senior Special Agent',
    'Special Agent'
  ],

  /* الرتب اللي عندها صلاحيات كاملة (حذف / إدارة الموظفين) */
  COMMAND_RANKS: [
    'Director',
    'Deputy Director',
    'Associate Deputy Director',
    'Executive Assistant Director'
  ],

  /* ---------- أسماء مجموعات Firestore ---------- */
  COLLECTIONS: {
    users: 'police_users',
    cases: 'police_cases',
    wanted: 'police_wanted',
    civilians: 'police_civilians',
    duty: 'police_duty',
    markers: 'police_markers',
    nodes: 'police_nodes',
    links: 'police_links'
  },

  /* ---------- Firebase (استبدل القيم بمشروعك) ----------
     إذا تركتها YOUR_... يشتغل الموقع بوضع تجريبي محلي (localStorage) */
  FIREBASE: {
    apiKey: 'YOUR_API_KEY',
    authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
    projectId: 'YOUR_PROJECT_ID',
    storageBucket: 'YOUR_PROJECT_ID.firebasestorage.app',
    messagingSenderId: 'YOUR_SENDER_ID',
    appId: 'YOUR_APP_ID'
  },

  /* ---------- الشعار ----------
     ضع شعار القطاع الحقيقي في assets/img/logo.png وهو يظهر تلقائياً،
     وإذا ما وُجد يستخدم iaa_seal.svg */
  LOGO_PRIMARY: 'assets/img/logo.png',
  LOGO_FALLBACK: 'assets/img/iaa_seal.svg',

  /* ---------- الخريطة (تجرب بالترتيب) ----------
     روابط ديسكورد تنتهي صلاحيتها، الأفضل ترفع الصورة في assets/img/map.jpg */
  MAP_URLS: [
    'assets/img/map.jpg',
    'assets/img/map.png'
  ],

  /* ---------- المطور ---------- */
  DEV: { by: 'Dev By SaadEx', discord: '0j.e' }
};
