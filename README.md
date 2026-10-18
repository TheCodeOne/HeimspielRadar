# Sundayleague Monorepo

Ein modernes Fullstack-Monorepo auf Basis von **Nx**, mit einem **Nest.js**-Backend und einer flexiblen Architektur für jedes beliebige Frontend-Framework.

---

## 📁 Projektstruktur

```text
sundayleague/
├── apps/
│   ├── backend/             # Nest.js API-Server (Port 3000, Prefix: /api)
│   └── frontend/            # (Platzhalter für dein zukünftiges Frontend)
├── libs/
│   └── shared-types/        # Geteilte TypeScript-Typen & Interfaces (@sundayleague/shared-types)
├── nx.json                  # Nx-Konfiguration
├── tsconfig.base.json       # Globale TS-Pfade (z.B. @sundayleague/shared-types)
└── package.json             # NPM-Skripte & Abhängigkeiten
```

---

## 🚀 Schnellstart

### Backend starten

```bash
# Entweder via npm:
npm run start:backend

# Oder direkt via Nx:
npx nx serve backend
```

Das Backend läuft anschließend auf:
- **API URL:** [http://localhost:3000/api](http://localhost:3000/api)
- CORS ist für die lokale Frontend-Entwicklung bereits aktiviert (`app.enableCors()`).

### Tests & Build

```bash
# Tests ausführen
npm test              # Alle Projekte
npm run test:backend  # Nur Backend

# Build ausführen
npm run build         # Alle Projekte
npm run build:backend # Nur Backend
```

---

## 🎨 Frontend hinzufügen (Sobald du dich entschieden hast)

Da du noch überlegst, welches Frontend du nutzen möchtest, kannst du mit den folgenden Befehlen jederzeit dein gewünschtes Framework mit einem einzigen Befehl zum Monorepo hinzufügen:

### Option A: Next.js
```bash
npx nx add @nx/next
npx nx g @nx/next:app apps/frontend --style=css
```

### Option B: React (mit Vite)
```bash
npx nx add @nx/react
npx nx g @nx/react:app apps/frontend --bundler=vite
```

### Option C: Vue.js (mit Vite)
```bash
npx nx add @nx/vue
npx nx g @nx/vue:app apps/frontend
```

### Option D: Angular
```bash
npx nx add @nx/angular
npx nx g @nx/angular:app apps/frontend
```

---

## 🔗 Geteilte Typen (`@sundayleague/shared-types`)

Sowohl das Nest.js-Backend als auch dein zukünftiges Frontend können Code und Typen aus `libs/shared-types` teilen.

Importiere sie einfach wie folgt in deinen Dateien:

```typescript
import { ApiResponse, User } from '@sundayleague/shared-types';
```

---

## 📊 Nx Dependency Graph

Um die Beziehungen zwischen Apps und Libraries visuell im Browser anzuzeigen:

```bash
npx nx graph
```

---

## 🤖 Scraper Sync & GitHub Actions

Das Projekt enthält einen manuell auslösbaren GitHub-Actions-Workflow (`.github/workflows/scraper-sync.yml`), um DBB-Spieldaten in der Render-Backend-Instanz zu synchronisieren.

### Workflow ausführen
1. Gehe im GitHub Repository zum Reiter **Actions**.
2. Wähle **Manual DBB Scraper Sync** in der linken Seitenleiste.
3. Klicke auf **Run workflow**.
4. Wähle optional die `verbandId` (Standard: `1` für Baden-Württemberg) und die `backendUrl` (Standard: `https://heimspiel-radar.onrender.com`).
5. Nach Abschluss zeigt das Job-Summary eine strukturierte Übersicht der synchronisierten Ligen, Spiele und Sporthallen.

Alternativ via GitHub CLI:
```bash
gh workflow run scraper-sync.yml -f verbandId=1 -f backendUrl=https://heimspiel-radar.onrender.com
```

### GitHub Secret Konfiguration
Der Workflow benötigt das Secret `SCRAPER_SECRET` zur Authentifizierung am Backend (`Authorization: Bearer <SCRAPER_SECRET>`):
- Gehe zu **Settings** → **Secrets and variables** → **Actions** im GitHub Repository.
- Erstelle ein neues Repository-Secret mit dem Namen `SCRAPER_SECRET` und trage denselben Wert wie in der Backend-Umgebungsvariable ein.

