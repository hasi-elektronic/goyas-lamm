# Goya´s Lamm Horrheim — Website

Statische Website für das Restaurant **Goya´s Lamm** im Landidyll Hotel Lamm,
Klosterbergstraße 45, 71665 Vaihingen an der Enz — Horrheim.

Umsetzung: [Hasi Elektronic](https://www.hasi-elektronic.de)

## Stack

- Statisches HTML/CSS/JS, keine Build-Pipeline, keine Abhängigkeiten zur Laufzeit
- Hosting: **Cloudflare Pages** (Projekt `goyas-lamm`, Account „Hasi Elektronic“)
- Schriften (Inter, Playfair Display) **selbst gehostet** → keine Google-Fonts-Verbindung (DSGVO)
- Reservierung: **resmio**-Widget (`landidyll-hotel-lamm`), wird erst **nach aktiver Einwilligung** geladen
- Karte: OpenStreetMap-Embed, `loading="lazy"`, keine Cookies
- Strukturierte Daten: `schema.org/Restaurant` inkl. Öffnungszeiten und Geo-Koordinaten

## Struktur

```
public/
  index.html            # Startseite (Hero, Konzept, Steak, Speisekarte, Galerie, Reservierung, Kontakt)
  impressum.html
  datenschutz.html
  robots.txt · sitemap.xml · site.webmanifest · _headers
  assets/
    logo-dark.png / logo-white.png      # Wortmarke, transparent
    mark-lamb-dark.png / -white.png     # nur das Lamm (Icon-Basis)
    favicon.ico · favicon-16/32 · apple-touch-icon · icon-192/512
    legal.css                           # Styles für Impressum/Datenschutz
    fonts/                              # woff2, selbst gehostet
    img/                                # Speisen- und Stimmungsbilder
```

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
- [ ] Rechtstexte vor breiter Bewerbung anwaltlich prüfen lassen
