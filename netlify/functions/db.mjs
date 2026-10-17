import { getStore } from '@netlify/blobs';

const json = (o, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const key = (id) => encodeURIComponent(id);
const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export default async (req) => {
  const u = new URL(req.url);
  const c = u.searchParams.get('c') || '';
  if (!/^[a-zA-Z0-9_]{1,40}$/.test(c)) return json({ error: 'bad collection' }, 400);
  const store = getStore({ name: 'ftd-' + c, consistency: 'strong' });

  if (req.method === 'GET') {
    const id = u.searchParams.get('id');
    if (id) {
      const row = await store.get(key(id), { type: 'json' });
      return row ? json(row) : json({ error: 'not found' }, 404);
    }
    const { blobs } = await store.list();
    const rows = (await Promise.all(blobs.map((b) => store.get(b.key, { type: 'json' })))).filter(Boolean);
    return json(rows);
  }

  if (req.method === 'POST') {
    let b; try { b = await req.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
    const data = { ...(b.data || {}) }; delete data.id;
    if (b.op === 'add') {
      const id = rid();
      await store.setJSON(key(id), { ...data, id });
      return json({ id });
    }
    if (!b.id) return json({ error: 'id required' }, 400);
    if (b.op === 'set') { await store.setJSON(key(b.id), { ...data, id: b.id }); return json({ id: b.id }); }
    if (b.op === 'update') {
      const cur = (await store.get(key(b.id), { type: 'json' })) || {};
      await store.setJSON(key(b.id), { ...cur, ...data, id: b.id });
      return json({ id: b.id });
    }
    if (b.op === 'remove') { await store.delete(key(b.id)); return json({ id: b.id }); }
  }
  return json({ error: 'bad request' }, 400);
};

export const config = { path: '/api/db' };
