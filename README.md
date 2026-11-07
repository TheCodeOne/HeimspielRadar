# HeimspielRadar Monorepo

> **Live:** [**heimspielradar.app**](https://heimspielradar.app)  
> **API:** [**api.heimspielradar.app**](https://api.heimspielradar.app)  
> Entdecke Amateur-Basketballspiele in deiner Nähe auf einer interaktiven Karte mit Hallen-Navigation, Kiosk-Infos und Offline-Fähigkeit.

Ein modernes Fullstack-Monorepo auf Basis von **Nx**, mit einem **Nest.js**-Backend, einem **React 19 (Vite)** Frontend (PWA) und einer **Expo/React Native** Mobile App.

---

## 📁 Projektstruktur

```text
heimspielradar/
├── apps/
│   ├── backend/             # Nest.js API-Server (Port 3000, Prefix: /api) mit Drizzle ORM
│   ├── frontend/            # React 19 + Vite PWA (Karten- & Listenansicht, Offline-Fähig)
│   └── mobile/              # Expo / React Native App (NativeWind, iOS/Android)
├── libs/
│   └── shared-types/        # Geteilte TypeScript-Typen & Logik (@sundayleague/shared-types)
├── docs/                    # Architekturentscheidungen (ADRs), Deployment- & Setup-Guides
├── nx.json                  # Nx-Monorepo Konfiguration
└── package.json             # NPM-Skripte & Abhängigkeiten
```

---

## 🚀 Architektur-Highlights & Features

### 1. Offline-Fähigkeit & Instant Masterpool (PWA)
- **Zero-Latency In-Memory Filtering:** Nach Standorterfassung (GPS oder Stadtsuche) lädt die Web-App im Hintergrund automatisch einen **50-km-Masterpool für bis zu 4 Wochen** (~1.700 Spiele, ~250 KB gzipped).
- **Synchrones Umschalten:** Standardfilter wie *Heute*, *Morgen*, *Dieses Wochenende*, *Nächstes Wochenende*, Ligen- und Umkreisfilter werden lokal über `evaluateMatchesQuery` ohne Ladebalken und mit 0 ms Latenz berechnet.
- **Service Worker & Cache-API:** Über Workbox (`StaleWhileRevalidate`) bleiben Spieldaten persistent im Speicher, sodass die App auch in Hallen oder Funklöchern voll bedienbar bleibt (inklusive subtiler Offline-Status-Pill).
- **Offline-Queue & Auto-Sync für Kiosk- & Halleninfos:** In Hallen ohne Empfang erfasste Meldungen (`KioskSubmissionModal`) werden persistent in `localStorage` (`heimspielradar:kiosk-queue:v1`) zwischengespeichert und dedupliziert:
  - Optimistisches „Info ausstehend (Offline)“-Badge auf Match-Kacheln und im Hallen-Overlay.
  - Automatischer sequenzieller Hintergrund-Abgleich bei Verbindungsrückkehr (`online`-Event, App-Start oder `visibilitychange`) mit Bestätigungs-Toast.
  - Einsicht, Synchronisation und Löschen ausstehender Meldungen direkt in der Einstellungsseite (`/settings`).

### 2. Request Throttling & DDoS-Schutz
- **Cloudflare Edge Protection:** Cloudflare WAF fängt DoS-Spitzen an der Edge vor dem Server ab.
- **Tiered NestJS Rate-Limiting:**
  - Standard API-Limit: 60 Req / Min
  - Teams Typeahead: 120 Req / Min
  - Kiosk-Meldungen: 5 Req / 10 Min (Spam-Schutz)
- **Cloudflare Client-IP:** Echte IP-Erkennung über `cf-connecting-ip` und aktivierten `trust proxy`.

### 3. Selbstgehostetes Deployment & Datenbank
- **Server:** Läuft produktiv und energiesparend auf einem Raspberry Pi via Docker Compose hinter Cloudflare.
- **Datenbank:** PostgreSQL via **Drizzle ORM** (keine Abhängigkeit mehr von proprietären Cloud-Diensten wie Neon oder Render).

### 4. Einheitliche Navigation & Dedizierte Einstellungen (`/settings`)
- **Globaler App-Header:** Einheitliche Navigationsleiste über alle Routen (`/`, `/story`, `/creator`, `/matches/:id`, `/settings`) mit Branding, kontextueller Zurück-Navigation und Hamburger-Menü (`data-testid="nav-menu-button"`).
- **Slide-over Navigation Drawer:** Schneller Zugriff auf Kartenansicht, Listenansicht, Club Story Hub, Einstellungen und optionales Admin-Dashboard – responsiv (`85vw` mobil, `360px` Desktop) und voll tastaturbedienbar (`Escape`, Backdrop-Dismiss, automatische Routenschließung).
- **Vollwertige Einstellungsseite (`/settings`):** Dedizierte Einstellungsroute mit Karten-Engine-Auswahl (MapLibre, OpenLayers, Leaflet, Pigeon Maps), Radiuskreis-Toggle, Standardansichts-Präferenz, Push-Benachrichtigungen, Offline-Speicher-Reset und DBB-Synchronisationsstatus.

### 5. System / Light / Dark Theme Switcher & Zero-FOUC
- **3-stufige Theme-Auswahl:** Nutzer können unter `/settings` zwischen **System** (folgt OS `prefers-color-scheme`), **Hell** (Light Mode) und **Dunkel** (Dark Mode) wählen. Standardwert bei Erstaufruf ist `system`.
- **Zero-FOUC (Flash of Unstyled Content):** Ein synchrones Inline-Script in `index.html` wertet `localStorage` (`heimspielradar:theme`) und Media-Queries vor dem First-Paint aus und setzt die `.dark`-Klasse sowie dynamische `<meta name="theme-color">` Tags ohne sichtbares Flackern.
- **Semantische Theme-Tokens & Karten-Harmonisierung:** Alle Modals, Bottom-Sheets, Dialoge, Badges und Map-Bedienelemente (`ol-zoom`, `leaflet-control-zoom`, `maplibregl-ctrl-group`, `pigeon-zoom-buttons`) passen sich nahtlos an das gewählte Theme an, während Kartentiles für maximale Lesbarkeit von Hallen und Straßen unverändert hell bleiben.

### 6. Umfassende System- & Diagnose-Statistiken
- **Vier Diagnose-Kategorien:** Im ausgebauten Bereich „System & Diagnose“ auf der `/settings`-Seite sowie im `AdminDashboard`:
  1. *Versionen & Commits:* Unabhängige Versionen von Frontend & Backend, 7-stellige Git-Commit-SHAs, klickbare GitHub-Commit-Links sowie automatische Version-Mismatch-Erkennung bei veraltetem PWA-Cache.
  2. *Build- & Laufzeit-Infos:* Frontend Build-Zeitstempel (`builtAt`), Backend-Laufzeit (`uptimeSeconds`) und Live-API-Ping-Latenz in `ms`.
  3. *PWA- & Daten-Pool Status:* Service-Worker-Status (`Aktiv`, `Update bereit`, `Inaktiv / Dev`), Netzwerkstatus (`Online` / `Offline`), 50-km-Masterpool-Cache-Füllstand und letzter DBB-Sync.
  4. *Client-Kontext:* Aktive Karten-Engine, Theme-Modus, Viewport-Auflösung und Standort-Quelle (GPS, Stadtsuche, Standard) mit Suchradius.
- **1-Klick „Debug-Info kopieren“:** Exportiert alle Diagnose-Werte als sauberen Markdown-Block direkt in die Zwischenablage für strukturierte Fehlerberichte.

### 7. Web-Push Notifications (VAPID) für Tip-Off-Reminder & Spielverlegungen
- **Zero-Config VAPID-Key-Management:** 3-stufiger Fallback beim Backend-Start: (1) Environment-Variablen `VAPID_PUBLIC_KEY` & `VAPID_PRIVATE_KEY`, (2) Datenbanktabelle `system_settings`, (3) automatische Generierung eines P-256 EC-Keypairs bei Erststart mit permanenter Persistierung in `system_settings`.
- **Echte Hintergrund-Zustellung:** Service Worker Push-Handler (`apps/frontend/public/sw-push.js` via Workbox `importScripts`) empfängt Push-Payloads auch bei geschlossener App und fokussiert beim Antippen direkt die Spiel-Detailansicht (`/matches/:id`).
- **Geplante Tip-Off-Reminder:** NestJS-Cronjob (alle 5 Minuten, Zeitzone `Europe/Berlin`) für Erinnerungen `1h`, `2h` vor Spielbeginn oder `1d` am Vorabend um 18:00 Uhr.
- **Echtzeit-Meldung bei Spielverlegungen:** Automatische Push-Zustellung bei Termin-, Anwurfzeit- oder Hallenänderungen im DBB-Sync (`ScraperService`) mit intelligentem Snapshot-Vergleich und Zurücksetzen des Erinnerungs-Status bei Verschiebung in die Zukunft.
- **Auto-Pruning:** Automatisches Bereinigen abgelaufener Abonnements bei Push-Service HTTP `404` / `410`.

---

## 🛠️ Schnellstart & Entwicklung

### 1. Installation
```bash
npm install
cp .env.example .env.local
```

### 2. Lokale Services starten
```bash
# Backend (Port 3000, API: http://localhost:3000/api)
npm run start:backend

# Frontend (Port 4200, Web: http://localhost:4200)
npm run start:frontend

# Expo Mobile App
npm run start:mobile
```

### 3. Quality Gates, Tests & Linting
Vor jedem Commit und Pull Request müssen folgende Gates grün sein:
```bash
npx oxlint                 # Rust-Linter (0 Errors, 0 Warnings)
npm run typecheck          # TypeScript Check für alle Projekte
npm test                   # Unit-Tests
npm run build              # Produktions-Build aller Projekte
npm run release:dry-run    # Nx Release Dry-Run (SemVer & Changelogs)
```

### 4. Unabhängiges Versioning & Changelogs (`nx release`)
Das Projekt nutzt **Nx Release** im unabhängigen Modus (`projectsRelationship: "independent"`), um `apps/frontend` und `apps/backend` getrennt anhand von Conventional Commits (`feat:`, `fix:`, `perf:`, etc.) zu versionieren:
```bash
# Release-Vorschau ohne Git-Tags/Commits:
npm run release:dry-run

# Release ausführen (versioniert manifests, generiert CHANGELOG.md & taggt {projectName}@{version}):
npm run release
```
GitHub Actions: Automatisch oder manuell auslösbar über den Workflow `.github/workflows/release.yml` (`workflow_dispatch` mit optionaler `dry_run`-Option).

---

## 🤖 Scraper Sync & GitHub Actions

Das Projekt enthält einen manuell auslösbaren GitHub-Actions-Workflow (`.github/workflows/scraper-sync.yml`), um DBB-Spieldaten zu synchronisieren.

### Workflow ausführen
```bash
gh workflow run scraper-sync.yml -f verbandId=1 -f backendUrl=https://api.heimspielradar.app
```

---

## 💎 Open Source Transparenz & Kosten

HeimspielRadar ist zu 100% Open Source und gemeinnützig orientiert. Alle Betriebskosten, Einnahmen und Ausgaben werden transparent in [**`TRANSPARENCY.md`**](TRANSPARENCY.md) offengelegt.
