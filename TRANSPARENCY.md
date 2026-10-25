# HeimspielRadar Transparenz & Kostenanalyse

HeimspielRadar ist ein **Open-Source-Gemeinschaftsprojekt**. Unsere Philosophie: **100% Transparenz, keine Paywalls für Grundfunktionen und keine Abzocke**.

Diese Datei dokumentiert alle aktuellen und prognostizierten Betriebskosten bei steigenden Nutzerzahlen sowie ein öffentliches Ledger über alle Einnahmen (Spenden, Sponsoring, Featured Matches) und Ausgaben (Server, Domain, Infrastruktur).

---

## 1. Das Open-Source & Non-Profit-Manifest

1. **Freier Zugang für alle**: Das Entdecken von Spielen, Hallen, Spielklassen und Ergebnissen auf der Karte bleibt **dauerhaft 100% kostenlos** für Fans, Eltern, Schiedsrichter und Groundhopper.
2. **Kein Datenmonopol**: Alle von Vereinen eingereichten Hallen- und Kiosk-Zusatzinformationen (Waffeln, Bierpreis, Parkplätze) werden der Community frei zur Verfügung gestellt.
3. **Überschuss-Verwendung**: Einnahmen dienen primär der Deckung der Infrastrukturkosten und dem Aufbau eines kleinen Sicherheitspuffers (12 Monate Serverbetrieb). Sollten signifikante Überschüsse entstehen, werden diese transparent für die **Jugendförderung lokaler Amateurvereine** (z. B. Spende von Spielbällen oder Trikotsätzen) verwendet.

---

## 2. Kostenanalyse nach Wachstumsstufen

Hier ist die detaillierte Aufschlüsselung der monatlichen Betriebskosten nach Skalierungsstufen:

| Kostenkomponente | Stufe 1: Hobby / Lokal (1 Verband, z. B. BBW, ~35k Matches, < 1k MAU) | Stufe 2: Regional (3–5 Verbände, ~150k Matches, 1k–10k MAU) | Stufe 3: Bundesweit (16 Verbände, ~400k Matches, 10k–100k MAU) | Stufe 4: Multi-Sport (Bundesweit + Fußball/Handball) |
| :--- | :--- | :--- | :--- | :--- |
| **Compute (Backend / API)** | **~1,30 €** (Raspberry Pi 4/5 zu Hause, ~5W Strom) | **~3,79 €** (Hetzner Cloud VPS CX22, 2 vCPU, 4GB RAM) | **~7,00 €** (Hetzner Cloud CPX21, 3 vCPU, 4GB RAM) | **~15,00 €** (Hetzner Dedicated / 2x Cloud VPS) |
| **Datenbank (PostgreSQL / PostGIS)** | **0,00 €** (Neon Serverless Free Tier) | **0,00 €** (Postgres direkt im Docker auf dem Hetzner VPS) | **3,81 €** (Hetzner VPS + 1 TB Storage Box für Backups) | **10,00 €** (Managed Postgres oder Hetzner VPS Cluster) |
| **Frontend CDN & Edge Caching** | **0,00 €** (Cloudflare Free Tier) | **0,00 €** (Cloudflare Free Tier) | **0,00 €** (Cloudflare Free Tier) | **0,00 € – 20,00 €** (Cloudflare Pro / CDN) |
| **Geocoding & Karten-Tiles** | **0,00 €** (Nominatim Cache + OSM Fair-Use) | **0,00 €** (OSM Tiles / MapTiler Free bis 100k Aufrufe) | **~5,00 €** (Protomaps / eigene PMTiles Vektorkacheln via Cloudflare R2) | **~15,00 €** (PMTiles CDN Storage & Egress) |
| **Domain & DNS (`heimspielradar.app`)** | **~1,18 €** ($14.20/Jahr) | **~1,18 €** | **~1,18 €** | **~2,50 €** (inkl. Fallback-Domains) |
| **Alerting, Logging & Monitoring** | **0,00 €** (Telegram Bot API + Sentry Free) | **0,00 €** (Telegram Bot + BetterStack Uptime Free) | **0,00 €** (Telegram + GlitchTip self-hosted) | **5,00 €** (Erweitertes Log-Management) |
| **Gesamtkosten pro Monat** | **~2,48 € / Monat** | **~4,97 € / Monat** | **~16,99 € / Monat** | **~47,50 € / Monat** |
| **Benötigte "Kaffees" zur Kostendeckung** | **1 Kaffee (3 €)** | **2 Kaffees (6 €)** | **6 Kaffees oder 2 Featured Matches** | **15 Kaffees oder 5 Featured Matches** |

### 💡 Warum unsere Kosten so extrem niedrig bleiben:
1. **Intelligenter Geocode-Cache**: Wir geokodieren jede Sporthalle nur **ein einziges Mal** und speichern die Koordinaten dauerhaft in der Postgres-Datenbank. Dadurch fallen keine wiederkehrenden Geocoding-Kosten für Google Maps oder Mapbox an.
2. **Cloudflare Edge-Caching**: 95% aller Frontend-Aufrufe (HTML, JS, CSS, Icons) werden an der Cloudflare Edge gecached und erreichen den eigentlichen Server überhaupt nicht.
3. **Zweistufiger Scraper (Delta-Sync)**: Wir laden nicht täglich 400.000 Spiele herunter, sondern synchronisieren nur Spiele des aktuellen Zeitfensters (14 Tage) und nutzen Mehrheitsentscheide für Stammhallen.
4. **Hetzner Standorte in Deutschland**: DSGVO-konforme, günstige Server in Nürnberg und Falkenstein statt teurer US-Cloud-Provider.

---

## 3. Transparenz-Ledger (Einnahmen & Ausgaben)

Alle Einnahmen und Ausgaben werden hier monatlich aufgeführt.

### Zusammenfassung (Stand: Oktober 2026)
- **Gesamteinnahmen**: 0,00 €
- **Gesamtausgaben**: 0,00 €
- **Aktueller Saldo / Serverpuffer**: **0,00 €**

---

### Detailliertes Monats-Log

#### Oktober 2026
*Start des Projekts und Vorbereitung des Kostenmodells.*

| Datum | Typ | Kategorie | Beschreibung | Betrag | Saldo |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 25.10.2026 | Ausgabe | Infrastruktur | Raspberry Pi 4 Stromverbrauch (Schätzung Monat) | -1,30 € | -1,30 € |
| 25.10.2026 | Ausgabe | Domain | Kauf Domain `heimspielradar.app` (1 Jahr, $14.20) | -13,10 € | -14,40 € |
| 25.10.2026 | Einnahme | Startkapital | Privater Entwickler-Zuschuss (Ausgleich Startkosten) | +14,40 € | **0,00 €** |

---

## 4. Transparenz-Bericht & Belege
Sobald externe Spenden ("Buy Me a Coffee", PayPal) oder Einnahmen für "Featured Matches" eingehen, wird diese Tabelle aktualisiert. Jeder Spender kann hier exakt nachvollziehen, wofür sein Beitrag verwendet wurde.

Fragen oder Anregungen zu unserer Kostenstruktur? Erstelle gerne ein Issue oder eine Diskussion im [GitHub Repository](https://github.com/TheCodeOne/HeimspielRadar).
