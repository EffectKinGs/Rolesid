/* ==========================================================
   IAA Portal — app.jsx
   ========================================================== */
const { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext } = React;
const C = window.IAA_CONFIG;
const UI = createContext(null);
const col = (k) => C.COLLECTIONS[k];

/* ---------------- helpers ---------------- */
const hashPw = async (s) => {
  try {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join('');
  } catch (e) { return 'plain:' + s; }
};
const tsMs = (v) => (v && typeof v.toMillis === 'function' ? v.toMillis() : typeof v === 'number' ? v : 0);
const sortNew = (rows) => [...rows].sort((a, b) => (tsMs(b.createdAt) || 9e15) - (tsMs(a.createdAt) || 9e15));
const timeNow = () => new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const useClock = () => {
  const [t, setT] = useState(() => new Date());
  useEffect(() => { const i = setInterval(() => setT(new Date()), 1000); return () => clearInterval(i); }, []);
  return t.toLocaleTimeString('en-US');
};
const useCol = (key) => {
  const [rows, setRows] = useState([]);
  useEffect(() => window.DB.subscribe(col(key), setRows), [key]);
  return rows;
};

/* ---------------- small components ---------------- */
const Logo = ({ size = 48, style }) => {
  const [src, setSrc] = useState(C.LOGO_PRIMARY);
  return (
    <img src={src} alt={C.BRAND} width={size} height={size}
      style={{ width: size, height: size, objectFit: 'contain', ...style }}
      onError={() => src !== C.LOGO_FALLBACK && setSrc(C.LOGO_FALLBACK)} />
  );
};
const Empty = ({ icon, text }) => (
  <div className="empty"><i className={`fa-solid ${icon}`} /><p>{text}</p></div>
);
const Field = ({ label, children }) => (
  <label className="field"><span className="label">{label}</span>{children}</label>
);
const Avatar = ({ name, photo, size = 44, icon }) => {
  const [bad, setBad] = useState(false);
  return (
    <div className="avatar" style={{ width: size, height: size }}>
      {photo && !bad ? <img src={photo} alt="" onError={() => setBad(true)} />
        : icon ? <i className={`fa-solid ${icon}`} /> : <span>{(name || '?')[0].toUpperCase()}</span>}
    </div>
  );
};
const Mugshot = ({ src }) => {
  const [bad, setBad] = useState(false);
  return src && !bad
    ? <img className="mugshot" src={src} alt="" onError={() => setBad(true)} />
    : <div className="mugshot none"><i className="fa-solid fa-user-slash" /><span>NO PHOTO</span></div>;
};
const PageHead = ({ title, color, action }) => (
  <div className="page-head">
    <h1 style={color ? { '--c': color } : null}>{title}</h1>
    {action}
  </div>
);

/* ---------------- App root ---------------- */
const App = () => {
  const [ready, setReady] = useState(!!window.DB);
  const [user, setUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('iaa_session') || 'null'); } catch (e) { return null; }
  });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [confirmSt, setConfirmSt] = useState(null);

  useEffect(() => {
    if (ready) return;
    const h = () => setReady(true);
    window.addEventListener('iaa-db-ready', h);
    return () => window.removeEventListener('iaa-db-ready', h);
  }, [ready]);

  const toast = useCallback((msg, type = 'info') => {
    const id = Math.random();
    setToasts((p) => [...p, { id, msg, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3600);
  }, []);
  const confirm = useCallback((msg) => new Promise((res) => setConfirmSt({ msg, res })), []);
  const ui = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  const doLogin = async (emailRaw, pw) => {
    const em = (emailRaw || '').trim().toLowerCase();
    if (!em || !pw) { setErr('ENTER YOUR CREDENTIALS'); return; }
    if (!em.endsWith(C.EMAIL_DOMAIN)) { setErr(`INVALID EMAIL DOMAIN — USE ${C.EMAIL_DOMAIN}`); return; }
    setErr(''); setLoading(true);
    await new Promise((r) => setTimeout(r, 700));
    let session = null;
    if (em === C.ADMIN.email.toLowerCase() && pw === C.ADMIN.password) {
      session = { id: em, name: C.ADMIN.name, rank: C.ADMIN.rank, access: 'command', photo: '' };
    } else {
      try {
        let rec = await window.DB.get(col('users'), em);
        if (!rec) {
          // دعم الحسابات القديمة المخزنة بحروف كبيرة
          const all = await new Promise((res) => { const un = window.DB.subscribe(col('users'), (r) => { res(r); setTimeout(() => un && un(), 0); }); });
          rec = all.find((u) => (u.id || '').toLowerCase() === em) || null;
        }
        if (rec) {
          const h = await hashPw(pw);
          const ok = rec.passHash ? rec.passHash === h : !!rec.password && rec.password === pw;
          if (ok) session = { id: rec.id, name: rec.name, rank: rec.rank, access: rec.access || 'field', photo: rec.photo || '' };
        }
      } catch (e) { console.error(e); setErr('CONNECTION ERROR — TRY AGAIN'); setLoading(false); return; }
    }
    setLoading(false);
    if (!session) { setErr('ACCESS DENIED — INVALID CREDENTIALS'); return; }
    try { sessionStorage.setItem('iaa_session', JSON.stringify(session)); } catch (e) {}
    setUser(session);
  };
  const doLogout = () => {
    try { sessionStorage.removeItem('iaa_session'); } catch (e) {}
    setUser(null); setErr('');
  };

  if (!ready) return <div className="boot">INITIALIZING…</div>;
  return (
    <UI.Provider value={ui}>
      {user
        ? <Portal user={user} onLogout={doLogout} />
        : <LoginScreen onLogin={doLogin} error={err} setError={setErr} loading={loading} />}
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            <i className={`fa-solid ${t.type === 'error' ? 'fa-circle-exclamation' : t.type === 'ok' ? 'fa-circle-check' : 'fa-circle-info'}`} />{t.msg}
          </div>
        ))}
      </div>
      {confirmSt && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) { confirmSt.res(false); setConfirmSt(null); } }}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-head"><h3 style={{ color: '#ff8f87' }}>Confirm</h3></div>
            <div className="modal-body"><p dir="auto" style={{ lineHeight: 1.7 }}>{confirmSt.msg}</p></div>
            <div className="modal-foot">
              <button className="btn btn-danger" onClick={() => { confirmSt.res(true); setConfirmSt(null); }}><i className="fa-solid fa-trash" /> Delete</button>
              <button className="btn btn-outline" onClick={() => { confirmSt.res(false); setConfirmSt(null); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </UI.Provider>
  );
};

