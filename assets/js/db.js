/* ==========================================================
   FTD Portal — طبقة قاعدة البيانات
   - Firebase Firestore إذا الإعدادات صحيحة
   - وإلا وضع تجريبي محلي (localStorage) عشان الموقع يشتغل مباشرة
   ========================================================== */
const cfg = window.FTD_CONFIG;
const fb = cfg.FIREBASE || {};
const configured = !!fb.apiKey && !String(fb.apiKey).startsWith('YOUR_');

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/* ---------------- الوضع المحلي ---------------- */
const makeLocal = () => {
  const mem = {};
  const subs = {};
  const read = (c) => {
    try { return JSON.parse(localStorage.getItem('ftd_' + c) || '[]'); }
    catch (e) { return mem[c] || []; }
  };
  const write = (c, rows) => {
    mem[c] = rows;
    try { localStorage.setItem('ftd_' + c, JSON.stringify(rows)); } catch (e) {}
  };
  const emit = (c) => (subs[c] || []).forEach((f) => f(read(c)));
  window.addEventListener('storage', (e) => {
    if (e.key && e.key.startsWith('ftd_')) emit(e.key.slice(4));
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
    async list(c) { return read(c); },
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
    list: async (c) => (await F.getDocs(F.collection(db, c))).docs.map((d) => ({ ...d.data(), id: d.id })),
    set: (c, id, data) => F.setDoc(F.doc(db, c, id), data),
    add: async (c, data) => (await F.addDoc(F.collection(db, c), data)).id,
    update: (c, id, data) => F.updateDoc(F.doc(db, c, id), data),
    remove: (c, id) => F.deleteDoc(F.doc(db, c, id))
  };
};

/* ---------------- Shared server storage (Netlify Function + Blobs) ----------------
   يعمل تلقائياً على Netlify بدون أي إعداد: كل المستخدمين يشوفون نفس البيانات */
const makeRemote = () => {
  const cache = {}, last = {}, subs = {};
  const url = (c, id) => `/api/db?c=${encodeURIComponent(c)}${id ? '&id=' + encodeURIComponent(id) : ''}`;
  const list = async (c) => {
    const r = await fetch(url(c), { cache: 'no-store' });
    if (!r.ok) throw new Error('Server error ' + r.status);
    return r.json();
  };
  const emit = (c) => (subs[c] || []).forEach((f) => f(cache[c] || []));
  const refresh = async (c) => {
    const rows = await list(c); const sig = JSON.stringify(rows);
    if (sig !== last[c]) { last[c] = sig; cache[c] = rows; emit(c); }
    return rows;
  };
  const post = async (c, body) => {
    const r = await fetch(url(c), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error('Save failed (' + r.status + ')');
    const j = await r.json(); await refresh(c).catch(() => {}); return j;
  };
  const tick = () => { if (document.hidden) return; Object.keys(subs).forEach((c) => subs[c].length && refresh(c).catch(() => {})); };
  setInterval(tick, 5000);
  document.addEventListener('visibilitychange', tick);
  window.addEventListener('focus', tick);
  return {
    mode: 'remote',
    now: () => Date.now(),
    subscribe(c, cb) {
      (subs[c] = subs[c] || []).push(cb);
      if (cache[c]) cb(cache[c]);
      refresh(c).then((rows) => { if (!cache[c] || rows.length === 0) cb(rows); }).catch((e) => console.error('[sync]', c, e));
      return () => { subs[c] = subs[c].filter((f) => f !== cb); };
    },
    async get(c, id) {
      const r = await fetch(url(c, id), { cache: 'no-store' });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error('Server error ' + r.status);
      return r.json();
    },
    list,
    set: (c, id, data) => post(c, { op: 'set', id, data }),
    add: async (c, data) => (await post(c, { op: 'add', data })).id,
    update: (c, id, data) => post(c, { op: 'update', id, data }),
    remove: (c, id) => post(c, { op: 'remove', id })
  };
};
const probeRemote = async () => {
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 4500);
    const r = await fetch('/api/db?c=ping', { cache: 'no-store', signal: ctl.signal }); clearTimeout(t);
    if (!r.ok) return false;
    return Array.isArray(await r.json());
  } catch (e) { return false; }
};

let DB = null;
if (configured) {
  try { DB = await makeFirebase(); }
  catch (e) { console.error('[FTD] Firebase failed, using fallback:', e); }
}
if (!DB && await probeRemote()) DB = makeRemote();
if (!DB) DB = makeLocal();

window.DB = DB;
window.dispatchEvent(new Event('ftd-db-ready'));
