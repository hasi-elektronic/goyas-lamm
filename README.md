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
  index.html            # Startseite (Hero, Konzept, Steak, Speisekarte, Galerie, Reservierung, Kontakt)
  impressum.html · datenschutz.html
  robots.txt · sitemap.xml · site.webmanifest · _headers
  assets/               # Logo, Icons, Schriften (woff2), Bilder, legal.css
functions/              # Cloudflare Pages Functions (Server-Code)
  _lib/core.js          # Öffnungszeiten, Slots, Kapazität, Validierung, Zeitzone
  _lib/mail.js          # E-Mail-Vorlagen + Cloudflare Email Sending
  api/slots.js          # GET  /api/slots?date=…&guests=…  bzw. ?month=YYYY-MM
  api/reservierung.js   # POST /api/reservierung
  storno.js             # GET/POST /storno?token=…   (Gast storniert selbst)
  admin/                # Admin-Panel (Cookie-Login)
    _middleware.js      #   Sitzungsprüfung für /admin/*
    login.js · logout.js
    index.js            #   Übersicht mit Kennzahlen
    neu.js              #   Reservierung von Hand anlegen
    tag.js              #   Tagesansicht mit Auslastung je Zeitfenster
    kalender.js         #   Monatskalender
    zeiten.js           #   Schließtage und Platzzahl
    suche.js            #   Suche nach Name, Telefon, E-Mail
    r/[id].js           #   Detail: bearbeiten, stornieren, Mail erneut senden
migrations/0001_init.sql · 0002_login_attempts.sql
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

Mit der Option **„Über die Kapazität hinaus"** lassen sich Zusatztische, Schließtage und sogar
Ruhetage buchen — für geschlossene Gesellschaften und Sonderöffnungen.

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

## Offene Punkte

- [ ] Impressum: Rechtsform, USt-IdNr./Steuernummer, erteilende Behörde ergänzen (im Impressum gelb markiert)
- [ ] Custom Domain `lammm.de` auf Cloudflare Pages umstellen (aktuell One.com Web Editor)
- [ ] Original-Logodatei (Vektor oder hochauflösendes PNG) vom Kunden einholen und `assets/logo-*.png` ersetzen
- [ ] Echte Fotos vom Restaurant ergänzen bzw. die generierten Bilder schrittweise ersetzen
- [ ] Absenderdomain in Cloudflare Email Sending onboarden und `CF_EMAIL_TOKEN` setzen,
      damit Bestätigungsmails rausgehen (`lammm.de` liegt noch bei One.com)
- [ ] Mit dem Kunden klären, ob resmio abgeschaltet wird — zwei Reservierungsbücher
      parallel führen zu Doppelbelegungen
- [ ] Rechtstexte vor breiter Bewerbung anwaltlich prüfen lassen