/* ---------------- Login ---------------- */
const LoginScreen = ({ onLogin, error, setError, loading }) => {
  const [em, setEm] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const clock = useClock();
  const submit = () => onLogin(em, pw);
  const onKey = (e) => e.key === 'Enter' && submit();
  return (
    <div className="login-wrap">
      <div className="login-top">
        <span>Classified network — authorized personnel only</span>
        <span className="clk">{clock}</span>
      </div>
      <div className="login-center">
        <div className="login-card fade-up">
          <div className="seal-wrap"><Logo size={112} /></div>
          <h1 className="login-title">{C.BRAND}</h1>
          <p className="login-full">{C.BRAND_FULL}</p>
          <p className="login-sub">SECURE TERMINAL ACCESS</p>
          <div className="login-form">
            <Field label="Email Address">
              <div className="input-icon">
                <i className="fa-solid fa-envelope lead" />
                <input className="input" type="email" placeholder={`username${C.EMAIL_DOMAIN}`} value={em}
                  autoComplete="off" autoCapitalize="none" onKeyDown={onKey}
                  onChange={(e) => { setEm(e.target.value); setError(''); }} />
              </div>
            </Field>
            <Field label="Password">
              <div className="input-icon">
                <i className="fa-solid fa-lock lead" />
                <input className="input" type={show ? 'text' : 'password'} placeholder="••••••••" value={pw}
                  autoComplete="off" onKeyDown={onKey}
                  onChange={(e) => { setPw(e.target.value); setError(''); }} />
                <button type="button" className="icon-btn eye" onClick={() => setShow(!show)} tabIndex={-1}>
                  <i className={`fa-solid ${show ? 'fa-eye-slash' : 'fa-eye'}`} />
                </button>
              </div>
            </Field>
            {error && <div className="alert"><i className="fa-solid fa-triangle-exclamation" />{error}</div>}
            <button className="btn btn-grad btn-block" style={{ padding: '16px' }} onClick={submit} disabled={loading}>
              {loading ? <><i className="fa-solid fa-circle-notch spin" /> AUTHENTICATING…</> : <><i className="fa-solid fa-fingerprint" /> AUTHENTICATE</>}
            </button>
          </div>
          <p className="login-hint">USE <b>{C.EMAIL_DOMAIN}</b> TO SIGN IN</p>
        </div>

        <div className="warn"><i className="fa-solid fa-triangle-exclamation" />Unauthorized access is a criminal offense — all activity is monitored</div>

        <div className="dev">
          <div className="dev-by">{C.DEV.by}</div>
          <div className="dev-row">
            <i className="fa-brands fa-discord dc" />
            <span className="bar" />
            <span>Discord :</span>
            <span className="handle">{C.DEV.discord}</span>
          </div>
          {window.DB.mode === 'local' && <div className="demo-note">Local demo mode — connect Firebase in assets/js/config.js</div>}
        </div>
      </div>
    </div>
  );
};

