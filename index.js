/* BeLIS – Cloud Functions (optional, Blaze-Tarif)
   kennwortZuruecksetzen: Kennwort auf das Standardkennwort setzen bzw. Konto anlegen
   geloeschteKontenEntfernen: Anmeldekonten gelöschter Personen automatisch entfernen
   Aufruf jeweils nur durch die Behördenleitung (Amt laut BeLIS-Personalakte). */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
admin.initializeApp();

const DOMAIN = 'belis-22d63.firebaseapp.com';
const slug = s => String(s || '').trim().toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .replace(/\s+/g, '-').replace(/[^a-z0-9._-]/g, '');
const mail = p => slug(p.nachname) + '@' + DOMAIN;
const csv = t => String(t || '').split(',').map(s => s.trim()).filter(Boolean);

async function laden() {
  const db = admin.firestore();
  const [mS, pS] = await Promise.all([db.doc('belis/meta').get(), db.doc('belis/personal').get()]);
  if (!mS.exists || !pS.exists) throw new HttpsError('failed-precondition', 'BeLIS-Datenbestand fehlt.');
  const meta = JSON.parse(mS.get('v'));
  const personal = JSON.parse(pS.get('v'));
  const hd = new Set(String(meta.raengeTxt || '').split('\n').map(l => l.split(';')).filter(c => (c[3] || '').trim() === 'hD').map(c => c[0].trim()));
  const bl = csv(meta.rollenBL), lw = csv(meta.rollenLW);
  const zugang = p => bl.includes(p.dg) || lw.includes(p.dg) || (meta.fkZugang !== false && hd.has(p.dg));
  return { meta, personal, bl, zugang };
}
async function pruefeBL(req, d) {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Nicht angemeldet.');
  const callerMail = String(req.auth.token.email || '').toLowerCase();
  const caller = d.personal.find(p => p.status !== 'ausgeschieden' && mail(p) === callerMail);
  if (!caller || !d.bl.includes(caller.dg) || (caller.acc && caller.acc.gesperrt))
    throw new HttpsError('permission-denied', 'Nur die Behördenleitung darf diese Funktion nutzen.');
  return callerMail;
}

exports.kennwortZuruecksetzen = onCall({ region: 'europe-west3' }, async (req) => {
  const d = await laden();
  const callerMail = await pruefeBL(req, d);
  const target = String((req.data && req.data.email) || '').toLowerCase();
  if (target === callerMail) throw new HttpsError('invalid-argument', 'Das eigene Kennwort bitte selbst ändern.');
  const tp = d.personal.find(p => p.status !== 'ausgeschieden' && mail(p) === target);
  if (!tp || !d.zugang(tp)) throw new HttpsError('not-found', 'Zu dieser Kennung gibt es keinen BeLIS-Zugang.');
  const pw = String(d.meta.stdPw || '');
  if (pw.length < 6) throw new HttpsError('failed-precondition', 'Standardkennwort in den Stammdaten fehlt (mind. 6 Zeichen).');
  let user = null;
  try { user = await admin.auth().getUserByEmail(target); } catch (e) { user = null; }
  if (user) await admin.auth().updateUser(user.uid, { password: pw, disabled: false });
  else await admin.auth().createUser({ email: target, password: pw });
  return { ok: true, neu: !user };
});

/* Automatisch: Sobald BeLIS eine gelöschte Person in die Löschliste (zugang/geloescht) einträgt,
   wird ihr Anmeldekonto aus Firebase Authentication entfernt. Aktive Zugänge werden nie gelöscht. */
exports.geloeschteKontenEntfernen = onDocumentWritten({ document: 'zugang/geloescht', region: 'europe-west3' }, async (event) => {
  const after = event.data && event.data.after;
  if (!after || !after.exists) return;
  const emails = (after.get('emails') || []).map(e => String(e).toLowerCase());
  if (!emails.length) return;
  const lS = await admin.firestore().doc('zugang/liste').get();
  const aktiv = new Set(((lS.exists && lS.get('alle')) || []).map(e => String(e).toLowerCase()));
  const erledigt = [];
  for (const e of emails) {
    if (!e.endsWith('@' + DOMAIN) || aktiv.has(e)) continue;
    try { const u = await admin.auth().getUserByEmail(e); await admin.auth().deleteUser(u.uid); }
    catch (x) { if (x.code !== 'auth/user-not-found') { console.error(e, x); continue; } }
    erledigt.push(e);
  }
  if (erledigt.length) await after.ref.update({
    emails: admin.firestore.FieldValue.arrayRemove(...erledigt),
    zuletztEntfernt: admin.firestore.FieldValue.serverTimestamp()
  });
});