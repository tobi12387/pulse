# Reliability Wave — E2E CI, Local Tests, Deploy Smoke, Bundle Cleanup

**Goal:** Die wiederkehrenden Reibungen aus den letzten Sessions systematisch reduzieren: Browser-Probleme vor Merge finden, lokale Backend-Tests verlässlich starten, Deploys reproduzierbar prüfen und Frontend-Bundle-Warnungen abbauen.

1. Playwright-Smokes laufen nicht nur lokal, sondern als PR-Gate in GitHub Actions.
2. Lokale Testumgebung bekommt einen klaren Verify-Pfad statt impliziter DB-/Env-Annahmen.
3. Server-Deploys bekommen einen skriptbaren Smoke-Check gegen Commit, PM2 und Health-Endpunkte.
4. Der Frontend-Build wird kleiner und besser in Routen-Chunks geschnitten.

## Kontext

PR #53 hat die erste Browser-Smoke-Suite eingeführt: gemockte `/api`-Antworten, Desktop- und Mobile-Chromium, Hauptseiten und Navigation. Der nächste Nutzen entsteht erst, wenn diese Suite CI-pflichtig ist. Gleichzeitig sind lokale Backend-Tests wiederholt an fehlender Postgres-/Env-Infrastruktur gescheitert, und Deploy-Verifikation lief bisher als manuelle Kommandofolge.

## Priority Assessment

| Rang | Thema | Nutzen | Aufwand | Risiko | Bewertung |
|---|---|---|---|---|---|
| 1 | E2E in CI | Browser-Regressionen vor Merge sichtbar | S | S-M | zuerst |
| 2 | Local Test Env | Backend-/Job-Tests lokal reproduzierbar | M | M | danach |
| 3 | Deploy Smoke | Server-Sicht schnell belastbar pruefen | S | S | danach |
| 4 | Bundle Cleanup | Vite-Warnung und Ladezeit reduzieren | M | M | zuletzt |

## Slice 1 — E2E in CI

**Ziel:** `npm run test:e2e` läuft in GitHub Actions nach Build/Backend-Tests und lädt Playwright-Reports bei Fehlern hoch.

### Tasks

1. GitHub Actions installiert Chromium per `npm run test:e2e:install`.
2. CI führt `npm run test:e2e` aus.
3. `playwright-report/` und `test-results/` werden bei Fehlschlägen als Artifacts hochgeladen.
4. E2E-Ausführung bleibt deterministisch über API-Mocks.

### Acceptance

- PR-CI zeigt E2E-Fehler als blockierend.
- Lokaler `npm run test:e2e` bleibt grün.
- Keine echten Garmin-/Serverdaten für Smoke-Tests nötig.

## Slice 2 — Local Test Env

**Ziel:** Ein neuer Entwickler- oder AI-Run kann lokale Backend-/Job-Tests mit dokumentierter Test-DB, Redis und Env prüfen.

### Tasks

1. `.env.test.example` mit allen notwendigen Testwerten.
2. `scripts/verify-local.sh` oder npm-Script für Migration, Backend-Tests, Typecheck.
3. Doku in `docs/ai/current-focus.md` oder `docs/ai/context-map.md`, wo der lokale Verify-Pfad steht.

### Acceptance

- Fehlende lokale DB/Redis werden früh und verständlich gemeldet.
- Kein Test muss echte Garmin-/OpenRouter-Zugriffe auslösen.

## Slice 3 — Deploy Smoke

**Ziel:** Nach Deploys gibt es einen einzigen Befehl, der Commit, PM2 und Health-Endpunkte prüft.

### Tasks

1. `scripts/verify-server.sh` mit `PULSE_HOST`, `PULSE_PATH`, `PULSE_URL`.
2. Prüft Server-Commit, PM2 online, HTTPS 200, `/api/ping`, `/api/pulse/health`.
3. Dokumentiert Exit-Codes und typische Fehlerbilder.

### Acceptance

- Nach `scripts/deploy.sh` kann der Zustand mit einem Befehl validiert werden.
- Ausgabe zeigt Commit und konkrete Health-Ergebnisse.

## Slice 4 — Bundle Cleanup

**Ziel:** Die wiederkehrende Vite-Warnung für den großen JS-Chunk wird reduziert.

### Tasks

1. Route-level Lazy Loading für große Pages prüfen.
2. Build-Chunks messen und nur sinnvolle Splits übernehmen.
3. E2E-Smokes sichern Navigation nach Splitting ab.

### Acceptance

- Build-Warnung ist weg oder begründet dokumentiert.
- E2E-Smokes bleiben grün.

## Nicht-Ziele

- Keine neuen Produktfeatures.
- Keine echten Garmin- oder OpenRouter-Aufrufe in E2E-Smokes.
- Kein Wechsel weg von OpenRouter in dieser Welle.