/* ---------------- Portal shell ---------------- */
const NAV = [
  { k: 'dashboard', icon: 'fa-gauge-high', label: 'Dashboard' },
  { k: 'cases', icon: 'fa-folder-open', label: 'Cases' },
  { k: 'wanted', icon: 'fa-crosshairs', label: 'Wanted' },
  { k: 'civilians', icon: 'fa-fingerprint', label: 'Civilians' },
  { k: 'ops', icon: 'fa-map-location-dot', label: 'Ops' },
  { k: 'staff', icon: 'fa-user-gear', label: 'Staff' },
  { k: 'crypto', icon: 'fa-lock', label: 'Crypto' },
  { k: 'logs', icon: 'fa-terminal', label: 'Logs' }
];
const FORM_COL = { case: 'cases', wanted: 'wanted', civilian: 'civilians', staff: 'users' };

const Portal = ({ user, onLogout }) => {
  const ui = useContext(UI);
  const DB = window.DB;
  const cases = useCol('cases');
  const wanted = useCol('wanted');
  const civilians = useCol('civilians');
  const duty = useCol('duty');
  const markers = useCol('markers');
  const users = useCol('users');
  const [tab, setTab] = useState('dashboard');
  const [modal, setModal] = useState(null); // { kind, item }
  const [logs, setLogs] = useState([]);
  const clock = useClock();
  const isCmd = user.access === 'command' || C.COMMAND_RANKS.includes(user.rank);

  const log = useCallback((action, who) => {
    setLogs((p) => [{ time: timeNow(), user: who || user.name, action }, ...p].slice(0, 100));
  }, [user.name]);
  useEffect(() => { log(`Authenticated — ${user.rank} access granted`, 'SYSTEM'); }, []);

  const openModal = (kind, item = null) => setModal({ kind, item });
  const closeModal = () => setModal(null);

  const remove = async (key, id, label) => {
    const ok = await ui.confirm(`Permanently delete ${label || 'this record'}?`);
    if (!ok) return;
    try { await DB.remove(col(key), id); ui.toast('Record deleted', 'ok'); log(`Deleted — ${key}`); }
    catch (e) { ui.toast(e.message, 'error'); }
  };

  const save = async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    const { kind, item } = modal;
    const key = FORM_COL[kind];
    try {
      if (kind === 'staff') {
        const id = (item?.id || d.id || '').trim().toLowerCase();
        if (!id.endsWith(C.EMAIL_DOMAIN)) { ui.toast(`Email must end with ${C.EMAIL_DOMAIN}`, 'error'); return; }
        if (!item && (users.find((u) => (u.id || '').toLowerCase() === id) || id === C.ADMIN.email.toLowerCase())) {
          ui.toast('This email is already enrolled', 'error'); return;
        }
        const pw = d.password; delete d.password;
        const rec = { ...d, id };
        if (pw) rec.passHash = await hashPw(pw);
        if (item) {
          await DB.update(col(key), item.id, { ...rec, lastModifiedBy: user.name });
          log('Agent profile updated');
        } else {
          await DB.set(col(key), id, { ...rec, author: user.name, authorRank: user.rank, createdAt: DB.now() });
          log(`Agent enrolled — ${d.name}`);
        }
      } else {
        if (kind === 'civilian' && !item) {
          const dup = civilians.find((c) => c.sonyId === d.sonyId);
          if (dup) { ui.toast(`ID ${d.sonyId} is already registered to ${dup.name}`, 'error'); return; }
        }
        if (item) {
          await DB.update(col(key), item.id, { ...d, lastModifiedBy: user.name });
          log(`Record updated — ${key}`);
        } else {
          await DB.add(col(key), { ...d, author: user.name, authorRank: user.rank, createdAt: DB.now() });
          log(`New record — ${key}`);
        }
      }
      ui.toast('Record saved', 'ok');
      closeModal();
    } catch (err) { console.error(err); ui.toast('Error: ' + err.message, 'error'); }
  };

  const current = NAV.find((n) => n.k === tab);
  const pageProps = { user, isCmd, openModal, remove, log };

  return (
    <div className="app fade-in">
      <aside className="rail">
        <div className="rail-logo">
          <Logo size={46} />
          <div className="rail-brand"><b>{C.BRAND}</b><small>{C.BRAND_FULL.split(' ').slice(0, 2).join(' ')}</small></div>
        </div>
        <nav className="rail-nav">
          {NAV.map((n) => (
            <button key={n.k} className={`nav-item ${tab === n.k ? 'active' : ''}`} onClick={() => setTab(n.k)}>
              <i className={`fa-solid ${n.icon}`} /><span>{n.label}</span>
            </button>
          ))}
        </nav>
        <div className="rail-bottom">
          <button className="rail-btn" onClick={() => openModal('profile')} title="Profile">
            <i className="fa-solid fa-user-shield" /><span className="nm">{user.name}</span>
          </button>
          <button className="rail-btn out" onClick={onLogout} title="Sign Out">
            <i className="fa-solid fa-right-from-bracket" /><span className="nm">Sign Out</span>
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="header">
          <div className="h-title"><i className={`fa-solid ${current.icon}`} /><h2>{current.label}</h2></div>
          <div className="h-right">
            {DB.mode === 'local' && <span className="chip-demo">DEMO</span>}
            <span className="online"><span className="dot" />ONLINE</span>
            <span>{clock}</span>
          </div>
        </header>
        <main className="content">
          <div className="page fade-up" key={tab}>
            {tab === 'dashboard' && <DashboardPage {...pageProps} cases={cases} wanted={wanted} civilians={civilians} users={users} />}
            {tab === 'cases' && <CasesPage {...pageProps} cases={cases} />}
            {tab === 'wanted' && <WantedPage {...pageProps} wanted={wanted} />}
            {tab === 'civilians' && <CiviliansPage {...pageProps} civilians={civilians} />}
            {tab === 'ops' && <OpsPage {...pageProps} duty={duty} markers={markers} />}
            {tab === 'staff' && <StaffPage {...pageProps} users={users} />}
            {tab === 'crypto' && <CryptoPage />}
            {tab === 'logs' && <LogsPage logs={logs} />}
          </div>
        </main>
      </div>

      {modal && <RecordModal modal={modal} onClose={closeModal} onSave={save} user={user} onLogout={onLogout} />}
    </div>
  );
};

