/* BeLIS – Cloud Function: Kennwort auf das Standardkennwort zurücksetzen
   Aufruf nur durch die Behördenleitung (Amt laut BeLIS-Personalakte, Stammdaten „Ämter Behördenleitung“). */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
admin.initializeApp();

const DOMAIN = 'belis-22d63.firebaseapp.com';
const slug = s => String(s || '').trim().toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .replace(/\s+/g, '-').replace(/[^a-z0-9._-]/g, '');
const mail = p => slug(p.nachname) + '@' + DOMAIN;
const csv = t => String(t || '').split(',').map(s => s.trim()).filter(Boolean);

exports.kennwortZuruecksetzen = onCall({ region: 'europe-west3' }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Nicht angemeldet.');
  const db = admin.firestore();
  const [mS, pS] = await Promise.all([db.doc('belis/meta').get(), db.doc('belis/personal').get()]);
  if (!mS.exists || !pS.exists) throw new HttpsError('failed-precondition', 'BeLIS-Datenbestand fehlt.');
  const meta = JSON.parse(mS.get('v'));
  const personal = JSON.parse(pS.get('v'));
  const bl = csv(meta.rollenBL), lw = csv(meta.rollenLW);
  const callerMail = String(req.auth.token.email || '').toLowerCase();

  const caller = personal.find(p => p.status !== 'ausgeschieden' && mail(p) === callerMail);
  if (!caller || !bl.includes(caller.dg) || (caller.acc && caller.acc.gesperrt))
    throw new HttpsError('permission-denied', 'Nur die Behördenleitung darf Kennwörter zurücksetzen.');

  const target = String((req.data && req.data.email) || '').toLowerCase();
  if (target === callerMail) throw new HttpsError('invalid-argument', 'Das eigene Kennwort bitte selbst ändern.');
  const tp = personal.find(p => p.status !== 'ausgeschieden' && mail(p) === target);
  if (!tp || !(bl.includes(tp.dg) || lw.includes(tp.dg)))
    throw new HttpsError('not-found', 'Zu dieser Kennung gibt es keinen BeLIS-Zugang.');

  const pw = String(meta.stdPw || '');
  if (pw.length < 6) throw new HttpsError('failed-precondition', 'Standardkennwort in den Stammdaten fehlt (mind. 6 Zeichen).');

  let user = null;
  try { user = await admin.auth().getUserByEmail(target); } catch (e) { user = null; }
  if (user) await admin.auth().updateUser(user.uid, { password: pw, disabled: false });
  else await admin.auth().createUser({ email: target, password: pw });
  return { ok: true, neu: !user };
});