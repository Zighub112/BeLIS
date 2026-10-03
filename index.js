/* BeLIS – Cloud Functions (optional, Blaze-Tarif)
   kennwortZuruecksetzen: Kennwort auf das Standardkennwort setzen bzw. Konto anlegen
   kontoLoeschen:         Anmeldekonto einer gelöschten Person entfernen
   Aufruf jeweils nur durch die Behördenleitung (Amt laut BeLIS-Personalakte). */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
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

exports.kontoLoeschen = onCall({ region: 'europe-west3' }, async (req) => {
  const d = await laden();
  const callerMail = await pruefeBL(req, d);
  const target = String((req.data && req.data.email) || '').toLowerCase();
  if (!target.endsWith('@' + DOMAIN)) throw new HttpsError('invalid-argument', 'Ungültige Kennung.');
  if (target === callerMail) throw new HttpsError('invalid-argument', 'Das eigene Konto kann nicht gelöscht werden.');
  if (d.personal.some(p => p.status !== 'ausgeschieden' && mail(p) === target))
    throw new HttpsError('failed-precondition', 'Die Person ist noch im Personalbestand – zuerst in BeLIS löschen.');
  try { const u = await admin.auth().getUserByEmail(target); await admin.auth().deleteUser(u.uid); }
  catch (e) { if (e.code !== 'auth/user-not-found') throw new HttpsError('internal', e.message); }
  return { ok: true };
});