/* ---------------- Dashboard ---------------- */
const DashboardPage = ({ cases, wanted, civilians, users, openModal }) => {
  const open = cases.filter((c) => c.status === 'Open').length;
  const closed = cases.filter((c) => c.status === 'Closed').length;
  const total = cases.length;
  const pct = total ? Math.round((closed / total) * 100) : 0;
  const stats = [
    { label: 'Open Cases', val: open, icon: 'fa-folder-open', c: 'var(--red)' },
    { label: 'Wanted', val: wanted.length, icon: 'fa-crosshairs', c: 'var(--cyan)' },
    { label: 'Civilians', val: civilians.length, icon: 'fa-fingerprint', c: 'var(--amber)' },
    { label: 'Agents', val: users.length, icon: 'fa-user-gear', c: 'var(--violet)' }
  ];
  return (
    <>
      <PageHead title="Dashboard" />
      <div className="stat-grid">
        {stats.map((s) => (
          <div key={s.label} className="card accent stat" style={{ '--c': s.c }}>
            <div className="val">{s.val}</div>
            <div className="lbl">{s.label}</div>
            <i className={`fa-solid ${s.icon} ghost`} />
          </div>
        ))}
      </div>
      <div className="card pad">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <span className="mono" style={{ fontSize: '.78rem', letterSpacing: '.22em', color: 'var(--muted)' }}>CASE RESOLUTION RATE</span>
          <span className="mono" style={{ color: 'var(--cyan)', fontWeight: 700 }}>{pct}%</span>
        </div>
        <div className="progress"><div style={{ width: `${pct}%` }} /></div>
        <p style={{ fontSize: '.8rem', color: 'var(--dim)', marginTop: 12 }}>{closed} closed · {open} active · {total} total</p>
      </div>
      <div className="page-head">
        <h1 style={{ '--c': 'var(--muted)', fontSize: '1.15rem' }}>Recent Cases</h1>
        <button className="btn btn-outline btn-sm" onClick={() => openModal('case')}><i className="fa-solid fa-plus" /> New Case</button>
      </div>
      <div className="card row-sep">
        {total === 0 ? <Empty icon="fa-folder-open" text="No cases on record" /> :
          sortNew(cases).slice(0, 4).map((c) => (
            <div key={c.id} className="item" style={{ gap: 8 }}>
              <div className="item-top">
                <h3 dir="auto">{c.title}</h3>
                <span className={`badge ${c.status === 'Open' ? 'b-open' : 'b-closed'}`}>{c.status}</span>
              </div>
              <p className="body clamp" dir="auto">{c.details}</p>
            </div>
          ))}
      </div>
    </>
  );
};

