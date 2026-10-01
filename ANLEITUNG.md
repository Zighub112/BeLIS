# BeLIS auf Firebase – Einrichtung

Projekt: **belis-22d63**

## 1. Konten anlegen

Firebase-Konsole › **Authentication** › **Users** › **Nutzer hinzufügen**.
Die E-Mail-Adresse ist nur die interne Anmeldekennung. Angemeldet wird in BeLIS mit dem **Nachnamen**.

| Person | E-Mail (Anmeldekennung) |
|---|---|
| Lehmann | `lehmann@belis-22d63.firebaseapp.com` |
| Richter | `richter@belis-22d63.firebaseapp.com` |
| Ottermann | `ottermann@belis-22d63.firebaseapp.com` |

Kennwort: mindestens 8 Zeichen, Buchstaben und Ziffern.

Empfohlen: Authentication › **Einstellungen** › **Nutzeraktionen** › „Erstellen (Registrierung) aktivieren“ **ausschalten**. Dann kann sich niemand selbst ein Konto anlegen.

## 2. Zugriffsregeln veröffentlichen

Firestore Database › **Regeln** › den Inhalt von `firestore.rules` einfügen › **Veröffentlichen**.

## 3. Hochladen

**Variante A – Firebase Hosting (empfohlen, feste Adresse `belis-22d63.web.app`)**
Voraussetzung: Node.js ist installiert (nodejs.org).

```
npm install -g firebase-tools
firebase login
cd belis-firebase
firebase deploy
```

`firebase deploy` lädt die Seite **und** die Zugriffsregeln hoch.

**Variante B – ohne Installation**
Den Ordner `public` auf app.netlify.com/drop ziehen. Die Zugriffsregeln dann wie in Schritt 2 von Hand veröffentlichen.

## 4. Erste Anmeldung

1. Seite öffnen, mit **Lehmann** und dem Kennwort anmelden.
2. „Mandant einrichten“ bestätigen – die Datenbank wird mit dem Organisationsstand gefüllt.
3. Bisherige Daten übernehmen: In der alten BeLIS-Version (claude.ai) **Verwaltung › Datensicherung › Export** kopieren, in der neuen Version unter **Datensicherung › Import** einfügen.

## Neue Führungskraft

1. In BeLIS die Person mit passendem Amt (PP, PVP, LPD B3) im Personalverzeichnis bzw. über „Führungskraft erfassen“ anlegen.
2. Benutzerverwaltung › **Zugang einrichten** zeigt die Anmeldekennung.
3. Konto in Firebase anlegen, in BeLIS „Kennwortwechsel verlangen“ setzen.
4. **Zugriffsregeln erzeugen** und in Firestore › Regeln veröffentlichen.

## Kennwort vergessen

Firebase-Konsole › Authentication › Konto löschen und mit neuem Kennwort neu anlegen (gleiche E-Mail). In BeLIS „Kennwortwechsel verlangen“ setzen.
