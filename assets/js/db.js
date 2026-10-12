/* ==========================================================
   IAA Portal — طبقة قاعدة البيانات
   - Firebase Firestore إذا الإعدادات صحيحة
   - وإلا وضع تجريبي محلي (localStorage) عشان الموقع يشتغل مباشرة
   ========================================================== */
const cfg = window.IAA_CONFIG;
const fb = cfg.FIREBASE || {};
const configured = !!fb.apiKey && !String(fb.apiKey).startsWith('YOUR_');

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/* ---------------- الوضع المحلي ---------------- */
const makeLocal = () => {
  const mem = {};
  const subs = {};
  const read = (c) => {
    try { return JSON.parse(localStorage.getItem('iaa_' + c) || '[]'); }
    catch (e) { return mem[c] || []; }
  };
  const write = (c, rows) => {
    mem[c] = rows;
    try { localStorage.setItem('iaa_' + c, JSON.stringify(rows)); } catch (e) {}
  };
  const emit = (c) => (subs[c] || []).forEach((f) => f(read(c)));
  window.addEventListener('storage', (e) => {
    if (e.key && e.key.startsWith('iaa_')) emit(e.key.slice(4));
  });
  return {
    mode: 'local',
    now: () => Date.now(),
    subscribe(c, cb) {
      (subs[c] = subs[c] || []).push(cb);
      cb(read(c));
      return () => { subs[c] = subs[c].filter((f) => f !== cb); };
    },
    async get(c, id) { return read(c).find((r) => r.id === id) || null; },
    async set(c, id, data) {
      const rows = read(c).filter((r) => r.id !== id);
      rows.push({ ...data, id });
      write(c, rows); emit(c);
    },
    async add(c, data) {
      const rows = read(c); const id = uid();
      rows.push({ ...data, id }); write(c, rows); emit(c); return id;
    },
    async update(c, id, data) {
      write(c, read(c).map((r) => (r.id === id ? { ...r, ...data } : r))); emit(c);
    },
    async remove(c, id) {
      write(c, read(c).filter((r) => r.id !== id)); emit(c);
    }
  };
};

/* ---------------- Firebase ---------------- */
const makeFirebase = async () => {
  const V = '10.5.0';
  const { initializeApp } = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`);
  const F = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`);
  const db = F.getFirestore(initializeApp(fb));
  return {
    mode: 'firebase',
    now: () => F.serverTimestamp(),
    subscribe(c, cb) {
      return F.onSnapshot(
        F.collection(db, c),
        (s) => cb(s.docs.map((d) => ({ ...d.data(), id: d.id }))),
        (err) => console.error('[Firestore]', c, err)
      );
    },
    async get(c, id) {
      const s = await F.getDoc(F.doc(db, c, id));
      return s.exists() ? { ...s.data(), id: s.id } : null;
    },
    set: (c, id, data) => F.setDoc(F.doc(db, c, id), data),
    add: async (c, data) => (await F.addDoc(F.collection(db, c), data)).id,
    update: (c, id, data) => F.updateDoc(F.doc(db, c, id), data),
    remove: (c, id) => F.deleteDoc(F.doc(db, c, id))
  };
};

let DB = null;
if (configured) {
  try { DB = await makeFirebase(); }
  catch (e) { console.error('[IAA] Firebase failed, using local demo mode:', e); }
}
if (!DB) DB = makeLocal();

window.DB = DB;
window.dispatchEvent(new Event('iaa-db-ready'));
