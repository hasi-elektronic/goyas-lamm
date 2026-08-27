# Goya´s Lamm Horrheim — Website

Statische Website für das Restaurant **Goya´s Lamm** im Landidyll Hotel Lamm,
Klosterbergstraße 45, 71665 Vaihingen an der Enz — Horrheim.

Umsetzung: [Hasi Elektronic](https://www.hasi-elektronic.de)

## Stack

- Statisches HTML/CSS/JS, keine Build-Pipeline, keine Abhängigkeiten zur Laufzeit
- Hosting: **Cloudflare Pages** (Projekt `goyas-lamm`, Account „Hasi Elektronic“)
- Schriften (Inter, Playfair Display) **selbst gehostet** → keine Google-Fonts-Verbindung (DSGVO)
- Reservierung: **eigenes System** — Formular im Seiten-Design, Cloudflare Pages Functions + D1 (Region EU-West)
- Karte: OpenStreetMap-Embed, `loading="lazy"`, keine Cookies
- Strukturierte Daten: `schema.org/Restaurant` inkl. Öffnungszeiten und Geo-Koordinaten

## Struktur

```
public/
  index.html            # Startseite (Hero, Signature, Steak, Speisekarte, Inhaber, Reservierung, Kontakt)
  impressum.html · datenschutz.html
  robots.txt · sitemap.xml · site.webmanifest · _headers · _routes.json
  assets/               # Logo, Icons, Schriften (woff2), Bilder, legal.css
functions/              # Cloudflare Pages Functions (Server-Code)
  _middleware.js        # spielt die Speisekarte aus der Datenbank in die statische Seite ein
  _lib/core.js          # Öffnungszeiten, Slots, Kapazität, Validierung, Zeitzone
  _lib/auth.js          # Passwort-Hash (PBKDF2), Sitzung, Rollen und Rechte
  _lib/ui.js            # gemeinsames Layout, Navigation, Tabellen, Balken
  _lib/mail.js          # E-Mail-Vorlagen + Cloudflare Email Sending
  _lib/karte.js         # Speisekarte aus D1 lesen und rendern
  _lib/gaeste.js        # Gästekartei (Historie, Notiz, No-Show)
  _lib/zeit.js          # Arbeitszeit: Runden, Zuschlagsfenster, Monatssummen, Lohn, Trinkgeld
  _lib/chefpin.js       # zweite Tür vor den Seiten mit Löhnen
  _lib/book.js          # gemeinsame Buchungslogik für Web und Panel
  api/slots.js          # GET  /api/slots?date=…&guests=…  bzw. ?month=YYYY-MM
  api/reservierung.js   # POST /api/reservierung
  api/warteliste.js     # POST /api/warteliste  (wenn ein Tag voll ist)
  storno.js             # GET/POST /storno?token=…   (Gast storniert selbst)
  admin/                # Admin-Panel (Cookie-Login, Rollen)
    _middleware.js      #   Sitzung, Seitenrechte, Schreibrechte
    login.js · logout.js
    index.js            #   Übersicht mit Kennzahlen
    tag.js · kalender.js · neu.js · suche.js · zeiten.js
    r/[id].js           #   Detail: bearbeiten, stornieren, Mail erneut senden
    tische.js           #   Tische anlegen, Platzzahl ändern → bestimmt die Kapazität
    karte.js            #   Speisekarten-Editor (Reiter, Gruppen, Gerichte, Preise)
    zettel.js           #   Küchenzettel zum Ausdrucken
    warteliste.js       #   Anfragen für ausgebuchte Tage
    auswertung.js       #   Statistik: Wochentag, Uhrzeit, Verlauf, Gruppen, Vorlauf
    personal.js         #   Mitarbeiter anlegen, PIN vergeben
    stempel.js          #   Stempeluhr (PIN am Tablet)
    arbeitszeit.js      #   Zeiten von Hand erfassen und korrigieren
    zeitzettel.js       #   Monatsübersicht je Mitarbeiter zum Unterschreiben
    trinkgeld.js        #   Topf je Abend, nach Stunden verteilt
    pin.js              #   Chef-PIN eingeben (Sperre vor den Geldseiten)
    benutzer.js         #   Panel-Zugänge und Rollen
migrations/0001…0010    # Struktur, Speisekarten-Grunddaten, Lohn und Trinkgeld
```

## Reservierungssystem

Kein Fremdanbieter, kein Widget — das Formular gehört zur Seite und schreibt direkt in unsere
eigene Datenbank.

| Regel | Wert | wo geändert |
|---|---|---|
| Öffnungszeiten / Ruhetag | Mo, Di, Do–Sa 17–22 · So 12–20 · Mi zu | `functions/_lib/core.js` → `HOURS` |
| Zeitraster | 30 Minuten | `SLOT_MINUTES` |
| Letzte Reservierung | 60 Min. vor Küchenschluss | `LAST_SLOT_BEFORE` |
| Vorlauf am selben Tag | 2 Stunden | `LEAD_MINUTES` |
| Vorausbuchung | 90 Tage | `MAX_DAYS_AHEAD` |
| Online max. Personen | 10 (darüber: Telefon) | `MAX_GUESTS_ONLINE` |
| Plätze je Zeitfenster | 24 | Variable `RES_SEATS_PER_SLOT` |
| Reservierungen je IP / 24 h | 5 | `RATE_LIMIT_PER_DAY` |

**Einzelne Tage schließen** (Urlaub, Feiertag, Betriebsfeier):

```bash
wrangler d1 execute goyas-lamm-db --remote \
  --command "INSERT INTO closures (day,reason) VALUES ('2026-12-24','Heiligabend')"
```

**Kapazität für einen Tag abweichend setzen:**

```bash
wrangler d1 execute goyas-lamm-db --remote \
  --command "INSERT INTO capacity_overrides (day,seats_slot) VALUES ('2026-12-31',12)"
```

**Datenschutz:** D1-Datenbank liegt in der EU (Region `weur`), es werden keine Cookies gesetzt,
statt der IP-Adresse wird nur ein gesalzener Hash gespeichert, und Reservierungen älter als
sechs Monate werden bei jeder neuen Buchung automatisch gelöscht.

## Umgebungsvariablen

Gesetzt am Cloudflare-Pages-Projekt (Settings → Environment variables):

| Variable | Zweck |
|---|---|
| `ADMIN_USER` / `ADMIN_PASS` | Zugang zu `/admin` (Anmeldeformular) — **secret** |
| `IP_SALT` | Salt für den IP-Hash — **secret** |
| `CF_EMAIL_TOKEN` | Cloudflare-API-Token mit **Email Sending: Edit** — **secret**, noch nicht gesetzt |
| `MAIL_ACCOUNT_ID` | Cloudflare-Account-ID für den REST-Versand |
| `MAIL_FROM` | Absender, z. B. `Goya´s Lamm <reservierung@lammm.de>` |
| `RES_HOUSE_EMAIL` | Wohin die Benachrichtigung an die Küche geht |
| `RES_SEATS_PER_SLOT` | Plätze je Zeitfenster |
| `SITE_URL` | optional; ohne Angabe wird die aufgerufene Domain verwendet |

E-Mail läuft über den **Cloudflare Email Service** — kein Drittanbieter, derselbe
Auftragsverarbeiter wie das Hosting. `functions/_lib/mail.js` nutzt zuerst ein
`send_email`-Binding (`env.EMAIL`), falls vorhanden, sonst die REST-API
`POST /accounts/{id}/email/sending/send`.

Voraussetzungen: Die **Absenderdomain muss in Cloudflare liegen** und unter
*Compute → Email Service → Email Sending* onboarded sein (Cloudflare legt dafür SPF-,
DKIM-, DMARC- und Bounce-Records an). Email Sending setzt den **Workers-Paid-Plan** voraus.

Solange nichts eingerichtet ist, funktioniert alles weiter — es gehen nur keine E-Mails raus,
die Reservierung steht trotzdem in `/admin`. Das Panel weist oben darauf hin.

## Admin-Panel

`/admin` — Anmeldung über Formular, die Sitzung hält 30 Tage (signiertes HttpOnly-Cookie,
kein Passwort im Browser gespeichert). Für Küche und Service auf dem Tablet gebaut.

Nach **8 Fehlversuchen je IP-Adresse** ist die Anmeldung **15 Minuten gesperrt**
(Tabelle `login_attempts`, gespeichert wird nur der gesalzene IP-Hash). Eine erfolgreiche
Anmeldung setzt den Zähler zurück.

| Seite | Wofür |
|---|---|
| Übersicht | Kennzahlen heute / morgen / 7 Tage, Liste für heute und die nächsten Tage |
| Kalender | Monatsraster mit Gästezahl je Tag, Ruhetage und Schließtage markiert |
| Tagesansicht | Auslastung je Zeitfenster als Balken; Klick legt dort eine Reservierung an |
| Neue Reservierung | Telefon- und Laufkundschaft eintragen, E-Mail optional, Bestätigung wahlweise |
| Schließtage | Urlaub und Feiertage sperren, Platzzahl für einzelne Tage abweichend setzen |
| Suche | Name, Telefonnummer oder E-Mail, auch vergangene Termine |
| Detailseite | Bearbeiten, stornieren (wahlweise mit Gastbenachrichtigung), reaktivieren, Bestätigung erneut senden |
| Tische | Tische anlegen, Platzzahl ändern, deaktivieren — **daraus errechnet sich die Kapazität** |
| Speisekarte | Reiter, Gruppen, Gerichte und Preise pflegen; die Website übernimmt sie sofort |
| Küchenzettel | Tagesliste zum Ausdrucken, groß gesetzt, ohne Navigation |
| Warteliste | Anfragen für ausgebuchte Tage, mit Kontakt und Status |
| Auswertung | Wochentag, Uhrzeit, Verlauf, Gruppengrößen, Vorlauf, No-Show — ohne Umsatzschätzungen |
| Personal · Stempeluhr · Arbeitszeit · Zeitzettel · Trinkgeld | Arbeitszeiterfassung und Lohn, siehe unten |
| Benutzer | Panel-Zugänge und Rollen |

Mit der Option **„Über die Kapazität hinaus"** lassen sich Zusatztische, Schließtage und sogar
Ruhetage buchen — für geschlossene Gesellschaften und Sonderöffnungen.

### Rollen

Rechte werden zentral in `functions/admin/_middleware.js` geprüft, nicht in den einzelnen
Seiten — eine vergessene Prüfung kann so keine Lücke aufreißen.

| Rolle | Darf |
|---|---|
| `chef` | alles — Reservierungen, Speisekarte, Tische, Personal, Arbeitszeit, Benutzer |
| `service` | Reservierungen pflegen, Warteliste, Tagesliste, Küchenzettel, Auswertung; keine Speisekarte, keine Tische, kein Personal |
| `demo` | nur ansehen; Gastnamen abgekürzt, keine Telefonnummern, Wartelisten- und Personalseiten gesperrt |

Passwörter liegen als **PBKDF2-HMAC-SHA256 mit 100 000 Runden** in der Tabelle `users`,
nie im Klartext. `ADMIN_USER`/`ADMIN_PASS` bleiben als Rückfallzugang bestehen, falls die
Datenbank einmal leer ist.

### Meldung bei neuen Reservierungen

Kommt online eine Reservierung herein, meldet sich das Panel von selbst: Konfetti, ein
springendes Lamm und eine Karte mit Name, Tag, Uhrzeit und Personenzahl. Nach acht Sekunden
schließt sie sich, ein Tippen geht auch. Grund für das Ganze ist nüchtern — das Tablet steht
den ganzen Abend auf derselben Seite, ohne Meldung fällt eine Buchung erst auf, wenn jemand
nachsieht.

- Das Panel fragt alle 15 Sekunden `/admin/melder` — nur solange die Seite sichtbar ist.
  Gepollt statt dauerhaft verbunden, weil Pages Functions zustandslos sind; eine offene
  Verbindung bräuchte Durable Objects und würde jeden WLAN-Aussetzer nicht überleben.
- **Nur Buchungen des Gastes** (`source = 'web'`) und neue Wartelisten-Einträge melden sich.
  Was das Personal selbst einträgt, bleibt still.
- **Beim Öffnen des Panels werden die letzten 20 Minuten nachgeholt** (`?start=1`) — sonst
  ginge der häufigste Fall verloren: Gast bucht, erst danach schaut jemand ins Panel.
  Welche Meldungen schon gezeigt wurden, merkt sich **jedes Gerät selbst** (`localStorage`,
  die letzten 40 Kennungen). Kein doppeltes Melden beim Neuladen — aber Küchentablet und
  Handy bekommen beide Bescheid. Lag das Tablet länger als eine Stunde im Standby, wird
  nichts nachgemeldet.
- **Ton** ist je Gerät abschaltbar (Lautsprecher-Schalter im Kopf, Einstellung im Browser
  gespeichert). Die Fanfare wird per Web Audio erzeugt — keine Tondatei.
- `prefers-reduced-motion` schaltet Konfetti und Animation ab, die Meldung bleibt.
- Für die Demo-Rolle sind Gastname abgekürzt und die Anmerkung leer.

Zum Ausprobieren ohne echten Gast: der Knopf **„Meldung testen"** unten auf der Übersicht,
`/admin?probe=1`, oder in der Konsole `goyaProbe()` bzw. `goyaProbe('warteliste')`.

### Arbeitszeiterfassung

Zwei Wege, dasselbe Ziel: **Stempeluhr** (Mitarbeiter tippt am Tablet seine PIN, kommt/geht)
oder **Eintrag von Hand** durch den Inhaber. Die Pause wird beim Gehen aus einer Liste
in **Fünfer-Schritten** (0–90 Minuten) gewählt — dieselbe Stufung wie die Abrechnung, damit auch
eine Pause von 20 oder 25 Minuten ehrlich eintragbar ist. Daraus entstehen Monatssummen je Mitarbeiter und
ein CSV-Export für den Steuerberater.

Gebaut nach **§ 17 MiLoG**: Beginn, Ende und Dauer werden festgehalten, innerhalb von sieben
Tagen erfassbar, zwei Jahre aufzubewahren. Sonntags- und Nachtstunden (20–6 Uhr) werden nach
**§ 3b EStG** getrennt ausgewiesen, damit der Steuerberater die Zuschläge sauber rechnen kann.

Das Modul ist bewusst **keine Buchhaltung** und heißt auch nirgends so — es erfasst Zeiten und
gibt sie weiter. Die Lohnabrechnung macht der Steuerberater.

Offene Schichten werden **nicht automatisch geschlossen**. Wer das Ausstempeln vergisst,
bekommt einen Hinweis im Panel; eine erfundene Endzeit wäre eine Fälschung eines gesetzlich
vorgeschriebenen Nachweises.

#### Rundung

Abgerechnet wird auf **5 Minuten**, kaufmännisch zur nächsten Stufe: 5:16 wird 5:15, 5:18 wird
5:20. **Die gestempelten Zeiten bleiben unverändert gespeichert** — sie sind die Aufzeichnung,
die Rundung ist nur die Rechengrundlage. Im Panel und im CSV stehen beide Werte nebeneinander.

Bewusst *zur nächsten* Stufe und nicht ab- oder aufgerundet: Wer den Beginn hoch und das Ende
herunter rundet, kürzt systematisch die Arbeitszeit. Das ist arbeitsrechtlich unwirksam und beim
Zoll ein Fehlbetrag, kein Rundungsfehler.

Passend dazu laufen die **Uhrzeitfelder in Fünfer-Schritten** (`step="300"`). Eine Ausnahme, und
die ist wichtig: Steht in einer Zeile eine gestempelte Zeit wie `17:07`, bleibt genau dieses Feld
minutengenau. Mit `step="300"` würde der Browser den Wert als ungültig ablehnen und das Speichern
der ganzen Zeile blockieren — und die gestempelte Zeit darf nicht angetastet werden, sie ist die
Aufzeichnung. Geregelt in `schritt()` in `functions/admin/arbeitszeit.js`.

#### Lohn

Je Mitarbeiter lässt sich ein **Stundenlohn** hinterlegen; daraus rechnet das Panel den
Monatsbetrag. Beträge stehen überall als ganze **Cent** in Integer-Spalten — Fließkommazahlen
laufen bei Monatssummen sichtbar auseinander.

| Grenze | Wert | Wirkung |
|---|---|---|
| Gesetzlicher Mindestlohn | 13,90 € (2026), ab 2027 14,60 € | Warnung, wenn der Stundenlohn darunter liegt |
| Minijob-Grenze | 603 € im Monat (2026) | Warnung, wenn der Monatsbetrag darüber liegt |

Beide Werte stehen als Konstanten in `functions/_lib/zeit.js` und müssen beim Jahreswechsel
angepasst werden.

**Das ist eine Bruttoschätzung, keine Abrechnung**: Stunden mal Stundenlohn, ohne Steuern, ohne
Sozialabgaben, ohne Zuschläge für Sonntag und Nacht. Was ausgezahlt wird, rechnet der
Steuerberater.

#### Trinkgeld

Der **Topf eines Abends** wird eingetragen und nach den gearbeiteten Minuten dieses Abends
verteilt. Gespeichert ist nur die Summe; die Aufteilung wird bei jedem Aufruf neu gerechnet —
ändert sich später eine Schicht, stimmt sie automatisch wieder. Offene Schichten zählen nicht mit.
Der Rundungsrest geht an den mit der längsten Schicht, damit die Summe der Anteile exakt dem
Topf entspricht.

Steuerlich ist der Unterschied wichtig und **nicht** Sache des Panels: Trinkgeld, das ein Gast
einem Mitarbeiter **direkt** gibt, ist nach § 3 Nr. 51 EStG steuerfrei. Was erst ins Haus geht und
von dort verteilt wird (Tronc) — also genau das, was diese Seite abbildet — kann steuerpflichtiger
Arbeitslohn sein. Die Liste gehört deshalb zum Steuerberater.

#### Chef-PIN

Damit die Stempeluhr läuft, bleibt das Küchentablet dauerhaft als Chef angemeldet. Ohne zweite
Sperre könnte dort jeder auf „Personal" tippen und die Stundenlöhne der Kollegen lesen — die
Rollen helfen nicht, es ist dieselbe Anmeldung.

Ist unter `/admin/personal` eine **Chef-PIN** hinterlegt, fragt das Panel vor `/admin/personal`,
`/admin/arbeitszeit`, `/admin/zeitzettel`, `/admin/trinkgeld` und `/admin/benutzer` danach und
schaltet dann **20 Minuten** frei (eigenes signiertes HttpOnly-Cookie). Die Stempeluhr bleibt
frei, sonst kann das Team nicht mehr stempeln. Nach **5 Fehlversuchen** ist die Eingabe
**10 Minuten** gesperrt.

Ohne hinterlegte PIN ändert sich nichts — die Sperre schaltet sich erst ein, wenn eine vergeben
wird. Die PIN wird nur als Hash gespeichert; vergessen heißt: in der Datenbank zurücksetzen
(`DELETE FROM settings WHERE k='chef_pin'`).

### Speisekarte

Die Karte liegt in D1 (`menu_tabs`, `menu_groups`, `menu_items`, 132 Gerichte). Ein
`_middleware.js` im Wurzelverzeichnis spielt sie beim Ausliefern per `HTMLRewriter` in die
statische `index.html` ein — dadurch bleibt sie für Suchmaschinen im Quelltext.

**Fällt die Datenbank aus, bleibt die in `index.html` hinterlegte Karte stehen.** Die Seite
kann nie leer ausgeliefert werden.

## Deployment

Automatisch bei jedem Push auf `main` über GitHub Actions.
Benötigte Repository-Secrets:

| Secret | Wert |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare-Token mit Pages-Edit-Rechten |
| `CLOUDFLARE_ACCOUNT_ID` | Account-ID „Hasi Elektronic“ |

Manuell:

```bash
npm install -g wrangler
export CLOUDFLARE_API_TOKEN=...
export CLOUDFLARE_ACCOUNT_ID=...
wrangler pages deploy public --project-name=goyas-lamm --branch=main
```

## Sicherung

Es gibt **zwei voneinander unabhängige Netze**:

1. **Dieses Repository** — der komplette Code mit Verlauf. Es enthält bewusst **keine
   Zugangsdaten und keine Gästedaten**; beides ist in `.gitignore` ausgeschlossen.
2. **Cloudflare D1 Time Travel** — jede D1-Datenbank lässt sich ohne Vorbereitung auf einen
   beliebigen Zeitpunkt der **letzten 30 Tage** zurückholen:

```bash
wrangler d1 time-travel info goyas-lamm-db
wrangler d1 time-travel restore goyas-lamm-db --timestamp=2026-08-26T20:00:00Z
```

Zusätzlich wird von Hand ein vollständiger Export gezogen
(`wrangler d1 export goyas-lamm-db --remote --output=…`). Dieser Export enthält **Namen,
Telefonnummern und E-Mail-Adressen von Gästen** — er gehört nicht in dieses Repository und
nicht in eine unverschlüsselte Mail.

## Offene Punkte

- [ ] **In der Produktion steht nur ein Tisch mit 4 Plätzen** — dadurch bekommen Gruppen ab
      5 Personen online keine freie Zeit angezeigt. Vor dem Domain-Umzug echte Tische unter
      `/admin/tische` eintragen oder den einen löschen (dann greift der Rückfallwert 24)
- [ ] `ADMIN_PASS` ändern, bevor der Kunde den Zugang bekommt
- [ ] Impressum: Rechtsform, USt-IdNr./Steuernummer, erteilende Behörde ergänzen (im Impressum gelb markiert)
- [ ] Custom Domain `lammm.de` auf Cloudflare Pages umstellen (aktuell One.com Web Editor)
- [ ] Original-Logodatei (Vektor oder hochauflösendes PNG) vom Kunden einholen und `assets/logo-*.png` ersetzen
- [ ] Echte Fotos vom Restaurant ergänzen bzw. die generierten Bilder schrittweise ersetzen
- [ ] Absenderdomain in Cloudflare Email Sending onboarden und `CF_EMAIL_TOKEN` setzen,
      damit Bestätigungsmails rausgehen (`lammm.de` liegt noch bei One.com)
- [ ] Mit dem Kunden klären, ob resmio abgeschaltet wird — zwei Reservierungsbücher
      parallel führen zu Doppelbelegungen
- [ ] Rechtstexte vor breiter Bewerbung anwaltlich prüfen lassen
