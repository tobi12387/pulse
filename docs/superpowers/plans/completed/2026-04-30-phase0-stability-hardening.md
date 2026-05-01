# Phase 0 — Stability Hardening

**Goal:** Schließe die operativen Inkonsistenzen, die vor den nächsten fachlichen Features Risiko erzeugen.

1. DB-Schema und SQL-Migrationen wieder in Einklang bringen, ohne bestehende Serverdaten zu gefährden.
2. Deploy so härten, dass neue Migrationen vor dem Restart angewendet werden.
3. CI so erweitern, dass Migration-Drift, gefährliche SQL-Muster, Build-Fehler und Unit-Test-Regressionen früher auffallen.

## Architektur

- Additive-only: keine destruktiven Migrationen, kein `NOT NULL` ohne sicheren Default.
- Server bleibt Mirror von GitHub `main`; kein Code wird direkt auf dem Server geändert.
- Workflow-Härtung ist Teil dieser Runde, weil Schema-Drift und fehlende Deploy-Migrationen dieselbe Fehlerklasse bilden.

## File Map

| Typ | Datei |
|---|---|
| Create | `backend/src/db/migrations/0015_schema_drift_baseline.sql` |
| Modify | `backend/src/db/migrations/meta/_journal.json` |
| Create | `scripts/check-migrations.mjs` |
| Modify | `backend/src/lib/db.ts` |
| Modify | `package.json` |
| Modify | `.github/workflows/migrations.yml` |
| Create | `.github/workflows/ci.yml` |
| Modify | `scripts/deploy.sh` |
| Modify | `plugins/pulse-ops/scripts/pulse_ops.sh` |
| Modify | `docs/decisions.md` |
| Modify | `docs/ai/current-focus.md` |

## Tasks

1. **Schema baseline:** Ergänze eine idempotente Migration für `pulse_weight_log` und `pulse_strava_tokens`, weil beide im Drizzle-Schema und auf dem Server existieren, aber nicht durch lokale SQL-Migrationen abgebildet sind.
2. **Migration guard:** Erweitere den bestehenden Workflow um additive SQL-Sicherheitschecks und um eine Prüfung, dass die bekannten Drizzle-Tabellen in SQL-Migrationen referenziert werden.
3. **Deploy hardening:** Führe `npm run db:migrate -w backend` im Server-Deploy nach dem Build und vor PM2-Restart aus. Pulse Ops soll denselben Deploy-Pfad nutzen statt eine eigene, driftende Sequenz zu pflegen.
4. **CI basis:** Ergänze eine allgemeine CI für install, build und backend tests mit expliziten Test-Env-Werten.
5. **Docs:** Halte Decision und Current Focus so fest, dass die nächste Runde klar bei Coach/Briefing/Cache-Konsolidierung weitermachen kann.

## Acceptance

- `npm run build` läuft lokal erfolgreich.
- Migration-Workflow-Script erkennt Journal-/SQL-Drift und blockt `DROP` sowie riskantes `NOT NULL`.
- Deploy-Skript enthält Migrationen vor dem PM2-Restart.
- Keine completed-Pläne werden erneut implementiert.
