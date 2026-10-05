/* =====================================================================
   RECUP STATION // CORE DATA LAYER  (v3 · Supabase)
   Shared by: roadside check-in (iPad / QR stand) · The Diagnostic (IG link)
              · member page · story builder · God Terminal
   ---------------------------------------------------------------------
   Every runner = one record with a short MEMBER CODE (e.g. RS-7Q4K).
   All devices write to ONE Supabase database (supabase/recup_station.sql):
   - public pages can only add a runner and open one card by its exact code
   - the God Terminal and the booth iPad log in once as staff to see/edit all
   Offline? New runners and cup logs wait on the device and sync when back.
   ===================================================================== */

const RECUP_CONFIG = {
  // 1) Supabase project (Settings → API). The anon key is public by design:
  //    it can only add runners and open a card by its exact code.
  SUPABASE_URL: 'https://bjpekyumhgyssvmhwiyz.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqcGVreXVtaGd5c3N2bWh3aXl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1ODg0NzQsImV4cCI6MjEwNjE2NDQ3NH0.mnRgRp5Z2Pab2buzj_k9V3zwM2TOxsxJTJVEH4YMphA',

  // 2) Once hosted (Netlify / GitHub Pages), paste your site root, e.g. 'https://recupstn.netlify.app/'
  //    Used for QR codes, WhatsApp messages and the member page link.
  SITE_URL: 'https://joeycoachie.github.io/recup-station-/',

  // 3) Your Recup Station WhatsApp Business number (digits only, e.g. '60123456789').
  //    Runners who don't want to type their number can tap/scan to message you instead.
  BUSINESS_WA: '60102319893',               // Joey's WhatsApp (010-231 9893). Swap for a WhatsApp Business number later.

  LAUNCH_DATE: '2026-10-03T07:00:00+08:00',   // edit to your real open day
  NODE_NAME: 'NODE_001 · PHB SAUJANA',
  STOCK_UNITS: 10,                             // fallback only: the terminal uses CUPS THIS SATURDAY (panel 04)
  DISCOUNT_CODE: 'RECUP10',                    // placeholder – change to your real code
  WHATSAPP_FOLLOWUP_TARGET: 20,

  // Menu. price: null = not set yet (shows "TBC", counts RM 0 in revenue)
  PROTOCOLS: {
    FLUSH: { code: 'FLUSH', name: 'THE FLUSH',  phase: 'CHECK-IN', tag: 'Check-in cup · hydrate & reset', price: null },
    N01:   { code: 'NODE_01', name: 'THE FLOW', phase: 'DURING-RUN', tag: 'Salts + collagen · sip during the run', price: 18 },
    N02:   { code: 'NODE_02', name: 'THE BUILD', phase: 'POST-RUN', tag: 'Protein + collagen · drink within 30 min', price: 10 },   // 3 cups per blend
  },

  // Add-ons & take-home (poster + manual). Nitric Prime is NOT launched yet — shown as locked (Cup 2 reward).
  ADDONS: {
    ACAI:   { name: 'ACAI ANTIOXIDANT', phase: 'POST-RUN ADD-ON', tag: 'Mop up the "exercise rust"', price: null },
    NIGHT:  { name: 'THE NIGHT SHIFT', phase: 'TAKE-HOME · BEFORE BED', tag: 'Overnight heart & recovery support', price: null },
    NITRIC: { name: 'NITRIC PRIME', phase: 'PRE-RUN', tag: 'Opens the pipes · 15 min before flag-off', price: null, locked: true },
  },
  SCHEDULE: 'Every Saturday · PHB Saujana run club · from flag-off until 55 cups are gone',

  // Where runners usually run, grouped by zone (Klang Valley run clubs + parks).
  AREAS: [
    ['Saujana & Shah Alam', ['PHB Saujana', 'Shah Alam Lake Gardens', 'Setia Alam / Eco Ardence']],
    ['PJ & Subang', ['Subang Jaya / USJ', 'Sunway / Bandar Sunway', 'Kelana Jaya Lake / Ara Damansara', 'Bukit Gasing / PJ']],
    ['Damansara & Kiara', ['Kota Damansara', 'Bandar Utama / Mutiara Damansara', 'Bukit Kiara / TTDI', 'Mont Kiara / Hartamas', 'Bangsar / Damansara Heights']],
    ['KL City', ['KLCC Park', 'Perdana Botanical Gardens', 'KL Forest Eco Park', 'Titiwangsa Lake']],
    ['North KL', ['Desa ParkCity', 'Kepong Metropolitan Park / FRIM']],
    ['South & East', ['Bukit Jalil', 'Cheras / Ampang', 'Putrajaya / Cyberjaya']],
  ],
  FREQUENCY: ['Just starting', '1x a week', '2–3x a week', '4+ a week'],
  PAINS: ['Knees / joints', 'Breath / lungs', 'Energy crash', 'Muscle soreness', 'Cramps', 'Lower back', 'Nothing — just here for the vibe', 'Other'],

  // THE ASCENSION MODEL — thirsty → Activated Performance Partner
  LADDER: [
    { cup: 1, name: 'THE FIRST CUP',  step: 'QR Scan / Sign-in', reward: '10% off + Free Recovery PDF', discount: 0.10,
      data: 'Contact, Region, Running frequency', ask: null },
    { cup: 2, name: 'THE SECOND CUP', step: 'Return visit', reward: 'Access to the Nitric Oxide Boost', discount: 0,
      data: 'Favourite recovery pain point',
      ask: { key: 'painFocus', q: 'Which recovery pain point do you most want fixed?', options: ['Knees / joints', 'Breath / lungs', 'Energy crash', 'Muscle soreness', 'Cramps', 'Sleep / next-day fatigue'] } },
    { cup: 3, name: 'THE THIRD CUP',  step: 'Consistency', reward: 'Buy 1 Get 1 Free — bring a buddy', discount: 0, bogo: true,
      data: 'Referral / social share',
      ask: { key: 'referral', q: 'Who is your buddy today? (name or @handle)', type: 'text' } },
    { cup: 4, name: 'THE FOURTH CUP', step: 'Activation', reward: '20% off + Full Account Activation', discount: 0.20,
      data: 'Performance goal',
      ask: { key: 'goal', q: 'What are you training for?', options: ['Marathon', 'Half marathon', '10K PB', 'Weight loss', 'Run injury-free', 'General fitness'] } },
    { cup: 5, name: 'THE MILESTONE',  step: 'Loyalty', reward: '25% off + Exclusive gift / Member kit', discount: 0.25,
      data: 'Wearable (optional / future)',
      ask: { key: 'wearable', q: 'Do you track with a wearable? (optional)', options: ['Garmin', 'Apple Watch', 'Coros', 'Strava only', 'None', 'Skip'] } },
  ],
};

