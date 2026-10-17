/* ==========================================================
   FTD Portal — app.jsx
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
    <span className="logo-ring" style={{ width: size, height: size, ...style }}>
      <img src={src} alt={C.BRAND}
        onError={() => src !== C.LOGO_FALLBACK && setSrc(C.LOGO_FALLBACK)} />
    </span>
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

/* ---------------- photo helpers ---------------- */
const fileToDataURL = (file, max = 360) => new Promise((resolve, reject) => {
  const fr = new FileReader();
  fr.onerror = () => reject(new Error('Could not read file'));
  fr.onload = () => {
    const im = new Image();
    im.onerror = () => reject(new Error('Not a valid image'));
    im.onload = () => {
      const k = Math.min(1, max / Math.max(im.width, im.height));
      const cv = document.createElement('canvas');
      cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k);
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#0b1324'; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.drawImage(im, 0, 0, cv.width, cv.height);
      resolve(cv.toDataURL('image/jpeg', 0.8));
    };
    im.src = fr.result;
  };
  fr.readAsDataURL(file);
});
const PhotoField = ({ label, name, defaultValue = '' }) => {
  const [val, setVal] = useState(defaultValue || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [bad, setBad] = useState(false);
  const pick = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    setBusy(true); setErr('');
    try { setVal(await fileToDataURL(f)); setBad(false); }
    catch (x) { setErr(x.message + ' — paste an image link instead'); }
    setBusy(false);
  };
  const isData = val.startsWith('data:');
  return (
    <div className="field">
      <span className="label">{label}</span>
      <div className="photo-field">
        <div className="photo-prev">
          {val && !bad ? <img src={val} alt="" onError={() => setBad(true)} /> : <i className="fa-solid fa-image" />}
        </div>
        <div className="photo-ctrl">
          <div style={{ display: 'flex', gap: 6 }}>
            <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
              {busy ? <i className="fa-solid fa-circle-notch spin" /> : <i className="fa-solid fa-images" />} Photo Album
              <input type="file" accept="image/*" hidden onChange={pick} />
            </label>
            {val && <button type="button" className="btn btn-outline btn-sm" onClick={() => { setVal(''); setBad(false); }}><i className="fa-solid fa-xmark" /></button>}
          </div>
          <input className="input" placeholder="…or paste image link" value={isData ? '' : val}
            onChange={(e) => { setVal(e.target.value.trim()); setBad(false); }} />
        </div>
      </div>
      <input type="hidden" name={name} value={val} />
      {err && <div className="mono" style={{ color: '#ff8f87', fontSize: '.62rem', marginTop: 6 }}>{err}</div>}
    </div>
  );
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
    let session = null;
    if (em === C.ADMIN.email.toLowerCase() && pw === C.ADMIN.password) {
      session = { id: em, name: C.ADMIN.name, rank: C.ADMIN.rank, access: 'command', photo: '' };
    } else {
      try {
        let rec = await window.DB.get(col('users'), em);
        if (!rec) {
          // دعم الحسابات القديمة المخزنة بحروف كبيرة
          const all = await window.DB.list(col('users'));
          rec = all.find((u) => (u.id || '').trim().toLowerCase() === em) || null;
        }
        if (rec) {
          const h = await hashPw(pw);
          const ok = rec.passHash ? (rec.passHash === h || rec.passHash === 'plain:' + pw) : !!rec.password && rec.password === pw;
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
          <div className="seal-wrap"><Logo size={78} /></div>
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
            <button className="btn btn-grad btn-block" style={{ padding: '12px' }} onClick={submit} disabled={loading}>
              {loading ? <><i className="fa-solid fa-circle-notch spin" /> AUTHENTICATING…</> : <><i className="fa-solid fa-fingerprint" /> AUTHENTICATE</>}
            </button>
          </div>
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
  { k: 'network', icon: 'fa-diagram-project', label: 'Network' },
  { k: 'ops', icon: 'fa-map-location-dot', label: 'Ops' },
  { k: 'staff', icon: 'fa-user-gear', label: 'Staff' },
  { k: 'crypto', icon: 'fa-lock', label: 'Crypto' },
  { k: 'logs', icon: 'fa-terminal', label: 'Logs' }
];
const FORM_COL = { case: 'cases', wanted: 'wanted', civilian: 'civilians', staff: 'users', node: 'nodes', link: 'links' };

const Portal = ({ user, onLogout }) => {
  const ui = useContext(UI);
  const DB = window.DB;
  const cases = useCol('cases');
  const wanted = useCol('wanted');
  const civilians = useCol('civilians');
  const duty = useCol('duty');
  const markers = useCol('markers');
  const nodes = useCol('nodes');
  const links = useCol('links');
  const users = useCol('users');
  const [tab, setTab] = useState('dashboard');
  const [modal, setModal] = useState(null); // { kind, item }
  const logs = useCol('logs');
  const clock = useClock();
  const isCmd = user.access === 'command' || C.COMMAND_RANKS.includes(user.rank);

  const log = useCallback((action, who) => {
    window.DB.add(col('logs'), { user: who || user.name, action, createdAt: window.DB.now() }).catch(() => {});
  }, [user.name]);
  useEffect(() => { log(`Signed in — ${user.rank}`); }, []);

  const openModal = (kind, item = null, pre = null) => setModal({ kind, item, pre });
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
          <Logo size={38} />
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
            <span className="online"><span className="dot" />ONLINE</span>
            <span>{clock}</span>
          </div>
        </header>
        <main className="content">
          {DB.mode === 'local' && <div className="notice" style={{ margin: '0 0 12px' }}><div className="mono" style={{ fontSize: '.68rem', color: 'var(--amber)', lineHeight: 1.6 }}><i className="fa-solid fa-triangle-exclamation" /> DATA IS STORED ON THIS DEVICE ONLY — other agents cannot see it. Deploy on Netlify (functions enabled) or add Firebase keys in config.js.</div></div>}
          <div className="page fade-up" key={tab}>
            {tab === 'dashboard' && <DashboardPage {...pageProps} cases={cases} wanted={wanted} civilians={civilians} users={users} />}
            {tab === 'cases' && <CasesPage {...pageProps} cases={cases} />}
            {tab === 'wanted' && <WantedPage {...pageProps} wanted={wanted} />}
            {tab === 'civilians' && <CiviliansPage {...pageProps} civilians={civilians} />}
            {tab === 'network' && <NetworkPage {...pageProps} nodes={nodes} links={links} />}
            {tab === 'ops' && <OpsPage {...pageProps} duty={duty} markers={markers} />}
            {tab === 'staff' && <StaffPage {...pageProps} users={users} />}
            {tab === 'crypto' && <CryptoPage />}
            {tab === 'logs' && <LogsPage logs={logs} />}
          </div>
        </main>
      </div>

      {modal && <RecordModal nodes={nodes} modal={modal} onClose={closeModal} onSave={save} user={user} onLogout={onLogout} />}
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
          <span className="mono" style={{ fontSize: '.66rem', letterSpacing: '.18em', color: 'var(--muted)' }}>CASE RESOLUTION RATE</span>
          <span className="mono" style={{ color: 'var(--cyan)', fontWeight: 700 }}>{pct}%</span>
        </div>
        <div className="progress"><div style={{ width: `${pct}%` }} /></div>
        <p style={{ fontSize: '.8rem', color: 'var(--dim)', marginTop: 12 }}>{closed} closed · {open} active · {total} total</p>
      </div>
      <div className="page-head">
        <h1 style={{ '--c': 'var(--muted)', fontSize: '.9rem' }}>Recent Cases</h1>
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


/* ---------------- Network (Kumu-style) ---------------- */
const NODE_TYPES = {
  Person: '#f2c14e', Group: '#ef5a5a', Organization: '#4f7cff', Location: '#4ade80', Asset: '#b58cff'
};
const NR = 24;
const NetworkPage = ({ nodes, links, isCmd, openModal, remove }) => {
  const ui = useContext(UI);
  const wrap = useRef(null);
  const svgRef = useRef(null);
  const pos = useRef({});           // id -> {x,y,vx,vy,fixed}
  const alpha = useRef(1);
  const raf = useRef(0);
  const [, setTick] = useState(0);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [size, setSize] = useState({ w: 360, h: 420 });
  const [sel, setSel] = useState(null);
  const [full, setFull] = useState(false);
  const autoFit = useRef(true);
  const ptrs = useRef(new Map());
  const pinch = useRef(null);
  const [q, setQ] = useState('');
  const [types, setTypes] = useState([]);
  const drag = useRef(null);

  const visible = useMemo(() => {
    return nodes.filter((n) => (!types.length || types.includes(n.type || 'Person')));
  }, [nodes, types, q]);
  const ids = useMemo(() => new Set(visible.map((n) => n.id)), [visible]);
  const edges = useMemo(() => links.filter((l) => ids.has(l.from) && ids.has(l.to)), [links, ids]);
  const match = (n) => { const ql = q.trim().toLowerCase(); return !ql || (n.name || '').toLowerCase().includes(ql); };

  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [full]);

  /* keep positions for existing nodes, seed new ones on a circle */
  useEffect(() => {
    const P = pos.current;
    visible.forEach((n, i) => {
      if (!P[n.id]) {
        const a = (i / Math.max(visible.length, 1)) * Math.PI * 2;
        P[n.id] = { x: Math.cos(a) * 140 + (Math.random() - .5) * 30, y: Math.sin(a) * 140 + (Math.random() - .5) * 30, vx: 0, vy: 0 };
      }
    });
    alpha.current = 1;
    cancelAnimationFrame(raf.current);
    const step = () => {
      const a = alpha.current;
      const list = visible.map((n) => P[n.id]);
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        for (let j = i + 1; j < list.length; j++) {
          const o = list[j];
          let dx = p.x - o.x, dy = p.y - o.y; let d2 = dx * dx + dy * dy;
          if (d2 < 1) { dx = Math.random() - .5; dy = Math.random() - .5; d2 = 1; }
          const d = Math.sqrt(d2); const f = (5200 / d2) * a;
          dx = (dx / d) * f; dy = (dy / d) * f;
          p.vx += dx; p.vy += dy; o.vx -= dx; o.vy -= dy;
        }
        p.vx -= p.x * 0.012 * a; p.vy -= p.y * 0.012 * a;
      }
      edges.forEach((l) => {
        const s = P[l.from], t = P[l.to]; if (!s || !t) return;
        const dx = t.x - s.x, dy = t.y - s.y; const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const f = (d - 120) * 0.04 * a; const fx = (dx / d) * f, fy = (dy / d) * f;
        s.vx += fx; s.vy += fy; t.vx -= fx; t.vy -= fy;
      });
      list.forEach((p) => {
        if (p.fixed) { p.vx = p.vy = 0; return; }
        p.vx *= 0.82; p.vy *= 0.82; p.x += p.vx; p.y += p.vy;
      });
      alpha.current *= 0.985;
      setTick((t) => t + 1);
      if (alpha.current > 0.02 || drag.current) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [visible, edges]);

  const fit = () => {
    const pts = visible.map((n) => pos.current[n.id]).filter(Boolean);
    if (!pts.length || !size.w) return;
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const padX = 60, padY = 70;
    const k = Math.min(1.6, Math.max(0.2, Math.min(size.w / (maxX - minX + padX * 2), size.h / (maxY - minY + padY * 2))));
    setView({ k, x: -((minX + maxX) / 2) * k, y: -((minY + maxY) / 2) * k });
  };
  const fitRef = useRef(fit); fitRef.current = fit;
  useEffect(() => {
    autoFit.current = true;
    const ts = [500, 1300, 2600].map((ms) => setTimeout(() => autoFit.current && fitRef.current(), ms));
    return () => ts.forEach(clearTimeout);
  }, [visible.length, edges.length, full]);

  const reheat = () => {
    if (alpha.current < 0.05) { alpha.current = 0.6; setTick((t) => t + 1); }
    alpha.current = Math.max(alpha.current, 0.5);
  };

  const toWorld = (cx, cy) => {
    const r = svgRef.current.getBoundingClientRect();
    return { x: (cx - r.left - size.w / 2 - view.x) / view.k, y: (cy - r.top - size.h / 2 - view.y) / view.k };
  };
  const onDown = (e, id) => {
    e.stopPropagation(); e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { id, moved: false, sx: e.clientX, sy: e.clientY };
    pos.current[id].fixed = true;
    alpha.current = Math.max(alpha.current, 0.4);
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(function loop() { setTick((t) => t + 1); if (drag.current) raf.current = requestAnimationFrame(loop); });
  };
  const onBgDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    autoFit.current = false;
    if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      pinch.current = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, k0: view.k };
      drag.current = null; return;
    }
    drag.current = { pan: true, sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y, moved: false };
  };
  const onMove = (e) => {
    if (ptrs.current.has(e.pointerId)) ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      const k = Math.min(3, Math.max(0.2, pinch.current.k0 * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.d0)));
      setView((v) => ({ ...v, k })); return;
    }
    const d = drag.current; if (!d) return;
    if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 4) d.moved = true;
    if (d.pan) { setView((v) => ({ ...v, x: d.ox + e.clientX - d.sx, y: d.oy + e.clientY - d.sy })); return; }
    const w = toWorld(e.clientX, e.clientY);
    const p = pos.current[d.id]; p.x = w.x; p.y = w.y;
  };
  const onUp = (e) => {
    if (e && e.pointerId !== undefined) ptrs.current.delete(e.pointerId);
    if (ptrs.current.size < 2) pinch.current = null;
    const d = drag.current; drag.current = null;
    if (!d) return;
    if (d.pan) { if (!d.moved) setSel(null); return; }
    const p = pos.current[d.id]; if (p) p.fixed = false;
    if (!d.moved) setSel(d.id);
    reheat();
    raf.current = requestAnimationFrame(function again() { alpha.current *= 0.985; setTick((t) => t + 1); if (alpha.current > 0.02) raf.current = requestAnimationFrame(again); });
  };
  const zoom = (f) => { autoFit.current = false; setView((v) => ({ ...v, k: Math.min(3, Math.max(0.2, v.k * f)) })); };
  const onWheel = (e) => zoom(e.deltaY < 0 ? 1.1 : 0.9);
  useEffect(() => {
    const el = svgRef.current; if (!el) return;
    const h = (e) => { e.preventDefault(); };
    el.addEventListener('wheel', h, { passive: false });
    return () => el.removeEventListener('wheel', h);
  }, [full, nodes.length]);

  const selNode = nodes.find((n) => n.id === sel);
  const rels = selNode ? links.filter((l) => l.from === selNode.id || l.to === selNode.id) : [];
  const nameOf = (id) => (nodes.find((n) => n.id === id) || {}).name || '—';
  const toggleType = (t) => setTypes((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));
  const tf = `translate(${size.w / 2 + view.x},${size.h / 2 + view.y}) scale(${view.k})`;
  const P = pos.current;

  return (
    <>
      <PageHead title="Criminal Network" action={
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-outline btn-sm" onClick={() => openModal('link')} disabled={nodes.length < 2}><i className="fa-solid fa-link" /> Connect</button>
          <button className="btn btn-primary btn-sm" onClick={() => openModal('node')}><i className="fa-solid fa-plus" /> Node</button>
        </div>} />
      <div className="search"><i className="fa-solid fa-magnifying-glass" /><input className="input" placeholder="Find in network…" value={q} onChange={(e) => setQ(e.target.value)} dir="auto" /></div>
      <div className="chips">
        {Object.keys(NODE_TYPES).map((t) => (
          <button key={t} className={`chip ${types.includes(t) ? 'on' : ''}`} onClick={() => toggleType(t)}>
            <span className="tdot" style={{ background: NODE_TYPES[t] }} />{t.toUpperCase()}
          </button>
        ))}
      </div>
      {(() => { const cardEl = (
      <div className={`card net-card ${full ? 'net-full' : ''}`}>
        {full && (
          <div className="net-bar">
            <b>CRIMINAL NETWORK</b>
            <span style={{ flex: 1 }} />
            <button className="btn btn-outline btn-sm" onClick={() => openModal('link')} disabled={nodes.length < 2}><i className="fa-solid fa-link" /></button>
            <button className="btn btn-primary btn-sm" onClick={() => openModal('node')}><i className="fa-solid fa-plus" /></button>
            <button className="btn btn-danger btn-sm" onClick={() => setFull(false)}><i className="fa-solid fa-xmark" /></button>
          </div>
        )}
        <div className="net-wrap" ref={wrap}>
          {nodes.length === 0 && <Empty icon="fa-diagram-project" text="No nodes yet — add the first one" />}
          <svg ref={svgRef} className="net-svg" width={size.w} height={size.h} style={{ display: nodes.length ? 'block' : 'none' }}
            onPointerDown={onBgDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel}>
            <defs>
              <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill="#7d879c" />
              </marker>
              {visible.map((n) => (
                <clipPath id={`cp-${n.id}`} key={n.id}><circle r={NR - 2} /></clipPath>
              ))}
            </defs>
            <g transform={tf}>
              {edges.map((l) => {
                const s = P[l.from], t = P[l.to]; if (!s || !t) return null;
                const dx = t.x - s.x, dy = t.y - s.y; const d = Math.sqrt(dx * dx + dy * dy) || 1;
                const x2 = t.x - (dx / d) * (NR + 4), y2 = t.y - (dy / d) * (NR + 4);
                const hot = sel && (l.from === sel || l.to === sel);
                return (
                  <g key={l.id} opacity={sel && !hot ? 0.25 : 1}>
                    <line x1={s.x} y1={s.y} x2={x2} y2={y2} stroke={hot ? '#f2c14e' : '#566074'} strokeWidth={hot ? 2 : 1.3} markerEnd="url(#arr)" />
                    {l.label && <text x={(s.x + t.x) / 2} y={(s.y + t.y) / 2 - 4} textAnchor="middle" className="net-elabel" dir="auto">{l.label}</text>}
                  </g>
                );
              })}
              {visible.map((n) => {
                const p = P[n.id]; if (!p) return null;
                const c = NODE_TYPES[n.type] || NODE_TYPES.Person;
                const dim = (sel && sel !== n.id && !rels.some((l) => l.from === n.id || l.to === n.id)) || !match(n);
                return (
                  <g key={n.id} transform={`translate(${p.x},${p.y})`} className="net-node" opacity={dim ? 0.28 : 1}
                    onPointerDown={(e) => onDown(e, n.id)}>
                    <circle r={NR + 4} fill={c} opacity={sel === n.id ? 0.28 : 0} />
                    <circle r={NR} fill="#0b1324" stroke={c} strokeWidth={sel === n.id ? 3.5 : 2.5} />
                    {n.image
                      ? <image href={n.image} x={-(NR - 2)} y={-(NR - 2)} width={(NR - 2) * 2} height={(NR - 2) * 2}
                          preserveAspectRatio="xMidYMid slice" clipPath={`url(#cp-${n.id})`} />
                      : <text textAnchor="middle" dy=".35em" className="net-init" fill={c}>{(n.name || '?')[0].toUpperCase()}</text>}
                    <text y={NR + 14} textAnchor="middle" className="net-label" dir="auto">{n.name}</text>
                  </g>
                );
              })}
            </g>
          </svg>
          <div className="net-zoom">
            <button onClick={() => zoom(1.2)}><i className="fa-solid fa-plus" /></button>
            <button onClick={() => zoom(0.83)}><i className="fa-solid fa-minus" /></button>
            <button title="Fit all" onClick={() => { autoFit.current = true; fit(); }}><i className="fa-solid fa-expand" /></button>
            <button title={full ? 'Exit full screen' : 'Full screen'} onClick={() => setFull((f) => !f)}><i className={`fa-solid ${full ? 'fa-compress' : 'fa-maximize'}`} /></button>
          </div>
        </div>
      {selNode && (
        <div className="card net-detail">
          <div className="person" style={{ borderBottom: '1px solid var(--line2)' }}>
            <Avatar name={selNode.name} photo={selNode.image} size={48} />
            <div className="info">
              <div className="nm" dir="auto">{selNode.name}</div>
              <div className="sb" style={{ color: NODE_TYPES[selNode.type] || NODE_TYPES.Person }}>{(selNode.type || 'Person').toUpperCase()}</div>
            </div>
            <button className="icon-btn" onClick={() => openModal('link', null, { from: selNode.id })} title="Connect"><i className="fa-solid fa-link" /></button>
            <button className="icon-btn" onClick={() => openModal('node', selNode)}><i className="fa-solid fa-pen" /></button>
            {isCmd && <button className="icon-btn red" onClick={async () => {
              if (!(await ui.confirm(`Permanently delete ${selNode.name} and its connections?`))) return;
              try {
                await Promise.all(rels.map((l) => window.DB.remove(col('links'), l.id)));
                await window.DB.remove(col('nodes'), selNode.id);
                delete pos.current[selNode.id]; setSel(null); ui.toast('Record deleted', 'ok');
              } catch (e) { ui.toast(e.message, 'error'); }
            }}><i className="fa-solid fa-trash" /></button>}
          </div>
          {selNode.notes && <p dir="auto" style={{ padding: '10px 15px', color: 'var(--muted)', lineHeight: 1.6 }}>{selNode.notes}</p>}
          <div className="net-rels">
            {rels.length === 0 ? <span className="mono" style={{ color: 'var(--dim)', fontSize: '.66rem' }}>NO CONNECTIONS</span> : rels.map((l) => (
              <div key={l.id} className="net-rel">
                <span dir="auto">{l.from === selNode.id ? '→' : '←'} {nameOf(l.from === selNode.id ? l.to : l.from)}{l.label ? ` · ${l.label}` : ''}</span>
                <button className="icon-btn red" onClick={() => remove('links', l.id, 'this connection')}><i className="fa-solid fa-xmark" /></button>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
      ); return full ? ReactDOM.createPortal(cardEl, document.body) : cardEl; })()}
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
      <button className={`btn btn-block ${me ? 'btn-danger' : 'btn-outline'}`} style={{ padding: 12 }} onClick={toggle}>
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
                <Avatar name={u.name} icon="fa-user-shield" size={34} />
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
            <div className="avatar" style={{ width: 42, height: 42 }}><i className="fa-solid fa-shield-halved" /></div>
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
        <button className="btn btn-outline btn-block" style={{ padding: 12, borderColor: 'rgba(242,193,78,.5)', color: 'var(--cyan)' }} onClick={() => openModal('staff')}>
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
          <textarea className="input" style={{ height: 78 }} dir="auto" placeholder="Type your message here…" value={raw} onChange={(e) => setRaw(e.target.value)} />
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
          <textarea className="input mono" style={{ height: 78 }} placeholder="Paste cipher here…" value={di} onChange={(e) => setDi(e.target.value)} />
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
const LogsPage = ({ logs }) => {
  const rows = sortNew(logs).slice(0, 150);
  return (
    <>
      <PageHead title="Activity Log" color="var(--text)" />
      <div className="card">
        {rows.length === 0 ? <Empty icon="fa-terminal" text="No activity recorded" /> :
          rows.map((l) => (
            <div key={l.id} className="log"><span className="t">[{tsMs(l.createdAt) ? new Date(tsMs(l.createdAt)).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '…'}]</span> <b>{l.user}</b> — {l.action}</div>
          ))}
      </div>
    </>
  );
};

/* ---------------- Modal forms ---------------- */
const TITLES = { case: 'Case File', wanted: 'Wanted Target', civilian: 'Civilian Record', staff: 'Agent Profile', profile: 'My Profile', node: 'Network Node', link: 'Connection' };
const RecordModal = ({ modal, onClose, onSave, user, onLogout, nodes = [] }) => {
  const { kind, item: ei } = modal;
  const bd = (e) => e.target === e.currentTarget && onClose();

  if (kind === 'profile') {
    return (
      <div className="modal-backdrop" onClick={bd}>
        <div className="modal">
          <div className="modal-head"><h3>{TITLES.profile}</h3><button className="icon-btn" onClick={onClose}><i className="fa-solid fa-xmark" /></button></div>
          <div className="modal-body" style={{ alignItems: 'center', textAlign: 'center' }}>
            <Avatar name={user.name} photo={user.photo} size={64} />
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 600 }} dir="auto">{user.name}</div>
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
              <Field label="Incident Report"><textarea name="details" className="input" dir="auto" style={{ height: 100 }} placeholder="Detailed incident description…" defaultValue={ei?.details} required /></Field>
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
              <PhotoField label="Photo" name="image" defaultValue={ei?.image} />
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
            {kind === 'node' && <>
              <Field label="Name"><input name="name" className="input" dir="auto" placeholder="Person / group / place…" defaultValue={ei?.name} required /></Field>
              <Field label="Type">
                <select name="type" className="input" defaultValue={ei?.type || 'Person'}>
                  {Object.keys(NODE_TYPES).map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                </select>
              </Field>
              <Field label="Role / Notes"><textarea name="notes" className="input" dir="auto" style={{ height: 70 }} placeholder="Role, alias, details…" defaultValue={ei?.notes} /></Field>
              <PhotoField label="Photo" name="image" defaultValue={ei?.image} />
            </>}
            {kind === 'link' && <>
              <Field label="From">
                <select name="from" className="input" defaultValue={ei?.from || modal.pre?.from || ''} required>
                  <option value="" disabled>Select node…</option>
                  {nodes.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select>
              </Field>
              <Field label="To">
                <select name="to" className="input" defaultValue={ei?.to || ''} required>
                  <option value="" disabled>Select node…</option>
                  {nodes.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select>
              </Field>
              <Field label="Relationship"><input name="label" className="input" dir="auto" placeholder="e.g. Leader, Supplier, Rival…" defaultValue={ei?.label} /></Field>
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
              <PhotoField label="Photo (optional)" name="photo" defaultValue={ei?.photo} />
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
