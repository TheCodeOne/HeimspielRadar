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
```

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