// HEALTHBAR (internal key) = RECUP.STN HQ in public. Customer copy follows the Plain Language Mandate (SSOT artifact). Edit copy here; the runner's card and the side menu use it.
RECUP_CONFIG.HEALTHBAR = {
  NAME: 'RECUP.STN HQ',
  PLACE: 'RECUP.STN HQ, Bukit Damansara',
  ONLINE: 'Or a video call, from anywhere',
  HEADLINE: 'Want a plan built around your body?',
  PITCH: 'A one-on-one plan for your food, sleep and recovery. In person at RECUP.STN HQ or on a video call.',
  CONCERNS: ['Energy', 'Sleep', 'Skin', 'Stomach / toilet', 'Mood', 'Belly fat', 'Recovery after runs', 'My health check results'],
  // Safety questions (Plain Language Mandate · exclusions). Ticked answers are added to the enquiry for staff.
  SAFETY: ['Pregnant or breastfeeding', 'Kidney disease (stage 3, 4 or 5)', 'Having chemo or radiotherapy', 'Taking blood thinners (e.g. warfarin)', 'None of these'],
};

// S-RANK = Zero Energy Leaks. Movement (passes the squat) + Inside health (RECUP.STN HQ session done).
RECUP_CONFIG.SRANK = {
  LINE: 'Zero Energy Leaks. Checked inside and out.',
  CHASSIS: ['Movement · outside', 'You pass the squat test: knees stay over your toes, your joints hold.', 'Pass the squat test. Ask for a re-test at the Recup table.'],
  ENGINE: ['Inside health', 'Your sleep, stomach, energy and health check results are checked at RECUP.STN HQ.', 'Book a session at RECUP.STN HQ to check your sleep, stomach, energy and health check results.'],
};

