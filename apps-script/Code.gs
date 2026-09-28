/**
 * RECUP STATION // SHARED DATABASE (Google Sheet + Apps Script)  v2
 * ---------------------------------------------------------------
 * Lets the roadside iPad, the QR stand and The Diagnostic (IG link) land in ONE sheet.
 *
 * SETUP (5 min):
 * 1. Create a Google Sheet named "Recup Station Leads".
 * 2. Extensions → Apps Script. Delete the sample code, paste this whole file.
 * 3. Change ADMIN_KEY below to your own secret word. Save.
 * 4. Deploy → New deployment → type "Web app"
 *      Execute as: Me      Who has access: Anyone
 *    (Google will ask you to authorise – allow Sheets + Gmail.)
 * 5. Copy the Web app URL (ends in /exec) → assets/recup-core.js → SHEET_ENDPOINT.
 * 6. On the God Terminal, enter the same ADMIN_KEY once when asked.
 * After editing this script: Deploy → Manage deployments → Edit → Version: New → Deploy.
 *
 * PRIVACY: the public link can only (a) add a runner, (b) look up ONE runner's
 * code / cups / first name. The full list with phone numbers needs ADMIN_KEY.
 */

const ADMIN_KEY = 'change-me-recup';      // <-- CHANGE THIS
const SHEET_NAME = 'Leads';
const SITE_URL = 'https://joeycoachie.github.io/recup-station-/';     // live site (GitHub Pages)
const PUBLIC_FIELDS = ['id', 'code', 'name', 'protocol', 'grade', 'status', 'cups', 'history', 'region',
                       'painFocus', 'referral', 'goal', 'wearable', 'source', 'ts', 'updatedAt'];

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) { sh = ss.insertSheet(SHEET_NAME); sh.appendRow(['id']); sh.setFrozenRows(1); }
  return sh;
}
function headers_(sh) { return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]; }
function ensureCols_(sh, keys) {
  const h = headers_(sh);
  keys.forEach(k => { if (h.indexOf(k) === -1) { h.push(k); sh.getRange(1, h.length).setValue(k).setFontWeight('bold'); } });
  return h;
}
function rows_(sh) {
  const v = sh.getDataRange().getValues(); const h = v.shift();
  return v.map((r, i) => { const o = { _row: i + 2 }; h.forEach((k, j) => o[k] = r[j] instanceof Date ? r[j].toISOString() : String(r[j])); return o; });
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function pick_(o, f) { const r = {}; f.forEach(k => r[k] = k === 'name' ? String(o.name || '').split(' ')[0] : o[k]); return r; }

function doPost(e) {
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const body = JSON.parse(e.postData.contents);
    const sh = sheet_();
    if (body.action === 'create' && body.lead) {
      const h = ensureCols_(sh, Object.keys(body.lead));
      if (rows_(sh).some(r => r.id === body.lead.id)) return json_({ ok: true });
      sh.appendRow(h.map(k => body.lead[k] !== undefined ? body.lead[k] : ''));
      if (body.lead.contactMethod === 'EMAIL' && body.lead.email) sendManual_(body.lead);
      return json_({ ok: true });
    }
    if (body.action === 'update' && body.id) {
      const h = ensureCols_(sh, Object.keys(body.patch || {}));
      const r = rows_(sh).find(x => x.id === body.id);
      if (!r) return json_({ ok: false, error: 'not found' });
      Object.keys(body.patch).forEach(k => sh.getRange(r._row, h.indexOf(k) + 1).setValue(body.patch[k]));
      return json_({ ok: true });
    }
    return json_({ ok: false, error: 'unknown action' });
  } catch (err) { return json_({ ok: false, error: String(err) }); }
  finally { lock.releaseLock(); }
}

function doGet(e) {
  const p = e.parameter || {}; const all = rows_(sheet_());
  if (p.mode === 'all') {
    if (p.key !== ADMIN_KEY) return json_({ ok: false, error: 'bad key' });
    return json_({ ok: true, leads: all.map(r => { delete r._row; return r; }) });
  }
  if (p.mode === 'find') {
    const q = String(p.q || '').trim().toLowerCase(); const d = q.replace(/\D/g, '');
    if (q.length < 3) return json_({ ok: true, leads: [] });
    const hit = all.filter(l => String(l.code).toLowerCase() === q || String(l.code).toLowerCase() === 'rs-' + q
      || (d.length >= 6 && String(l.phone).endsWith(d.replace(/^0/, '')))
      || String(l.email).toLowerCase() === q || String(l.instagram).toLowerCase() === '@' + q.replace(/^@/, '')
      || String(l.name).toLowerCase().indexOf(q) > -1).slice(0, 8);
    return json_({ ok: true, leads: hit.map(l => pick_(l, PUBLIC_FIELDS)) });
  }
  return json_({ ok: true });
}

// Free auto-delivery for runners who chose EMAIL
function sendManual_(lead) {
  const base = SITE_URL || '';
  const manual = base ? base + 'repair-manual.html?c=' + lead.code : '(ask at the booth)';
  const card = base ? base + 'member.html?c=' + lead.code : '';
  MailApp.sendEmail({
    to: lead.email,
    subject: 'Your Runner\'s Repair Manual · Recup Station',
    htmlBody: '<p>Hi ' + String(lead.name).split(' ')[0] + ',</p>' +
      '<p>Your member code: <b>' + lead.code + '</b></p>' +
      '<p><a href="' + manual + '">Open your Runner\'s Repair Manual</a></p>' +
      (card ? '<p><a href="' + card + '">Your Ascension card: track your cups & rewards</a></p>' : '') +
      '<p>Show your code at the Glenhill Saujana node for 10% off your first cup.</p>' +
      '<p>Scan. Identify the Leak. Calibrate your Repair.<br>— Recup Station</p>'
  });
}
