// FTD Portal — Cloudflare Worker: static site + shared database (D1)
const json = (o, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const okName = (c) => /^[a-zA-Z0-9_]{1,40}$/.test(c);

let ready = null;
const init = (env) => {
  if (!ready) {
    ready = env.DB.batch([
      env.DB.prepare('CREATE TABLE IF NOT EXISTS docs (c TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY (c, id))'),
      env.DB.prepare('CREATE TABLE IF NOT EXISTS meta (c TEXT PRIMARY KEY, v INTEGER NOT NULL DEFAULT 0)')
    ]).catch((e) => { ready = null; throw e; });
  }
  return ready;
};

async function api(request, env) {
  if (!env.DB) return json({ error: 'D1 binding "DB" is missing' }, 500);
  await init(env);
  const u = new URL(request.url);
  const bump = (c) => env.DB.prepare('INSERT INTO meta (c, v) VALUES (?, 1) ON CONFLICT(c) DO UPDATE SET v = v + 1').bind(c);

  if (request.method === 'GET') {
    const vs = u.searchParams.get('versions');
    if (vs) {
      const names = vs.split(',').filter(okName);
      const { results } = await env.DB.prepare('SELECT c, v FROM meta').all();
      const out = {}; names.forEach((n) => { out[n] = 0; });
      results.forEach((r) => { if (r.c in out) out[r.c] = r.v; });
      return json(out);
    }
    const c = u.searchParams.get('c') || '';
    if (!okName(c)) return json({ error: 'bad collection' }, 400);
    const id = u.searchParams.get('id');
    if (id) {
      const row = await env.DB.prepare('SELECT data FROM docs WHERE c = ? AND id = ?').bind(c, id).first();
      return row ? new Response(row.data, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }) : json({ error: 'not found' }, 404);
    }
    const { results } = await env.DB.prepare('SELECT data FROM docs WHERE c = ?').bind(c).all();
    return json(results.map((r) => JSON.parse(r.data)));
  }

  if (request.method === 'POST') {
    const c = u.searchParams.get('c') || '';
    if (!okName(c)) return json({ error: 'bad collection' }, 400);
    let b; try { b = await request.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
    const data = { ...(b.data || {}) }; delete data.id;
    const put = (id, obj) => env.DB.prepare('INSERT OR REPLACE INTO docs (c, id, data) VALUES (?, ?, ?)').bind(c, id, JSON.stringify({ ...obj, id }));
    if (b.op === 'add') { const id = rid(); await env.DB.batch([put(id, data), bump(c)]); return json({ id }); }
    if (!b.id) return json({ error: 'id required' }, 400);
    if (b.op === 'set') { await env.DB.batch([put(b.id, data), bump(c)]); return json({ id: b.id }); }
    if (b.op === 'update') {
      const cur = await env.DB.prepare('SELECT data FROM docs WHERE c = ? AND id = ?').bind(c, b.id).first();
      await env.DB.batch([put(b.id, { ...(cur ? JSON.parse(cur.data) : {}), ...data }), bump(c)]);
      return json({ id: b.id });
    }
    if (b.op === 'remove') {
      await env.DB.batch([env.DB.prepare('DELETE FROM docs WHERE c = ? AND id = ?').bind(c, b.id), bump(c)]);
      return json({ id: b.id });
    }
  }
  return json({ error: 'bad request' }, 400);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/db') {
      try { return await api(request, env); }
      catch (e) { return json({ error: String(e && e.message || e) }, 500); }
    }
    return env.ASSETS.fetch(request);
  }
};
