## 0.1.1 (2026-11-07)

### 🚀 Features

- **push:** end-to-end VAPID web push for tip-off reminders and match changes ([#245](https://github.com/heimspielradar/HeimspielRadar/pull/245), [#248](https://github.com/heimspielradar/HeimspielRadar/pull/248))
- **diagnostics:** comprehensive debug stats, Nx independent release versioning & changelogs ([#242](https://github.com/heimspielradar/HeimspielRadar/pull/242))
- **backend:** tiered rate limiting with @nestjs/throttler and cloudflare ip support ([#203](https://github.com/heimspielradar/HeimspielRadar/pull/203))
- **shared-types:** unify match query, Europe/Berlin cutoff and radius specification ([#52](https://github.com/heimspielradar/HeimspielRadar/pull/52), [#193](https://github.com/heimspielradar/HeimspielRadar/pull/193))
- **frontend:** modal dialog for top-match calculation breakdown ([#163](https://github.com/heimspielradar/HeimspielRadar/pull/163), [#171](https://github.com/heimspielradar/HeimspielRadar/pull/171))
- **scraper:** deterministic top-match scoring cron and admin trigger ([#160](https://github.com/heimspielradar/HeimspielRadar/pull/160), [#161](https://github.com/heimspielradar/HeimspielRadar/pull/161))
- **ui:** display submitter attribution on match cards and persist in matches table ([#159](https://github.com/heimspielradar/HeimspielRadar/pull/159))
- **data:** implement hierarchical kiosk and parking scopes for matches and matchdays ([#158](https://github.com/heimspielradar/HeimspielRadar/pull/158))
- **admin:** kiosk & venue submissions moderation dashboard ([#143](https://github.com/heimspielradar/HeimspielRadar/pull/143), [#146](https://github.com/heimspielradar/HeimspielRadar/pull/146))
- **admin:** search and manage featured matches in admin dashboard ([#141](https://github.com/heimspielradar/HeimspielRadar/pull/141), [#142](https://github.com/heimspielradar/HeimspielRadar/pull/142))
- **backend:** crowdsourced kiosk-submission api with 1-click telegram approval ([#102](https://github.com/heimspielradar/HeimspielRadar/pull/102), [#139](https://github.com/heimspielradar/HeimspielRadar/pull/139))
- **database:** extend schema for kiosk info, admission fees, featured matches and venue submissions ([#101](https://github.com/heimspielradar/HeimspielRadar/pull/101), [#137](https://github.com/heimspielradar/HeimspielRadar/pull/137))
- **devops:** split raspberry pi deployment into dedicated api (port 3001) and admin worker (port 3000) ([#136](https://github.com/heimspielradar/HeimspielRadar/pull/136))
- match sharing, standalone detail page and cloudflare og tags ([#131](https://github.com/heimspielradar/HeimspielRadar/pull/131), [#132](https://github.com/heimspielradar/HeimspielRadar/pull/132))
- **scraper:** implement scheduled cron sync for nationwide associations and deep ingestion ([#75](https://github.com/heimspielradar/HeimspielRadar/pull/75), [#91](https://github.com/heimspielradar/HeimspielRadar/pull/91))
- **observability:** implement telegram alerting, sync run audit and pi admin dashboard ([#81](https://github.com/heimspielradar/HeimspielRadar/pull/81), [#90](https://github.com/heimspielradar/HeimspielRadar/pull/90))
- **scraper:** implement two-tier delta-sync and primary venue majority voting ([#74](https://github.com/heimspielradar/HeimspielRadar/pull/74), [#89](https://github.com/heimspielradar/HeimspielRadar/pull/89))
- **devops:** add raspberry pi docker container and deployment script ([#76](https://github.com/heimspielradar/HeimspielRadar/pull/76), [#80](https://github.com/heimspielradar/HeimspielRadar/pull/80))
- **matches:** disambiguate team autocomplete suggestions with age group and gender ([#83](https://github.com/heimspielradar/HeimspielRadar/pull/83), [#84](https://github.com/heimspielradar/HeimspielRadar/pull/84))
- **scraper:** add primaryVenueId, isVenueVerified and fetchCompetitionActual ([#73](https://github.com/heimspielradar/HeimspielRadar/pull/73), [#78](https://github.com/heimspielradar/HeimspielRadar/pull/78))
- **matches:** add club and team search filter with global map coverage ([#72](https://github.com/heimspielradar/HeimspielRadar/pull/72), [#79](https://github.com/heimspielradar/HeimspielRadar/pull/79))
- **scraper:** persist sync failures in database and add retry endpoint ([#54](https://github.com/heimspielradar/HeimspielRadar/pull/54), [#66](https://github.com/heimspielradar/HeimspielRadar/pull/66))
- **matches,map:** date range & weekend chips, chronological sort, 2h upcoming cutoff & map popup/z-index fixes (closes #44, closes #45, closes #46, closes #47) ([#44](https://github.com/heimspielradar/HeimspielRadar/issues/44), [#45](https://github.com/heimspielradar/HeimspielRadar/issues/45), [#46](https://github.com/heimspielradar/HeimspielRadar/issues/46), [#47](https://github.com/heimspielradar/HeimspielRadar/issues/47))
- **scraper:** add POST /api/scraper/geocode-missing endpoint to backfill venue coordinates ([adc7e15](https://github.com/heimspielradar/HeimspielRadar/commit/adc7e15))
- **scraper:** resilient geocoding queue with 429 backoff and fallbacks (closes #28, closes #29) ([#28](https://github.com/heimspielradar/HeimspielRadar/issues/28), [#29](https://github.com/heimspielradar/HeimspielRadar/issues/29))
- **scraper:** null-safe teams/kickoff, skip finished matches, intra-league concurrency & batch upserts (closes #30, closes #32) ([#30](https://github.com/heimspielradar/HeimspielRadar/issues/30), [#32](https://github.com/heimspielradar/HeimspielRadar/issues/32))
- **backend:** add onlyUpcoming match filter (future games without results) ([3d0765f](https://github.com/heimspielradar/HeimspielRadar/commit/3d0765f))
- **backend:** add dynamic leagues endpoint and multi-dimensional match filtering ([#33](https://github.com/heimspielradar/HeimspielRadar/pull/33))
- **backend:** configure monolithic static serving of frontend SPA ([#4](https://github.com/heimspielradar/HeimspielRadar/pull/4), [#27](https://github.com/heimspielradar/HeimspielRadar/pull/27))
- **backend:** implement health endpoint and scraper secret protection ([#18](https://github.com/heimspielradar/HeimspielRadar/pull/18), [#26](https://github.com/heimspielradar/HeimspielRadar/pull/26))
- **database:** transition to versioned drizzle migrations and native postgis queries ([#8](https://github.com/heimspielradar/HeimspielRadar/pull/8), [#23](https://github.com/heimspielradar/HeimspielRadar/pull/23))
- **scraper:** scale basketball scraper to all BaWü leagues with automated sync ([#6](https://github.com/heimspielradar/HeimspielRadar/pull/6), [#13](https://github.com/heimspielradar/HeimspielRadar/pull/13))
- **tooling:** enforce oxlint with anti-slop ruleset ([#5](https://github.com/heimspielradar/HeimspielRadar/pull/5), [#10](https://github.com/heimspielradar/HeimspielRadar/pull/10))
- add DBB basketball scraper, geocoding, Drizzle Postgres schema and matches API ([e8a5a0e](https://github.com/heimspielradar/HeimspielRadar/commit/e8a5a0e))
- setup nestjs backend and shared types in nx monorepo ([28246f1](https://github.com/heimspielradar/HeimspielRadar/commit/28246f1))

### 🩹 Fixes

- **db:** ensure idempotent database migrations and graceful DDL on production startup ([#169](https://github.com/heimspielradar/HeimspielRadar/pull/169), [#189](https://github.com/heimspielradar/HeimspielRadar/pull/189))
- **scraper:** refine top-match scoring (use standings early, max 2 top-matches per league/matchday) ([#165](https://github.com/heimspielradar/HeimspielRadar/pull/165), [#172](https://github.com/heimspielradar/HeimspielRadar/pull/172))
- **admin:** allow dashboard UI POST approve/reject without token parameter ([#149](https://github.com/heimspielradar/HeimspielRadar/pull/149))
- **telegram:** update default ADMIN_BASE_URL to http://10.10.10.10:3000 ([#145](https://github.com/heimspielradar/HeimspielRadar/pull/145))
- **backend:** cache lastSyncedAt in memory to allow DB scale-to-zero ([#135](https://github.com/heimspielradar/HeimspielRadar/pull/135))
- **scraper:** provide fallback for null league name ([#112](https://github.com/heimspielradar/HeimspielRadar/pull/112), [#113](https://github.com/heimspielradar/HeimspielRadar/pull/113))
- **matches:** exclude reserve teams when filtering by first team name ([#106](https://github.com/heimspielradar/HeimspielRadar/pull/106), [#108](https://github.com/heimspielradar/HeimspielRadar/pull/108))
- **database:** ensure startup migrations are idempotent and bind 0.0.0.0 ([#92](https://github.com/heimspielradar/HeimspielRadar/pull/92), [#93](https://github.com/heimspielradar/HeimspielRadar/pull/93))
- **scraper:** correct DBB competition actual endpoint URL, migration idempotency and test cleanup ([#94](https://github.com/heimspielradar/HeimspielRadar/pull/94))
- **database:** allow nullable kickoff_date for unscheduled fixtures ([#31](https://github.com/heimspielradar/HeimspielRadar/pull/31))

### 🔥 Performance

- **admin:** server-side pagination and search for featured matches ([#174](https://github.com/heimspielradar/HeimspielRadar/pull/174), [#179](https://github.com/heimspielradar/HeimspielRadar/pull/179))
- **matches:** optimize team autocomplete query and add match foreign key indexes ([#85](https://github.com/heimspielradar/HeimspielRadar/pull/85), [#86](https://github.com/heimspielradar/HeimspielRadar/pull/86))

### ❤️ Thank You

- Dimitrios Kokkonias