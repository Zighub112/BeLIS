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

Authentication › **Einstellungen** › **Nutzeraktionen** › „Erstellen (Registrierung) aktivieren“ **eingeschaltet lassen**. Nur dann kann BeLIS neue Konten selbst anlegen. Unbefugte erhalten trotzdem keinen Datenzugriff – das regelt die Zugriffsliste (siehe Schritt 2).

## 2. Zugriffsregeln veröffentlichen

Firestore Database › **Regeln** › den Inhalt von `firestore.rules` einfügen › **Veröffentlichen**.

## 3. Hochladen

**Variante A – Firebase Hosting (empfohlen, feste Adresse `belis-22d63.web.app`)**
Voraussetzung: Node.js ist installiert (nodejs.org).

```
npm install -g firebase-tools
firebase login
cd belis-firebase
firebase deploy --only hosting,firestore
```

Damit werden die Seite **und** die Zugriffsregeln hochgeladen. (Ohne `--only …` würde Firebase auch die optionale Cloud Function hochladen wollen – das geht nur im Blaze-Tarif.)

**Variante B – ohne Installation**
Den Ordner `public` auf app.netlify.com/drop ziehen. Die Zugriffsregeln dann wie in Schritt 2 von Hand veröffentlichen.

## 4. Erste Anmeldung

1. Seite öffnen, mit **Lehmann** und dem Kennwort anmelden.
2. „Mandant einrichten“ bestätigen – die Datenbank wird mit dem Organisationsstand gefüllt.
3. Bisherige Daten übernehmen: In der alten BeLIS-Version (claude.ai) **Verwaltung › Datensicherung › Export** kopieren, in der neuen Version unter **Datensicherung › Import** einfügen.

## Führungskräfte und Zugänge

Alle Führungskräfte des höheren Dienstes (PR bis PP) haben Anspruch auf einen BeLIS-Zugang.

1. BeLIS › **Führungskräfte & Zugänge** › **Führungskraft erfassen** – die Person wird sofort in die Datenbank übernommen.
2. Direkt danach (oder später über **Zugang anlegen**): Anmeldekonto mit dem Standardkennwort. Der Datenzugriff wird automatisch freigegeben; bei der ersten Anmeldung muss ein eigenes Kennwort festgelegt werden.

Rollen: PP/PVP = Behördenleitung (Vollzugriff), LPD B3 = Leitung Wachbezirk, übrige hD = Führungskraft (Lesezugriff im eigenen Wachbezirk, Anträge, Termine, Aufgaben, Notizen).

**Sperren** entzieht den Zugriff vorübergehend. **Löschen** entfernt die Person vollständig und trägt ihr Anmeldekonto in die Löschliste (`zugang/geloescht`) ein. Das Konto wird dann automatisch aus Firebase Authentication entfernt:

- **mit Cloud Function (Blaze):** sofort, durch die Funktion `geloeschteKontenEntfernen`
- **ohne Cloud Function (Spark):** beim nächsten Anmeldeversuch der gelöschten Person – das Konto löscht sich dabei selbst. Bis dahin ist keine Anmeldung in BeLIS möglich.

Wird dieselbe Person später neu erfasst, nimmt BeLIS sie beim Anlegen des Zugangs wieder von der Löschliste.

### Umstellung auf Version 5.5.1 (einmalig)

Die Zugriffsregeln wurden um die Löschliste ergänzt. Den Inhalt von `firestore.rules` erneut in Firestore › **Regeln** veröffentlichen (oder `firebase deploy --only firestore`).

### Umstellung von Version 5.4.2 oder älter (einmalig)

Die Zugriffsregeln haben sich geändert. Einmal den Inhalt von `firestore.rules` in Firestore › **Regeln** einfügen und veröffentlichen (oder `firebase deploy --only firestore`). Danach als Lehmann oder Richter anmelden – BeLIS legt die Zugriffsliste an. Erst dann kann sich Ottermann wieder anmelden.

## Kennwort vergessen

In BeLIS: **Verwaltung › Benutzerverwaltung** › Person markieren › **Kennwort zurücksetzen**.
Das Kennwort wird auf das **Standardkennwort** gesetzt (Stammdaten, voreingestellt `Reuth2026`). Bei der nächsten Anmeldung muss die Person ein eigenes Kennwort festlegen.

Ohne die Cloud Function (siehe unten) zeigt BeLIS stattdessen die Schritte für die Firebase-Konsole an: Konto löschen und mit dem Standardkennwort neu anlegen.

### Kennwort-Zurücksetzen aus BeLIS einrichten (einmalig, optional)

Firebase erlaubt das Setzen fremder Kennwörter nur auf dem Server. Dafür gibt es die Cloud Function im Ordner `functions`.

1. Projekt auf den **Blaze-Tarif** umstellen (Firebase-Konsole › unten links „Upgrade“). Es wird ein Zahlungsmittel hinterlegt; bei dieser Nutzung bleibt es im kostenlosen Kontingent (0 €). Empfehlung: in der Google-Cloud-Abrechnung ein Budget-Limit mit Warnung bei z. B. 1 € setzen.
2. Im Ordner `belis-firebase`:
   ```
   cd functions
   npm install
   cd ..
   firebase deploy --only functions
   ```
3. Fertig. „Kennwort zurücksetzen“ funktioniert jetzt mit einem Klick, legt fehlende Konten gleich mit an, und beim Löschen einer Person wird auch deren Anmeldekonto entfernt.

Die Funktion prüft selbst, dass nur die Behördenleitung (Amt laut Personalakte) sie auslösen darf und nur Konten mit BeLIS-Zugang zurückgesetzt werden.
