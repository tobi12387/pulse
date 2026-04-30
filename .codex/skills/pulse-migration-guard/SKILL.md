---
name: pulse-migration-guard
description: Use when creating, editing, reviewing, or debugging Pulse database schema changes, Drizzle schema files, migration SQL, migration journal entries, or migration failures.
---

# Pulse Migration Guard

Use this skill for changes under:

- `backend/src/db/migrations/`
- `backend/src/db/schema.ts`
- `backend/src/db/pulse-schema.ts`
- migration journal files
- code that depends on new or changed DB columns

## Rules

- Migrations are additive-only.
- Do not use `DROP`.
- Do not add `NOT NULL` unless the column has a safe `DEFAULT`.
- Name SQL migrations `NNNN_description.sql`.
- Check the latest number before adding a migration.
- If a migration number collides after rebase, renumber your migration to the next free number and update related journal metadata.
- Keep legacy Garmin/check-in tables out of new Briefing and Coach context work. Prefer Pulse schema tables.

## Review Checklist

1. Search for existing migration numbers:
   - `rg "^--|CREATE|ALTER|INSERT|DROP|NOT NULL" backend/src/db/migrations`
   - `ls backend/src/db/migrations`
2. Inspect schema changes and generated SQL together.
3. Confirm Drizzle journal metadata references every SQL migration when journal files are involved.
4. Verify backend code tolerates existing rows and missing optional data.
5. Run the narrowest relevant backend test/build command available.

## Red Flags

- Destructive migration statements.
- New duplicated threshold logic instead of shared contracts.
- Frontend assumptions that a newly added nullable DB value is always present.
- Raw SQL that bypasses existing Drizzle patterns without a clear reason.
