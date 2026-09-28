/* =====================================================================
   RECUP STATION // CORE DATA LAYER  (v2 · Ascension Model)
   Shared by: roadside check-in (iPad / QR stand) · The Diagnostic (IG link)
              · member page · God Terminal
   ---------------------------------------------------------------------
   Every runner = one record with a short MEMBER CODE (e.g. RS-7Q4K).
   Phone is OPTIONAL. The code is what tracks cups up the Ascension ladder.
   ===================================================================== */

const RECUP_CONFIG = {
  // 1) Paste your Apps Script "/exec" URL (see apps-script/Code.gs)
  SHEET_ENDPOINT: '',

  // 2) Once hosted (Netlify / GitHub Pages), paste your site root, e.g. 'https://recupstn.netlify.app/'
  //    Used for QR codes, WhatsApp messages and the member page link.
  SITE_URL: 'https://joeycoachie.github.io/recup-station-/',

  // 3) Your Recup Station WhatsApp Business number (digits only, e.g. '60123456789').
  //    Runners who don't want to type their number can tap/scan to message you instead.
  BUSINESS_WA: '',

  LAUNCH_DATE: '2026-10-03T07:00:00+08:00',   // edit to your real open day
  NODE_NAME: 'NODE_001 · GLENHILL SAUJANA',
  STOCK_UNITS: 55,
  DISCOUNT_CODE: 'RECUP10',                    // placeholder – change to your real code
  WHATSAPP_FOLLOWUP_TARGET: 20,

  // Menu. price: null = not set yet (shows "TBC", counts RM 0 in revenue)
  PROTOCOLS: {
    FLUSH: { code: 'FLUSH', name: 'THE FLUSH',  phase: 'CHECK-IN', tag: 'Check-in cup · hydrate & reset', price: null },
    N01:   { code: 'NODE_01', name: 'THE FLOW', phase: 'DURING-RUN', tag: 'Electrolyte balance + structural glue', price: 18 },
    N02:   { code: 'NODE_02', name: 'THE BUILD', phase: 'POST-RUN', tag: 'Protein + collagen · the metabolic window', price: 28 },
  },

  // Add-ons & take-home (poster + manual). Nitric Prime is NOT launched yet — shown as locked (Cup 2 reward).
  ADDONS: {
    ACAI:   { name: 'ACAI ANTIOXIDANT', phase: 'POST-RUN ADD-ON', tag: 'Mop up the "exercise rust"', price: null },
    NIGHT:  { name: 'THE NIGHT SHIFT', phase: 'TAKE-HOME · BEFORE BED', tag: 'Overnight heart & recovery support', price: null },
    NITRIC: { name: 'NITRIC PRIME', phase: 'PRE-RUN', tag: 'Opens the pipes · 15 min before flag-off', price: null, locked: true },
  },
  SCHEDULE: 'Every Saturday · Glenhill Saujana run club · from flag-off until 55 cups are gone',

  REGIONS: ['Glenhill Saujana', 'Saujana (other)', 'Subang', 'Shah Alam', 'Kota Damansara', 'Other'],
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

const RECUP = (() => {
  const K_LEADS = 'recup_leads_v2';
  const K_QUEUE = 'recup_queue_v2';
  const K_ADMIN = 'recup_admin_key';
  const C = RECUP_CONFIG;

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };

  /* ---------- normalisers ---------- */
  const SQUAT = { 'Yes': 'SOLID', 'Struggle': 'SHAKY', 'No': 'COLLAPSE', 'Solid': 'SOLID', 'Shaky': 'SHAKY', 'Collapse': 'COLLAPSE' };
  const GRADE = { SOLID: { grade: 'A', label: 'STABLE CHASSIS' }, SHAKY: { grade: 'B', label: 'ENERGY LEAK' }, COLLAPSE: { grade: 'C', label: 'STRUCTURAL REPAIR' } };
  function normArchetype(v = '') {
    const s = v.toLowerCase();
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

  /* ---------- remote ---------- */
  async function post(payload) {
    if (!C.SHEET_ENDPOINT) return false;
    try {
      await fetch(C.SHEET_ENDPOINT, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
      return true;
    } catch { return false; }
  }
  function enqueue(p) { const q = store.get(K_QUEUE, []); q.push(p); store.set(K_QUEUE, q); }
  async function send(p) { if (C.SHEET_ENDPOINT && !(await post(p))) enqueue(p); }
  async function flushQueue() {
    const q = store.get(K_QUEUE, []);
    if (!q.length || !C.SHEET_ENDPOINT) return q.length;
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
      contactMethod: raw.contactMethod || 'NONE',   // WHATSAPP | EMAIL | INSTAGRAM | NONE
      phone,
      email: raw.contactMethod === 'EMAIL' ? (raw.contact || '').trim() : '',
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
    await send({ action: 'create', lead });
    return { ...lead, gradeLabel: g ? g.label : '' };
  }

  async function updateLead(id, patch) {
    patch = { ...patch, updatedAt: new Date().toISOString() };
    const all = store.get(K_LEADS, []); const i = all.findIndex(l => l.id === id);
    if (i >= 0) { all[i] = { ...all[i], ...patch }; store.set(K_LEADS, all); }
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
    await updateLead(lead.id, patch);
    return { cups, rung: tierOf(cups), next: nextTier(cups), ...pr };
  }

  /* ---------- reading ---------- */
  function adminKey() { return store.get(K_ADMIN, ''); }
  function setAdminKey(k) { store.set(K_ADMIN, k); }

  async function loadLeads() {           // God Terminal (needs admin key when Sheet is on)
    const local = store.get(K_LEADS, []);
    let remote = [], remoteOk = false, authFail = false;
    if (C.SHEET_ENDPOINT) {
      try {
        const r = await fetch(`${C.SHEET_ENDPOINT}?mode=all&key=${encodeURIComponent(adminKey())}&t=${Date.now()}`);
        const j = await r.json();
        if (j.ok) { remote = j.leads || []; remoteOk = true; } else authFail = true;
      } catch {}
    }
    const map = new Map();
    for (const l of [...remote, ...local]) {
      if (!l || !l.id) continue;
      const prev = map.get(l.id);
      if (!prev || (l.updatedAt || '') >= (prev.updatedAt || '')) map.set(l.id, { ...prev, ...l });
    }
    const leads = [...map.values()].filter(l => l.ts).map(l => ({ ...l, cups: +l.cups || 0 })).sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
    return { leads, remoteOk, authFail, pending: store.get(K_QUEUE, []).length };
  }

  // Booth lookup: by member code, phone, email/IG or name. Returns minimal records.
  async function findRunner(q) {
    q = (q || '').trim(); if (!q) return [];
    const needle = q.toLowerCase(); const digits = q.replace(/\D/g, '');
    const match = l => (l.code || '').toLowerCase() === needle || (l.code || '').toLowerCase() === 'rs-' + needle
      || (digits.length >= 6 && (l.phone || '').endsWith(digits.replace(/^0/, '')))
      || (l.email || '').toLowerCase() === needle || (l.instagram || '').toLowerCase() === '@' + needle.replace(/^@/, '')
      || (needle.length >= 3 && (l.name || '').toLowerCase().includes(needle));
    const local = store.get(K_LEADS, []).filter(match);
    let remote = [];
    if (C.SHEET_ENDPOINT) {
      try { const r = await fetch(`${C.SHEET_ENDPOINT}?mode=find&q=${encodeURIComponent(q)}&t=${Date.now()}`); const j = await r.json(); remote = j.leads || []; } catch {}
    }
    const map = new Map(); [...remote, ...local].forEach(l => map.set(l.id, { ...map.get(l.id), ...l }));
    return [...map.values()].map(l => ({ ...l, cups: +l.cups || 0 })).slice(0, 8);
  }

  async function getByCode(code) {
    const r = await findRunner(code);
    return r.find(l => (l.code || '').toUpperCase() === String(code).toUpperCase()) || null;
  }

  /* ---------- links ---------- */
  function siteUrl(path) { try { return new URL(path, C.SITE_URL || location.href).href; } catch { return path; } }
  function manualUrl(lead) { return siteUrl('repair-manual.html') + (lead ? `?c=${encodeURIComponent(lead.code)}` : ''); }
  function memberUrl(lead) { return siteUrl('member.html') + `?c=${encodeURIComponent(lead.code)}`; }
  function waLink(lead) {
    const p = C.PROTOCOLS[lead.protocol] || C.PROTOCOLS.N02;
    const first = (lead.name || '').split(' ')[0] || 'Runner';
    const msg =
`Hi ${first}, Recup Station here.

Your member code: ${lead.code}
Reserved protocol: ${p.name}${lead.grade ? ` (Grade ${lead.grade})` : ''}

Your Free Runner's Repair Manual:
${manualUrl(lead)}

Your Ascension card (track your cups & rewards):
${memberUrl(lead)}

Show code ${C.DISCOUNT_CODE} for 10% off your first cup at ${C.NODE_NAME}.
Scan. Identify the Leak. Calibrate your Repair.`;
    return `https://wa.me/${lead.phone}?text=${encodeURIComponent(msg)}`;
  }
  // For runners who don't want to type a number: they message US (they choose to share)
  function selfWaLink(lead) {
    if (!C.BUSINESS_WA) return '';
    return `https://wa.me/${C.BUSINESS_WA}?text=${encodeURIComponent(`Hi Recup Station, send my Repair Manual. Code ${lead.code}`)}`;
  }

  function safeJSON(s, d) { try { return typeof s === 'string' ? JSON.parse(s || 'null') ?? d : (s ?? d); } catch { return d; } }
  function clearLocal() { store.set(K_LEADS, []); store.set(K_QUEUE, []); }

  function seedDemo(n = 30) {
    const names = ['Aina', 'Jason', 'Mei Ling', 'Hafiz', 'Priya', 'Daniel', 'Siti', 'Kelvin', 'Nurul', 'Arjun', 'Chloe', 'Irfan'];
    const src = ['ROADSIDE_IPAD', 'ROADSIDE_IPAD', 'DIAGNOSTIC_ONLINE', 'QR_STAND'];
    const cm = ['WHATSAPP', 'WHATSAPP', 'WHATSAPP', 'EMAIL', 'INSTAGRAM', 'NONE'];
    const all = store.get(K_LEADS, []);
    for (let i = 0; i < n; i++) {
      const s = src[i % src.length]; const squat = s === 'DIAGNOSTIC_ONLINE' ? ['SOLID', 'SHAKY', 'COLLAPSE'][i % 3] : '';
      const pain = C.PAINS[i % 7]; const cups = [0, 1, 1, 1, 2, 2, 3, 4, 5, 1][i % 10];
      const protocol = recommend({ squat, pain }); const hist = [];
      for (let c = 1; c <= cups; c++) { const pr = priceFor(protocol, c); hist.push({ n: c, ts: new Date().toISOString(), product: protocol, paid: pr.paid, units: pr.units }); }
      const method = cm[i % cm.length];
      all.push({
        id: 'DEMO' + i + Math.random().toString(36).slice(2, 5), code: newCode(), ts: new Date(Date.now() - i * 41 * 60000).toISOString(),
        source: s, name: names[i % names.length] + ' (demo)', contactMethod: method,
        phone: method === 'WHATSAPP' ? '6012000' + (1000 + i) : '', email: method === 'EMAIL' ? `demo${i}@mail.com` : '', instagram: method === 'INSTAGRAM' ? '@demo' + i : '',
        region: C.REGIONS[i % 5], frequency: C.FREQUENCY[i % 4], pain, archetype: s === 'DIAGNOSTIC_ONLINE' ? ['SPRINTER', 'TANK', 'OFFICE BODY'][i % 3] : '',
        squat, grade: squat ? GRADE[squat].grade : '', protocol, fuel: '',
        status: s === 'DIAGNOSTIC_ONLINE' && cups === 0 ? 'RESERVED' : 'CHECKED_IN', cups, history: JSON.stringify(hist),
        painFocus: cups >= 2 ? 'Knees / joints' : '', referral: cups >= 3 ? '@buddy' + i : '', goal: cups >= 4 ? 'Half marathon' : '', wearable: cups >= 5 ? 'Garmin' : '',
        manualSent: i % 3 ? 'YES' : '', notes: 'demo', updatedAt: new Date().toISOString(),
      });
    }
    store.set(K_LEADS, all);
  }

  return { submitLead, updateLead, stampCup, priceFor, loadLeads, findRunner, getByCode, flushQueue, waLink, selfWaLink, manualUrl, memberUrl, siteUrl,
           tierOf, nextTier, recommend, clearLocal, seedDemo, safeJSON, adminKey, setAdminKey, GRADE, store };
})();