/* ---------------- Cases ---------------- */
const CasesPage = ({ cases, isCmd, openModal, remove }) => {
  const [f, setF] = useState('All');
  const [q, setQ] = useState('');
  const list = sortNew(cases).filter((c) =>
    (f === 'All' || c.status === f) &&
    (!q || `${c.title} ${c.details} ${c.suspects}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <>
      <PageHead title="Case Archive" action={<button className="btn btn-outline btn-sm" onClick={() => openModal('case')}><i className="fa-solid fa-plus" /> New Case</button>} />
      <div className="search"><i className="fa-solid fa-magnifying-glass" /><input className="input" placeholder="Search cases…" value={q} onChange={(e) => setQ(e.target.value)} dir="auto" /></div>
      <div className="chips">
        {['All', 'Open', 'Closed'].map((s) => <button key={s} className={`chip ${f === s ? 'on' : ''}`} onClick={() => setF(s)}>{s.toUpperCase()}</button>)}
      </div>
      <div className="card row-sep">
        {list.length === 0 ? <Empty icon="fa-folder-open" text="No cases on record" /> :
          list.map((c) => (
            <div key={c.id} className="item">
              <div className="item-top">
                <h3 dir="auto">{c.title}</h3>
                <span className={`badge ${c.status === 'Open' ? 'b-open' : 'b-closed'}`}>{c.status}</span>
              </div>
              <p className="body" dir="auto">{c.details}</p>
              <div className="item-foot">
                <span className="badge b-violet" dir="auto">Suspects: {c.suspects}</span>
                <div>
                  <button className="icon-btn" onClick={() => openModal('case', c)}><i className="fa-solid fa-pen" /></button>
                  {isCmd && <button className="icon-btn red" onClick={() => remove('cases', c.id, 'this case')}><i className="fa-solid fa-trash" /></button>}
                </div>
              </div>
            </div>
          ))}
      </div>
    </>
  );
};

/* ---------------- Wanted ---------------- */
const THREAT = {
  'Extremely Dangerous': ['b-open', 'EXTREMELY DANGEROUS'],
  Moderate: ['b-amber', 'MODERATE THREAT'],
  Low: ['b-closed', 'LOW THREAT']
};
const WantedPage = ({ wanted, isCmd, openModal, remove }) => (
  <>
    <PageHead title="Wanted Targets" color="var(--red)"
      action={<button className="btn btn-danger btn-sm" onClick={() => openModal('wanted')}><i className="fa-solid fa-plus" /> Add Target</button>} />
    {wanted.length === 0 ? <div className="card"><Empty icon="fa-crosshairs" text="No targets on file" /></div> : (
      <div className="wanted-grid">
        {sortNew(wanted).map((w) => {
          const t = THREAT[w.dangerLevel] || THREAT['Extremely Dangerous'];
          return (
            <div key={w.id} className="card">
              <Mugshot src={w.image} />
              <div className="item" style={{ gap: 10 }}>
                <div className="item-top"><h3 dir="auto">{w.name}</h3><span className="badge b-open">WANTED</span></div>
                <p className="mono" dir="auto" style={{ color: '#ff8f87', fontSize: '.78rem', letterSpacing: '.1em' }}>{w.charge}</p>
                <span className={`badge ${t[0]}`} style={{ alignSelf: 'flex-start' }}>{t[1]}</span>
                <div className="item-foot">
                  <span style={{ fontSize: '.78rem', color: 'var(--dim)' }}>By: {w.author}</span>
                  <div>
                    <button className="icon-btn" onClick={() => openModal('wanted', w)}><i className="fa-solid fa-pen" /></button>
                    {isCmd && <button className="icon-btn red" onClick={() => remove('wanted', w.id, w.name)}><i className="fa-solid fa-trash" /></button>}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    )}
  </>
);

/* ---------------- Civilians ---------------- */
const CiviliansPage = ({ civilians, isCmd, openModal, remove }) => {
  const [q, setQ] = useState('');
  const list = civilians.filter((c) => !q || (c.name || '').toLowerCase().includes(q.toLowerCase()) || (c.sonyId || '').includes(q));
  return (
    <>
      <PageHead title="Civilian Database" action={<button className="btn btn-outline btn-sm" onClick={() => openModal('civilian')}><i className="fa-solid fa-plus" /> Register</button>} />
      <div className="search"><i className="fa-solid fa-magnifying-glass" /><input className="input" placeholder="Search by name or ID…" value={q} onChange={(e) => setQ(e.target.value)} dir="auto" /></div>
      <div className="card row-sep">
        {list.length === 0 ? <Empty icon="fa-fingerprint" text="No civilians registered" /> :
          list.map((c) => (
            <div key={c.id} className="person">
              <Avatar name={c.name} />
              <div className="info">
                <div className="nm" dir="auto">{c.name}</div>
                <div className="sb dim">ID: {c.sonyId}</div>
              </div>
              <button className="icon-btn" onClick={() => openModal('civilian', c)}><i className="fa-solid fa-pen" /></button>
              {isCmd && <button className="icon-btn red" onClick={() => remove('civilians', c.id, c.name)}><i className="fa-solid fa-trash" /></button>}
            </div>
          ))}
      </div>
    </>
  );
};

/* ---------------- Ops ---------------- */
const MapView = ({ markers, deploy, onPick }) => {
  const [idx, setIdx] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const click = (e) => {
    if (!deploy) return;
    const r = e.currentTarget.getBoundingClientRect();
    onPick(((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100);
  };
  if (failed) return <Empty icon="fa-map" text="Map unavailable — add assets/img/map.jpg" />;
  return (
    <div className={`map-wrap ${deploy ? 'deploy' : ''}`} onClick={click}>
      {!loaded && <div className="empty"><i className="fa-solid fa-circle-notch spin" /></div>}
      <img src={C.MAP_URLS[idx]} alt="Tactical map" style={{ display: loaded ? 'block' : 'none' }}
        onLoad={() => setLoaded(true)}
        onError={() => (idx + 1 < C.MAP_URLS.length ? setIdx(idx + 1) : setFailed(true))} />
      {loaded && markers.map((m) => (
        <div key={m.id} className="marker" style={{ left: `${m.x}%`, top: `${m.y}%` }}>
          <i className="fa-solid fa-location-dot" /><div>{m.name}</div>
        </div>
      ))}
    </div>
  );
};

const OpsPage = ({ user, duty, markers, log }) => {
  const DB = window.DB;
  const ui = useContext(UI);
  const [unit, setUnit] = useState(null);
  const me = duty.find((u) => u.id === user.id || u.name === user.name);
  const toggle = async () => {
    try {
      if (!me) {
        await DB.set(col('duty'), user.id, { name: user.name, rank: user.rank, startTime: new Date().toISOString() });
        log('Joined field operations');
      } else {
        await DB.remove(col('duty'), me.id);
        const mk = markers.find((m) => m.id === me.id || m.name === me.name);
        if (mk) await DB.remove(col('markers'), mk.id);
        log('Left field operations');
      }
    } catch (e) { ui.toast(e.message, 'error'); }
  };
  const pick = async (x, y) => {
    try {
      await DB.set(col('markers'), unit.id, { name: unit.name, x, y });
      log(`Deployed unit — ${unit.name}`);
      setUnit(null);
    } catch (e) { ui.toast(e.message, 'error'); }
  };
  return (
    <>
      <PageHead title="Ops Center" />
      <button className={`btn btn-block ${me ? 'btn-danger' : 'btn-outline'}`} style={{ padding: 16 }} onClick={toggle}>
        <i className={`fa-solid ${me ? 'fa-circle-stop' : 'fa-satellite-dish'}`} />
        {me ? 'LEAVE FIELD OPERATIONS' : 'JOIN FIELD OPERATIONS'}
      </button>
      {unit && (
        <div className="notice">
          <div>
            <div className="mono" style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--amber)' }}><i className="fa-solid fa-crosshairs" /> DEPLOY MODE — TAP ON MAP</div>
            <div style={{ fontSize: '.8rem', color: 'var(--muted)', marginTop: 3 }}>Unit: {unit.name}</div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => setUnit(null)}>Cancel</button>
        </div>
      )}
      <div className="card">
        <div className="card-title"><span>Tactical Map</span><span className="mono" style={{ fontSize: '.7rem', color: 'var(--muted)', letterSpacing: '.12em', display: 'flex', alignItems: 'center', gap: 8 }}><span className="dot" />LIVE</span></div>
        <MapView markers={markers} deploy={!!unit} onPick={pick} />
      </div>
      <div className="card">
        <div className="card-title"><span>Active Units ({duty.length})</span></div>
        {duty.length === 0 ? <Empty icon="fa-user-slash" text="No units active" /> :
          duty.map((u) => (
            <div key={u.id} className="unit">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <Avatar name={u.name} icon="fa-user-shield" size={40} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }} dir="auto">{u.name}</div>
                  <div className="mono" style={{ fontSize: '.68rem', color: 'var(--dim)', letterSpacing: '.08em' }}>{u.rank}</div>
                </div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => setUnit(u)}><i className="fa-solid fa-location-crosshairs" /> DEPLOY</button>
            </div>
          ))}
      </div>
    </>
  );
};

/* ---------------- Staff ---------------- */
const StaffPage = ({ users, isCmd, openModal, remove }) => (
  <>
    <PageHead title="Personnel" />
    {!isCmd ? (
      <div className="card"><Empty icon="fa-lock" text="Restricted — command clearance required" /></div>
    ) : (
      <>
        <div className="card accent">
          <div className="person">
            <div className="avatar" style={{ width: 52, height: 52 }}><i className="fa-solid fa-shield-halved" /></div>
            <div className="info">
              <div className="nm">{C.ADMIN.name}</div>
              <div className="sb">{C.ADMIN.rank}</div>
            </div>
            <span className="badge b-cyan">COMMAND</span>
          </div>
        </div>
        <div className="card row-sep">
          {users.length === 0 ? <Empty icon="fa-users" text="No agents enrolled" /> :
            users.map((u) => (
              <div key={u.id} className="person">
                <Avatar name={u.name} photo={u.photo} />
                <div className="info">
                  <div className="nm" dir="auto">{u.name}</div>
                  <div className="sb dim">{u.rank}</div>
                </div>
                {u.access === 'command' && <span className="badge b-cyan">CMD</span>}
                <button className="icon-btn" onClick={() => openModal('staff', u)}><i className="fa-solid fa-pen" /></button>
                <button className="icon-btn red" onClick={() => remove('users', u.id, u.name)}><i className="fa-solid fa-user-slash" /></button>
              </div>
            ))}
        </div>
        <button className="btn btn-outline btn-block" style={{ padding: 16, borderColor: 'rgba(103,232,249,.5)', color: 'var(--cyan)' }} onClick={() => openModal('staff')}>
          <i className="fa-solid fa-user-plus" /> Enroll New Agent
        </button>
      </>
    )}
  </>
);

/* ---------------- Crypto ---------------- */
const CMAP = { 0: 'X', 1: 'V', 2: 'I', 3: 'A', 4: 'B', 5: 'S', 6: 'T', 7: 'Z', 8: 'K', 9: 'P', a: 'Q', b: 'R', c: 'W', d: 'Y', e: 'M', f: 'N' };
const RMAP = Object.fromEntries(Object.entries(CMAP).map(([k, v]) => [v, k]));
const encode = (t) => {
  if (!t) return '';
  const hex = Array.from(new TextEncoder().encode(t)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return hex.split('').map((c) => CMAP[c]).join('·');
};
const decode = (c) => {
  const hex = c.replace(/\s/g, '').split('·').map((ch) => RMAP[ch.toUpperCase()] || ch.toLowerCase()).join('');
  if (!hex || hex.length % 2 || /[^0-9a-f]/.test(hex)) throw new Error('bad cipher');
  return new TextDecoder().decode(new Uint8Array(hex.match(/.{2}/g).map((b) => parseInt(b, 16))));
};
const CryptoPage = () => {
  const ui = useContext(UI);
  const [raw, setRaw] = useState('');
  const [di, setDi] = useState('');
  const [dec, setDec] = useState('');
  const cipher = encode(raw);
  const run = () => { try { setDec(decode(di)); } catch (e) { setDec(''); ui.toast('Check cipher integrity', 'error'); } };
  const copy = () => { try { navigator.clipboard.writeText(cipher); ui.toast('Cipher copied', 'ok'); } catch (e) {} };
  return (
    <>
      <PageHead title="Enigma Crypto Terminal" />
      <div className="card accent pad">
        <div className="card-title" style={{ padding: '0 0 14px', border: 'none' }}>Encryption Unit</div>
        <Field label="Plaintext Message">
          <textarea className="input" style={{ height: 96 }} dir="auto" placeholder="Type your message here…" value={raw} onChange={(e) => setRaw(e.target.value)} />
        </Field>
        {cipher && (
          <div className="out-box">
            <span className="label">Generated Cipher</span>
            <p className="mono" style={{ color: 'var(--green)', fontSize: '.82rem' }}>{cipher}</p>
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 8, color: 'var(--cyan)' }} onClick={copy}><i className="fa-solid fa-copy" /> Copy</button>
          </div>
        )}
      </div>
      <div className="card accent pad" style={{ '--c': 'var(--violet)' }}>
        <div className="card-title" style={{ padding: '0 0 14px', border: 'none' }}>Decryption Unit</div>
        <Field label="Cipher Text">
          <textarea className="input mono" style={{ height: 96 }} placeholder="Paste cipher here…" value={di} onChange={(e) => setDi(e.target.value)} />
        </Field>
        <button className="btn btn-outline btn-block" style={{ marginTop: 14 }} onClick={run}><i className="fa-solid fa-unlock" /> Decode Signal</button>
        {dec && (
          <div className="out-box" style={{ borderStyle: 'solid' }}>
            <span className="label">Decoded Message</span>
            <p dir="auto" style={{ lineHeight: 1.7 }}>{dec}</p>
          </div>
        )}
      </div>
    </>
  );
};

/* ---------------- Logs ---------------- */
const LogsPage = ({ logs }) => (
  <>
    <PageHead title="Activity Log" color="var(--text)" />
    <div className="card">
      {logs.length === 0 ? <Empty icon="fa-terminal" text="No activity recorded" /> :
        logs.map((l, i) => (
          <div key={i} className="log"><span className="t">[{l.time}]</span> <b>{l.user}</b> — {l.action}</div>
        ))}
    </div>
  </>
);

/* ---------------- Modal forms ---------------- */
const TITLES = { case: 'Case File', wanted: 'Wanted Target', civilian: 'Civilian Record', staff: 'Agent Profile', profile: 'My Profile' };
const RecordModal = ({ modal, onClose, onSave, user, onLogout }) => {
  const { kind, item: ei } = modal;
  const bd = (e) => e.target === e.currentTarget && onClose();

  if (kind === 'profile') {
    return (
      <div className="modal-backdrop" onClick={bd}>
        <div className="modal">
          <div className="modal-head"><h3>{TITLES.profile}</h3><button className="icon-btn" onClick={onClose}><i className="fa-solid fa-xmark" /></button></div>
          <div className="modal-body" style={{ alignItems: 'center', textAlign: 'center' }}>
            <Avatar name={user.name} photo={user.photo} size={84} />
            <div>
              <div style={{ fontSize: '1.2rem', fontWeight: 600 }} dir="auto">{user.name}</div>
              <div className="mono" style={{ color: 'var(--cyan)', fontSize: '.78rem', letterSpacing: '.12em', marginTop: 6 }}>{user.rank}</div>
              <div className="mono" style={{ color: 'var(--dim)', fontSize: '.74rem', marginTop: 8 }}>{user.id}</div>
            </div>
            <span className="badge b-cyan">{user.access === 'command' ? 'COMMAND ACCESS' : 'FIELD AGENT'}</span>
          </div>
          <div className="modal-foot">
            <button className="btn btn-danger" onClick={onLogout}><i className="fa-solid fa-right-from-bracket" /> Sign Out</button>
            <button className="btn btn-outline" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={bd}>
      <div className="modal">
        <div className="modal-head">
          <h3>{ei ? 'Edit' : 'New'} {TITLES[kind]}</h3>
          <button className="icon-btn" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>
        <form onSubmit={onSave}>
          <div className="modal-body">
            {kind === 'case' && <>
              <Field label="Case Title"><input name="title" className="input" dir="auto" placeholder="Case codename…" defaultValue={ei?.title} required /></Field>
              <Field label="Incident Report"><textarea name="details" className="input" dir="auto" style={{ height: 130 }} placeholder="Detailed incident description…" defaultValue={ei?.details} required /></Field>
              <Field label="Suspects"><input name="suspects" className="input" dir="auto" placeholder="Known suspects…" defaultValue={ei?.suspects} required /></Field>
              <Field label="Status">
                <select name="status" className="input" defaultValue={ei?.status || 'Open'}>
                  <option value="Open">OPEN — Under Investigation</option>
                  <option value="Closed">CLOSED — Case Resolved</option>
                </select>
              </Field>
            </>}
            {kind === 'wanted' && <>
              <Field label="Full Name"><input name="name" className="input" dir="auto" placeholder="Subject full name…" defaultValue={ei?.name} required /></Field>
              <Field label="Primary Charge"><input name="charge" className="input" dir="auto" placeholder="e.g. Armed Robbery, Homicide…" defaultValue={ei?.charge} required /></Field>
              <Field label="Photo URL"><input name="image" className="input" placeholder="Direct image URL…" defaultValue={ei?.image} /></Field>
              <Field label="Threat Level">
                <select name="dangerLevel" className="input" defaultValue={ei?.dangerLevel || 'Extremely Dangerous'}>
                  <option value="Extremely Dangerous">EXTREMELY DANGEROUS</option>
                  <option value="Moderate">MODERATE THREAT</option>
                  <option value="Low">LOW THREAT</option>
                </select>
              </Field>
            </>}
            {kind === 'civilian' && <>
              <Field label="Full Name"><input name="name" className="input" dir="auto" placeholder="Civilian full name…" defaultValue={ei?.name} required /></Field>
              <Field label="Citizen ID"><input name="sonyId" className="input" placeholder="Citizen ID number…" defaultValue={ei?.sonyId} required disabled={!!ei} /></Field>
            </>}
            {kind === 'staff' && <>
              <Field label="Email (Login ID)"><input name="id" type="email" className="input" autoCapitalize="none" placeholder={`agent${C.EMAIL_DOMAIN}`} defaultValue={ei?.id} required disabled={!!ei} /></Field>
              <Field label="Full Name"><input name="name" className="input" dir="auto" placeholder="Agent full name…" defaultValue={ei?.name} required /></Field>
              <Field label="Rank">
                <select name="rank" className="input" defaultValue={ei?.rank || C.RANKS[C.RANKS.length - 1]}>
                  {C.RANKS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="Clearance Level">
                <select name="access" className="input" defaultValue={ei?.access || 'field'}>
                  <option value="field">FIELD AGENT</option>
                  <option value="command">COMMAND ACCESS</option>
                </select>
              </Field>
              <Field label="Photo URL (optional)"><input name="photo" className="input" placeholder="Direct image URL…" defaultValue={ei?.photo} /></Field>
              <Field label="Password"><input name="password" type="password" className="input" autoComplete="new-password" placeholder={ei ? 'Leave blank to keep current…' : 'Assign secure password…'} required={!ei} /></Field>
            </>}
          </div>
          <div className="modal-foot">
            <button type="submit" className="btn btn-primary"><i className="fa-solid fa-floppy-disk" /> Save Record</button>
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