// ABOUT (side menu on the runner's card). DRAFT copy: edit freely.
RECUP_CONFIG.ABOUT = [
  ['Who we are', 'RECUP.STN helps runners recover. Not a juice bar. We make drinks matched to what your body needs before, during and after a run, so you bounce back faster.'],
  ['How it works', 'Check your body. Find the weak spot. Fix it. A 60-second squat test grades how your legs hold up, we save the right drink for you, and every cup unlocks a reward on your card.'],
  ['Where to find us', 'Every Saturday at the PHB Saujana run club, from flag-off until the cups are gone. One-on-one sessions at RECUP.STN HQ in Bukit Damansara, or on a video call from anywhere.'],
  ['Your data', 'Only used for your guide, your cups and your rewards. Never shared or sold. Want it removed? Tell us at the table or message us.'],
];

RECUP_CONFIG.REGIONS = RECUP_CONFIG.AREAS.flatMap(([, list]) => list).concat('Other');

const RECUP = (() => {
  const K_LEADS = 'recup_leads_v2';
  const K_QUEUE = 'recup_queue_v2';
  const C = RECUP_CONFIG;

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };

  /* ---------- normalisers ---------- */
  const SQUAT = { 'Yes': 'SOLID', 'Struggle': 'SHAKY', 'No': 'COLLAPSE', 'Solid': 'SOLID', 'Shaky': 'SHAKY', 'Collapse': 'COLLAPSE' };
  const GRADE = { SOLID: { grade: 'A', label: 'SOLID MOVEMENT' }, SHAKY: { grade: 'B', label: 'ENERGY LEAK' }, COLLAPSE: { grade: 'C', label: 'REBUILD MODE' } };
  function normArchetype(v = '') {
    const s = v.toLowerCase();
    if (/^none/.test(s)) return 'NONE';
    for (const [k, out] of [['sprinter', 'SPRINTER'], ['diesel', 'DIESEL'], ['tank', 'TANK'], ['soul', 'SOUL RUNNER'], ['office', 'OFFICE BODY']]) if (s.includes(k)) return out;
    return v ? v.toUpperCase() : '';
  }
  function normPhone(v = '') { let d = String(v).replace(/\D/g, ''); if (d.startsWith('0')) d = '6' + d; return d; }

  /* Which protocol to reserve / recommend */
  function recommend({ squat, pain }) {
    if (squat === 'SHAKY' || squat === 'COLLAPSE') return 'N02';
    const p = (pain || '').toLowerCase();
    if (/(knee|joint|muscle|back)/.test(p)) return 'N02';
    return 'N01';
  }

  function newCode() {
    const a = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let s = ''; for (let i = 0; i < 4; i++) s += a[Math.floor(Math.random() * a.length)];
    return 'RS-' + s;
  }

  function tierOf(cups) { const c = Math.min(cups || 0, C.LADDER.length); return c ? C.LADDER[c - 1] : null; }
  function nextTier(cups) { return C.LADDER[Math.min(cups || 0, C.LADDER.length - 1)] && (cups || 0) < C.LADDER.length ? C.LADDER[cups || 0] : null; }

  /* ---------- Supabase: staff session ---------- */
  const K_SESSION = 'recup_staff_session_v1';
  const session = () => store.get(K_SESSION, null);
  async function auth(grant, body) {
    const r = await fetch(`${C.SUPABASE_URL}/auth/v1/token?grant_type=${grant}`, {
      method: 'POST', headers: { apikey: C.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const m = j.error_description || j.msg || j.message || 'Login failed';
      throw new Error(/not confirmed/i.test(m) ? 'Email not confirmed yet. In Supabase → Authentication → Users, confirm this user (or add it again with "Auto Confirm").'
        : /invalid/i.test(m) ? 'Wrong email or password. No login yet? Supabase → Authentication → Users → Add user (tick Auto Confirm).' : m);
    }
    store.set(K_SESSION, { access: j.access_token, refresh: j.refresh_token, email: j.user && j.user.email, exp: Date.now() + (j.expires_in - 60) * 1000 });
  }
  async function login(email, password) { await auth('password', { email, password }); }
  function logout() { try { localStorage.removeItem(K_SESSION); } catch {} }
  async function staffToken() {
    const s = session(); if (!s) return null;
    if (Date.now() < s.exp) return s.access;
    try { await auth('refresh_token', { refresh_token: s.refresh }); return session().access; } catch { logout(); return null; }
  }

  async function rest(path, { method = 'GET', body, token, prefer } = {}) {
    const headers = { apikey: C.SUPABASE_ANON_KEY, Authorization: `Bearer ${token || C.SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' };
    if (prefer) headers.Prefer = prefer;
    const r = await fetch(`${C.SUPABASE_URL}/rest/v1/${path}`, { method, headers, body: body && JSON.stringify(body) });
    const text = await r.text(); let json = null; try { json = text ? JSON.parse(text) : null; } catch {}
    if (!r.ok) throw Object.assign(new Error((json && json.message) || `Supabase ${r.status}`), { status: r.status });
    return json;
  }

  /* database rows (snake_case) <-> lead objects (camelCase, as every page uses them) */
  const COLS = { chassisOk: 'chassis_ok', contactMethod: 'contact_method', painFocus: 'pain_focus', manualSent: 'manual_sent', updatedAt: 'updated_at' };
  const LOCAL_ONLY = ['gradeLabel', 'engineOk'];
  function toRow(o) {
    const r = {};
    for (const [k, v] of Object.entries(o)) if (!LOCAL_ONLY.includes(k)) r[COLS[k] || k] = k === 'history' ? safeJSON(v, []) : v;
    return r;
  }
  function fromRow(r) {
    const l = {};
    for (const [k, v] of Object.entries(r)) { const camel = Object.keys(COLS).find(c => COLS[c] === k); l[camel || k] = v; }
    l.history = typeof l.history === 'string' ? l.history : JSON.stringify(l.history || []);
    l.cups = +l.cups || 0;
    if (l.ts) l.ts = new Date(l.ts).toISOString();
    if (l.updatedAt) l.updatedAt = new Date(l.updatedAt).toISOString();
    return l;
  }

  /* ---------- writes (queued when offline) ---------- */
  // true = done, or permanently rejected (bad data) so it's not retried forever
  async function post(p) {
    try {
      if (p.action === 'create') {
        const r = await rest('rpc/create_runner', { method: 'POST', body: { p: p.lead } });
        if (r && r.code && r.code !== p.lead.code) { const all = store.get(K_LEADS, []); const l = all.find(x => x.id === p.lead.id); if (l) { l.code = r.code; store.set(K_LEADS, all); } p.lead.code = r.code; }
        return true;
      }
      if (p.action === 'update') {
        const token = await staffToken(); if (!token) return false;       // waits until staff log in on this device
        await rest(`runners?id=eq.${encodeURIComponent(p.id)}`, { method: 'PATCH', body: toRow(p.patch), token, prefer: 'return=minimal' });
        return true;
      }
    } catch (e) { return e.status === 400; }
    return false;
  }
  function enqueue(p) { const q = store.get(K_QUEUE, []); q.push(p); store.set(K_QUEUE, q); }
  async function send(p) { if (!(await post(p))) enqueue(p); }
  async function flushQueue() {
    const q = store.get(K_QUEUE, []);
    if (!q.length) return 0;
    const left = []; for (const p of q) if (!(await post(p))) left.push(p);
    store.set(K_QUEUE, left); return left.length;
  }
  if (typeof window !== 'undefined') window.addEventListener('online', flushQueue);

  function saveLocal(lead) {
    const all = store.get(K_LEADS, []); const i = all.findIndex(l => l.id === lead.id);
    if (i >= 0) all[i] = { ...all[i], ...lead }; else all.push(lead);
    store.set(K_LEADS, all);
  }

  /* ---------- create a runner (both channels use this) ---------- */
  async function submitLead(raw) {
    const squat = raw.squat ? (SQUAT[raw.squat] || 'SHAKY') : '';
    const g = squat ? GRADE[squat] : null;
    const phone = raw.contactMethod === 'WHATSAPP' ? normPhone(raw.contact) : '';
    const lead = {
      id: 'L' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      code: newCode(),
      ts: new Date().toISOString(),
      source: raw.source,                 // DIAGNOSTIC_ONLINE | ROADSIDE_IPAD | QR_STAND
      name: (raw.name || '').trim(),
      contactMethod: raw.contactMethod || 'NONE',   // WHATSAPP | INSTAGRAM | NONE
      phone,
      instagram: raw.contactMethod === 'INSTAGRAM' ? (raw.contact || '').trim().replace(/^@?/, '@') : '',
      region: raw.region || '', frequency: raw.frequency || '', pain: raw.pain || '',
      archetype: normArchetype(raw.archetype), knowledge: raw.knowledge || '', fuel: raw.fuel || '',
      squat, grade: g ? g.grade : '',
      protocol: recommend({ squat, pain: raw.pain }),
      status: raw.source === 'DIAGNOSTIC_ONLINE' ? 'RESERVED' : 'CHECKED_IN',   // RESERVED -> CHECKED_IN
      cups: 0, history: '[]',
      painFocus: '', referral: '', goal: '', wearable: '',
      manualSent: '', campaign: raw.campaign || '', notes: '',
      updatedAt: new Date().toISOString(),
    };
    saveLocal(lead);
    const p = { action: 'create', lead };
    const ok = await post(p);        // the database may hand back a different code if this one was taken
    if (!ok) enqueue(p);
    return { ...lead, code: p.lead.code, gradeLabel: g ? g.label : '', synced: ok };
  }

  async function updateLead(id, patch) {
    patch = { ...patch, updatedAt: new Date().toISOString() };
    const all = store.get(K_LEADS, []); const i = all.findIndex(l => l.id === id);
    if (i >= 0) { all[i] = { ...all[i], ...patch }; store.set(K_LEADS, all); }
    if (String(id).startsWith('DEMO')) return;
    await send({ action: 'update', id, patch });
  }

  /* ---------- pour a cup: +1 up the ladder ---------- */
  function priceFor(productKey, cupNo) {
    const p = C.PROTOCOLS[productKey]; const rung = C.LADDER[Math.min(cupNo, C.LADDER.length) - 1];
    const base = (p && p.price) || 0;
    const disc = cupNo >= C.LADDER.length ? C.LADDER[C.LADDER.length - 1].discount : (rung ? rung.discount : 0);
    return { paid: Math.round(base * (1 - disc) * 100) / 100, units: rung && rung.bogo && cupNo === rung.cup ? 2 : 1, discount: disc };
  }
  async function stampCup(lead, { product, answers = {} }) {
    const cups = (+lead.cups || 0) + 1;
    const hist = safeJSON(lead.history, []);
    const pr = priceFor(product, cups);
    hist.push({ n: cups, ts: new Date().toISOString(), product, paid: pr.paid, units: pr.units });
    const patch = { cups, history: JSON.stringify(hist), status: 'CHECKED_IN', ...answers };
    Object.assign(lead, patch);
    saveLocal(lead);
    await updateLead(lead.id, patch);
    return { cups, rung: tierOf(cups), next: nextTier(cups), ...pr };
  }

  /* ---------- reading ---------- */
  function mergeById(lists) {
    const map = new Map();
    for (const l of lists.flat()) {
      if (!l || !l.id) continue;
      const prev = map.get(l.id);
      if (!prev || (l.updatedAt || '') >= (prev.updatedAt || '')) map.set(l.id, { ...prev, ...l });
    }
    return [...map.values()].map(l => ({ ...l, cups: +l.cups || 0 }));
  }

  async function loadLeads() {           // God Terminal (staff login)
    const local = store.get(K_LEADS, []);
    let remote = [], remoteOk = false, error = '';
    const token = await staffToken();
    if (token) {
      try {
        remote = (await rest('runners?select=*&order=ts.desc&limit=5000', { token })).map(fromRow); remoteOk = true;
        try { const eng = new Set((await rest('runner_engine?select=runner_id&engine_ok=eq.true', { token })).map(e => e.runner_id)); remote.forEach(l => l.engineOk = eng.has(l.id)); } catch {}
      }
      catch (e) { error = e.message; }
    }
    // Database is the truth once we can read it: drop local copies it no longer has (e.g. after a wipe),
    // except runners still waiting in the offline queue to be uploaded.
    let keep = local, pruned = 0;
    if (remoteOk) {
      const onServer = new Set(remote.map(l => l.id));
      const queued = new Set(store.get(K_QUEUE, []).filter(q => q.action === 'create').map(q => q.lead.id));
      keep = local.filter(l => onServer.has(l.id) || queued.has(l.id));
      pruned = local.length - keep.length;
      if (pruned) store.set(K_LEADS, keep);
    }
    const leads = mergeById([remote, keep]).filter(l => l.ts).sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
    return { leads, remoteOk, loggedIn: !!token, error, pruned, pending: store.get(K_QUEUE, []).length };
  }

  // Booth lookup. Staff (logged in): code, phone, @handle or name. Otherwise: exact member code only.
  async function findRunner(q) {
    q = (q || '').trim(); if (!q) return [];
    const needle = q.toLowerCase(); const digits = q.replace(/\D/g, '');
    const code = /^rs-/i.test(q) ? q.toUpperCase() : 'RS-' + q.toUpperCase();
    const match = l => (l.code || '').toUpperCase() === code
      || (digits.length >= 6 && (l.phone || '').endsWith(digits.replace(/^0/, '')))
      || (l.instagram || '').toLowerCase() === '@' + needle.replace(/^@/, '')
      || (needle.length >= 3 && (l.name || '').toLowerCase().includes(needle));
    const local = store.get(K_LEADS, []).filter(match);
    let remote = [];
    const token = await staffToken();
    try {
      if (token) {
        const quote = v => '"' + v.replace(/"/g, '') + '"';
        const ors = [`code.eq.${quote(code)}`];
        if (needle.length >= 3) ors.push(`name.ilike.${quote('*' + q + '*')}`);
        if (digits.length >= 6) ors.push(`phone.like.${quote('*' + digits.replace(/^0/, ''))}`);
        if (/^@?[\w.]{2,}$/.test(q)) ors.push(`instagram.ilike.${quote('@' + q.replace(/^@/, ''))}`);
        remote = (await rest(`runners?select=*&or=${encodeURIComponent('(' + ors.join(',') + ')')}&limit=8`, { token })).map(fromRow);
      } else {
        const m = await rest('rpc/get_member', { method: 'POST', body: { p_code: code } });
        if (m) remote = [fromRow(m)];
      }
    } catch {}
    return mergeById([remote, local]).slice(0, 8);
  }

  async function getByCode(code) {
    code = String(code || '').trim().toUpperCase(); if (!code) return null;
    const local = store.get(K_LEADS, []).find(l => (l.code || '').toUpperCase() === code);
    let remote = null;
    try { const m = await rest('rpc/get_member', { method: 'POST', body: { p_code: code } }); if (m) remote = fromRow(m); } catch {}
    return remote || local || null;
  }

  /* ---------- cup claims: runner taps CLAIM on their card, staff ✓ ---------- */
  async function claimCup(code, product, answers = {}) {
    return rest('rpc/claim_cup', { method: 'POST', body: { p_code: code, p_product: product, p_answers: answers } });
  }
  async function cancelClaim(code) { await rest('rpc/cancel_claim', { method: 'POST', body: { p_code: code } }); }
  async function loadClaims() {
    const token = await staffToken(); if (!token) return [];
    try { return await rest(`cup_claims?select=*&status=eq.PENDING&order=created_at.asc`, { token }); } catch { return []; }
  }
  // Approve = the cup was poured and paid. Uses the runner's latest row so two devices can't double-count.
  async function approveClaim(claim, product) {
    const token = await staffToken(); if (!token) throw new Error('Log in first');
    const rows = await rest(`runners?select=*&id=eq.${encodeURIComponent(claim.runner_id)}`, { token });
    if (!rows.length) throw new Error('Runner not found');
    const lead = fromRow(rows[0]);
    const answers = {}; for (const [k, v] of Object.entries(claim.answers || {})) if (v && ['painFocus', 'referral', 'goal', 'wearable'].includes(k)) answers[k] = v;
    const r = await stampCup(lead, { product: product || claim.product, answers });
    await rest(`cup_claims?id=eq.${claim.id}`, { method: 'PATCH', token, prefer: 'return=minimal',
      body: { status: 'APPROVED', paid: r.paid, product: product || claim.product, cup_no: r.cups, decided_at: new Date().toISOString(), staff_email: (session() || {}).email } });
    return { ...r, lead };
  }
  async function rejectClaim(id) {
    const token = await staffToken(); if (!token) throw new Error('Log in first');
    await rest(`cup_claims?id=eq.${id}`, { method: 'PATCH', token, prefer: 'return=minimal', body: { status: 'REJECTED', decided_at: new Date().toISOString(), staff_email: (session() || {}).email } });
  }

  /* ---------- shared terminal settings (staff only) ---------- */
  async function getSetting(key) {
    const token = await staffToken(); if (!token) return null;
    try { const r = await rest(`terminal_settings?select=value&key=eq.${encodeURIComponent(key)}`, { token }); return r.length ? r[0].value : {}; } catch { return null; }
  }
  async function setSetting(key, value) {
    const token = await staffToken(); if (!token) return false;
    try { await rest('terminal_settings?on_conflict=key', { method: 'POST', token, prefer: 'resolution=merge-duplicates,return=minimal', body: { key, value, updated_at: new Date().toISOString() } }); return true; } catch { return false; }
  }

  /* ---------- Health Bar appointments ---------- */
  async function requestHealthbar(code, f = {}) {
    return rest('rpc/request_healthbar', { method: 'POST', body: { p_code: code, p_goal: f.goal || '', p_preferred: f.preferred || '',
      p_concerns: f.concerns || [], p_for_whom: f.forWhom || 'Myself', p_mode: f.mode === 'ONLINE' ? 'ONLINE' : 'CAFE' } });
  }
  async function cancelHealthbar(code) { await rest('rpc/cancel_healthbar', { method: 'POST', body: { p_code: code } }); }
  async function loadHealthbar() {
    const token = await staffToken(); if (!token) return [];
    try { return await rest(`healthbar_bookings?select=*&status=in.(REQUESTED,BOOKED)&order=created_at.asc`, { token }); } catch { return []; }
  }
  async function updateHealthbar(id, patch) {
    const token = await staffToken(); if (!token) throw new Error('Log in first');
    await rest(`healthbar_bookings?id=eq.${id}`, { method: 'PATCH', token, prefer: 'return=minimal', body: { ...patch, updated_at: new Date().toISOString() } });
  }
  function slotText(iso) { if (!iso) return ''; const d = new Date(iso);
    return d.toLocaleDateString('en-MY', { weekday: 'short', day: 'numeric', month: 'short' }) + ', ' + d.toLocaleTimeString('en-MY', { hour: 'numeric', minute: '2-digit' }); }

  /* ---------- Instagram: open a DM with the runner ---------- */
  const igHandle = l => (l.instagram || '').replace(/^@/, '').trim();
  function igDmUrl(l) { return igHandle(l) ? `https://ig.me/m/${encodeURIComponent(igHandle(l))}` : ''; }
  function igProfileUrl(l) { return igHandle(l) ? `https://instagram.com/${encodeURIComponent(igHandle(l))}` : ''; }
  function igMessage(lead) {
    const first = (lead.name || '').split(' ')[0] || 'Runner';
    return `Hi ${first}, RECUP.STN here 👋 Your member code: ${lead.code}\n\nYour free Runner's Repair Manual: ${manualUrl(lead)}\nYour Ascension card (cups + rewards): ${memberUrl(lead)}\n\nShow code ${C.DISCOUNT_CODE} for 10% off your first cup at ${C.NODE_NAME}.`;
  }

  /* ---------- links ---------- */
  function siteUrl(path) { try { return new URL(path, C.SITE_URL || location.href).href; } catch { return path; } }
  function manualUrl(lead) { return siteUrl('repair-manual.html') + (lead ? `?c=${encodeURIComponent(lead.code)}` : ''); }
  function memberUrl(lead) { return siteUrl('member.html') + `?c=${encodeURIComponent(lead.code)}`; }
  function storyUrl(lead) { return siteUrl('story.html') + `?c=${encodeURIComponent(lead.code)}`; }
  function waLink(lead) {
    const p = C.PROTOCOLS[lead.protocol] || C.PROTOCOLS.N02;
    const first = (lead.name || '').split(' ')[0] || 'Runner';
    const msg =
`Hi ${first}, RECUP.STN here.

Your member code: ${lead.code}
Your saved drink: ${p.name}${lead.grade ? ` (Grade ${lead.grade})` : ''}

Your Free Runner's Repair Manual:
${manualUrl(lead)}

Your Ascension card (track your cups & rewards):
${memberUrl(lead)}

Show code ${C.DISCOUNT_CODE} for 10% off your first cup at ${C.NODE_NAME}.
Check your body. Find the weak spot. Fix it.`;
    return `https://wa.me/${lead.phone}?text=${encodeURIComponent(msg)}`;
  }
  // For runners who don't want to type a number: they message US (they choose to share)
  // Runner → us: open WhatsApp to our number with their code pre-filled
  function contactWaLink(lead, purpose) {
    if (!C.BUSINESS_WA) return '';
    const first = ((lead && lead.name) || '').split(' ')[0];
    const why = purpose === 'healthbar' ? "I'd like to book a session at RECUP.STN HQ" : 'I have a question';
    return `https://wa.me/${C.BUSINESS_WA}?text=${encodeURIComponent(`Hi RECUP.STN, ${first ? first + ' here' : ''}${lead && lead.code ? ` (member ${lead.code})` : ''}. ${why}.`)}`;
  }
  function selfWaLink(lead) {
    if (!C.BUSINESS_WA) return '';
    return `https://wa.me/${C.BUSINESS_WA}?text=${encodeURIComponent(`Hi RECUP.STN, send my Repair Manual. Code ${lead.code}`)}`;
  }

  function safeJSON(s, d) { try { return typeof s === 'string' ? JSON.parse(s || 'null') ?? d : (s ?? d); } catch { return d; } }
  function clearLocal() { store.set(K_LEADS, []); store.set(K_QUEUE, []); }

  function seedDemo(n = 30) {
    const names = ['Aina', 'Jason', 'Mei Ling', 'Hafiz', 'Priya', 'Daniel', 'Siti', 'Kelvin', 'Nurul', 'Arjun', 'Chloe', 'Irfan'];
    const src = ['ROADSIDE_IPAD', 'ROADSIDE_IPAD', 'DIAGNOSTIC_ONLINE', 'QR_STAND'];
    const cm = ['WHATSAPP', 'WHATSAPP', 'WHATSAPP', 'INSTAGRAM', 'INSTAGRAM', 'NONE'];
    const all = store.get(K_LEADS, []);
    for (let i = 0; i < n; i++) {
      const s = src[i % src.length]; const squat = s === 'DIAGNOSTIC_ONLINE' ? ['SOLID', 'SHAKY', 'COLLAPSE'][i % 3] : '';
      const pain = C.PAINS[i % 7]; const cups = [0, 1, 1, 1, 2, 2, 3, 4, 5, 1][i % 10];
      const protocol = recommend({ squat, pain }); const hist = [];
      for (let c = 1; c <= cups; c++) { const pr = priceFor(protocol, c); hist.push({ n: c, ts: new Date(Date.now() - ((cups - c) * 7 + (i % 3 ? 7 : 0)) * 864e5).toISOString(), product: protocol, paid: pr.paid, units: pr.units }); }
      const method = cm[i % cm.length];
      all.push({
        id: 'DEMO' + i + Math.random().toString(36).slice(2, 5), code: newCode(), ts: new Date(Date.now() - i * 41 * 60000).toISOString(),
        source: s, name: names[i % names.length] + ' (demo)', contactMethod: method,
        phone: method === 'WHATSAPP' ? '6012000' + (1000 + i) : '', instagram: method === 'INSTAGRAM' ? '@demo' + i : '',
        region: C.REGIONS[i % 5], frequency: C.FREQUENCY[i % 4], pain, archetype: s === 'DIAGNOSTIC_ONLINE' ? ['SPRINTER', 'TANK', 'OFFICE BODY'][i % 3] : '',
        squat, grade: squat ? GRADE[squat].grade : '', protocol, fuel: '',
        status: s === 'DIAGNOSTIC_ONLINE' && cups === 0 ? 'RESERVED' : 'CHECKED_IN', cups, history: JSON.stringify(hist),
        painFocus: cups >= 2 ? 'Knees / joints' : '', referral: cups >= 3 ? '@buddy' + i : '', goal: cups >= 4 ? 'Half marathon' : '', wearable: cups >= 5 ? 'Garmin' : '',
        manualSent: i % 3 ? 'YES' : '', notes: 'demo', updatedAt: new Date().toISOString(),
      });
    }
    store.set(K_LEADS, all);
  }

  return { submitLead, updateLead, stampCup, priceFor, loadLeads, findRunner, getByCode, flushQueue, waLink, selfWaLink, contactWaLink, manualUrl, memberUrl, storyUrl, siteUrl,
           getSetting, setSetting, requestHealthbar, cancelHealthbar, loadHealthbar, updateHealthbar, slotText,
           claimCup, cancelClaim, loadClaims, approveClaim, rejectClaim, igDmUrl, igProfileUrl, igMessage,
           tierOf, nextTier, recommend, clearLocal, seedDemo, safeJSON, login, logout, session, GRADE, store };
})();
