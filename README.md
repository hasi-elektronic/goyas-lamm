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
  _lib/mail.js          # E-Mail-Vorlagen + Resend-Versand
  api/slots.js          # GET  /api/slots?date=…&guests=…  bzw. ?month=YYYY-MM
  api/reservierung.js   # POST /api/reservierung
  storno.js             # GET/POST /storno?token=…   (Gast storniert selbst)
  admin.js              # GET/POST /admin            (Basic-Auth, Übersicht + Stornieren)
migrations/0001_init.sql
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
| `ADMIN_USER` / `ADMIN_PASS` | Zugang zu `/admin` (Basic-Auth) — **secret** |
| `IP_SALT` | Salt für den IP-Hash — **secret** |
| `RESEND_API_KEY` | E-Mail-Versand über Resend — **secret**, noch nicht gesetzt |
| `RES_FROM` | Absender, z. B. `Goya´s Lamm <reservierung@lammm.de>` |
| `RES_HOUSE_EMAIL` | Wohin die Benachrichtigung an die Küche geht |
| `RES_SEATS_PER_SLOT` | Plätze je Zeitfenster |
| `SITE_URL` | optional; ohne Angabe wird die aufgerufene Domain verwendet |

Ohne `RESEND_API_KEY` funktioniert alles weiter — es gehen nur keine E-Mails raus,
die Reservierung steht trotzdem in `/admin`.

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
- [ ] `RESEND_API_KEY` setzen und Absenderdomain bei Resend verifizieren, damit
      Bestätigungsmails rausgehen
- [ ] Mit dem Kunden klären, ob resmio abgeschaltet wird — zwei Reservierungsbücher
      parallel führen zu Doppelbelegungen
- [ ] Rechtstexte vor breiter Bewerbung anwaltlich prüfen lassen
