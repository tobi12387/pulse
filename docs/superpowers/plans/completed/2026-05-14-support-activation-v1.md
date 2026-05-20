# Support Activation v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved Configured Support Plan v1 so Pulse can store explicit support preferences, include them in Coach context, and edit them from Settings without automatic escalation.

**Architecture:** Extend the existing Coach preferences boundary instead of creating a new route or service. Add additive DB columns, shared types, backend validation/serialization, Coach prompt formatting, and a compact Settings > Coach UI section.

**Tech Stack:** TypeScript, Drizzle/Postgres SQL migrations, Fastify + Zod, Vitest, React/Vite, TanStack Query, Playwright smoke/usability fixtures.

---

## Scope Notes

- Continue on branch `codex/resilience-support-next-slice`.
- Implement the spec in `docs/superpowers/specs/2026-05-14-support-activation-v1-design.md`.
- User approved autonomous execution; use inline execution without asking for another execution-mode choice.
- Do not add automatic contact, Telegram, or new notification topics.

## File Map

- Modify `shared/types/pulse/profile.ts`: add support activation preference type and fields on `PulseCoachPreferences`.
- Modify `backend/src/db/pulse-schema.ts`: add typed support-plan columns to `pulseCoachPreferences`.
- Create `backend/src/db/migrations/0034_support_activation_preferences.sql`: additive columns with defaults.
- Modify `backend/src/pulse/services/coach.ts`: default and serialize support fields.
- Modify `backend/src/pulse/routes/coach-routes.ts`: validate and persist support fields.
- Modify `backend/src/pulse/lib/pulse-context.ts`: include support fields in context mapping.
- Modify `backend/src/pulse/services/coach-engine.ts`: format support preferences in system prompt.
- Modify `backend/src/pulse/plugin.test.ts`: defaults, persistence, and validation coverage.
- Modify `backend/src/pulse/services/coach-engine.test.ts`: prompt inclusion and omission coverage.
- Modify `frontend/src/features/settings/coach/coach-components.tsx`: support-plan read/edit UI.
- Modify `frontend/e2e/fixtures/pulse-api.ts`: fixture defaults and PATCH echo for support fields.
- Modify `frontend/e2e/pulse-usability.spec.ts`: Settings support-plan edit coverage.
- Modify `docs/ai/current-focus.md`: record Support Activation v1 as implemented after code is complete.

---

### Task 1: Backend Contract And Migration

**Files:**
- Modify: `shared/types/pulse/profile.ts`
- Modify: `backend/src/db/pulse-schema.ts`
- Create: `backend/src/db/migrations/0034_support_activation_preferences.sql`
- Modify: `backend/src/db/migrations/meta/_journal.json`
- Modify: `backend/src/pulse/services/coach.ts`
- Modify: `backend/src/pulse/routes/coach-routes.ts`
- Modify: `backend/src/pulse/lib/pulse-context.ts`
- Test: `backend/src/pulse/plugin.test.ts`

- [x] **Step 1: Add failing backend preference tests**

Add assertions to `backend/src/pulse/plugin.test.ts` in `describe('Coach preferences')`:

```ts
expect(defaults.json()).toMatchObject({
  preferences: {
    supportWarningSigns: [],
    supportStabilizingActions: [],
    supportContactNote: '',
    supportActivationPreference: 'suggest_only',
  },
});
```

Extend the PATCH payload with:

```ts
supportWarningSigns: ['Rueckzug', 'mehrere Tage sehr wenig Energie', 'Rueckzug'],
supportStabilizingActions: ['10 Minuten rausgehen', 'Training bewusst klein halten'],
supportContactNote: 'Wenn ich festhaenge: Max kurz schreiben.',
supportActivationPreference: 'coach_prompt',
```

Expect the response to dedupe arrays and persist:

```ts
supportWarningSigns: ['Rueckzug', 'mehrere Tage sehr wenig Energie'],
supportStabilizingActions: ['10 Minuten rausgehen', 'Training bewusst klein halten'],
supportContactNote: 'Wenn ich festhaenge: Max kurz schreiben.',
supportActivationPreference: 'coach_prompt',
```

Add a second test:

```ts
it('rejects invalid support activation preferences', async () => {
  const res = await app.inject({
    method: 'PATCH',
    url: '/api/pulse/coach/preferences',
    headers: { Authorization: `Bearer ${token}` },
    payload: { supportActivationPreference: 'auto_contact' },
  });
  expect(res.statusCode).toBe(400);
});
```

- [x] **Step 2: Run backend test to verify RED**

Run:

```bash
npm run test -w backend -- src/pulse/plugin.test.ts
```

Expected: FAIL because support fields are not in the shared/backend contract yet.

- [x] **Step 3: Implement shared type and schema columns**

In `shared/types/pulse/profile.ts`, add:

```ts
export type PulseSupportActivationPreference = 'suggest_only' | 'coach_prompt' | 'manual_only';
```

Extend `PulseCoachPreferences` with:

```ts
supportWarningSigns: string[];
supportStabilizingActions: string[];
supportContactNote: string;
supportActivationPreference: PulseSupportActivationPreference;
```

In `backend/src/db/pulse-schema.ts`, import the new type and add to `pulseCoachPreferences`:

```ts
supportWarningSigns: text('support_warning_signs').array().notNull().default(sql`ARRAY[]::TEXT[]`),
supportStabilizingActions: text('support_stabilizing_actions').array().notNull().default(sql`ARRAY[]::TEXT[]`),
supportContactNote: text('support_contact_note').notNull().default(''),
supportActivationPreference: varchar('support_activation_preference', { length: 32 }).$type<PulseSupportActivationPreference>().notNull().default('suggest_only'),
```

Create `backend/src/db/migrations/0034_support_activation_preferences.sql`:

```sql
ALTER TABLE "pulse_coach_preferences"
  ADD COLUMN IF NOT EXISTS "support_warning_signs" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "support_stabilizing_actions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "support_contact_note" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "support_activation_preference" VARCHAR(32) NOT NULL DEFAULT 'suggest_only';
```

Append a matching `idx: 34` journal entry for `0034_support_activation_preferences` in `backend/src/db/migrations/meta/_journal.json`.

- [x] **Step 4: Implement serialization and route validation**

In `backend/src/pulse/services/coach.ts`, extend `DEFAULT_COACH_PREFERENCES` and `serializeCoachPreferences` with the support fields.

In `backend/src/pulse/routes/coach-routes.ts`, add Zod fields:

```ts
supportWarningSigns: z.array(z.string().trim().min(1).max(160)).max(12).optional(),
supportStabilizingActions: z.array(z.string().trim().min(1).max(180)).max(12).optional(),
supportContactNote: z.string().trim().max(500).optional(),
supportActivationPreference: z.enum(['suggest_only', 'coach_prompt', 'manual_only']).optional(),
```

Persist deduped arrays and scalar fields into `updates`.

In `backend/src/pulse/lib/pulse-context.ts`, include the four support fields when mapping `coachPreferencesRow`.

- [x] **Step 5: Run backend test to verify GREEN**

Run:

```bash
npm run test -w backend -- src/pulse/plugin.test.ts
```

Expected: PASS.

---

### Task 2: Coach Prompt Support Context

**Files:**
- Modify: `backend/src/pulse/services/coach-engine.ts`
- Test: `backend/src/pulse/services/coach-engine.test.ts`

- [x] **Step 1: Add failing Coach prompt tests**

In `backend/src/pulse/services/coach-engine.test.ts`, add one test that passes support fields in `coachPreferences` and expects:

```ts
expect(prompt).toContain('== EXPLIZITER SUPPORTPLAN ==');
expect(prompt).toContain('Warnzeichen: Rueckzug; mehrere Tage sehr wenig Energie');
expect(prompt).toContain('Stabilisieren: 10 Minuten rausgehen; Training bewusst klein halten');
expect(prompt).toContain('Support-Hinweis: Wenn ich festhaenge: Max kurz schreiben.');
expect(prompt).toContain('Aktivierung: Coach darf einen Supportplan-Prompt vorbereiten.');
expect(prompt).toContain('Keine automatische Kontaktaufnahme.');
```

Add another test with empty support fields and expect:

```ts
expect(prompt).not.toContain('== EXPLIZITER SUPPORTPLAN ==');
```

- [x] **Step 2: Run Coach prompt test to verify RED**

Run:

```bash
npm run test -w backend -- src/pulse/services/coach-engine.test.ts
```

Expected: FAIL because support formatting does not exist yet.

- [x] **Step 3: Implement prompt formatting**

In `backend/src/pulse/services/coach-engine.ts`, add `SUPPORT_ACTIVATION_LABELS`, `hasVisibleSupportPlan`, and `formatSupportPlan`. Append the support section after visible Coach preferences when present. The section must state these are explicit user preferences and that Pulse must not contact anyone automatically.

- [x] **Step 4: Run Coach prompt test to verify GREEN**

Run:

```bash
npm run test -w backend -- src/pulse/services/coach-engine.test.ts
```

Expected: PASS.

---

### Task 3: Settings UI And Frontend Fixture

**Files:**
- Modify: `frontend/src/features/settings/coach/coach-components.tsx`
- Modify: `frontend/e2e/fixtures/pulse-api.ts`
- Test: `frontend/e2e/pulse-usability.spec.ts`

- [x] **Step 1: Add failing Playwright coverage**

Extend `Settings edits explicit coach preferences for future recommendations` in `frontend/e2e/pulse-usability.spec.ts`.

Fixture `coachPreferences` should include:

```ts
supportWarningSigns: ['Rueckzug'],
supportStabilizingActions: ['10 Minuten rausgehen'],
supportContactNote: 'Max kurz schreiben.',
supportActivationPreference: 'suggest_only',
```

After opening Settings, expect support text:

```ts
await expect(page.getByText('Unterstützung')).toBeVisible();
await expect(page.getByText('Pulse kontaktiert niemanden automatisch.')).toBeVisible();
await expect(page.getByText('Rueckzug')).toBeVisible();
```

After clicking `Bearbeiten`, fill:

```ts
await page.getByLabel('Warnzeichen').fill('Rueckzug\nmehrere Tage sehr wenig Energie');
await page.getByLabel('Stabilisierende Schritte').fill('10 Minuten rausgehen\nTraining bewusst klein halten');
await page.getByLabel('Support-Hinweis').fill('Wenn ich festhaenge: Max kurz schreiben.');
await page.getByLabel('Support-Aktivierung').selectOption('coach_prompt');
```

Extend the expected PATCH body with the four support fields.

- [x] **Step 2: Run Playwright test to verify RED**

Run:

```bash
npm run test:e2e -- frontend/e2e/pulse-usability.spec.ts -g "Settings edits explicit coach preferences" --project=desktop-chromium
```

Expected: FAIL because the support section and form controls do not exist yet.

- [x] **Step 3: Implement frontend defaults and form**

In `frontend/e2e/fixtures/pulse-api.ts`, include support defaults in GET and PATCH responses.

In `frontend/src/features/settings/coach/coach-components.tsx`:

- Extend `COACH_DEFAULT_PREFERENCES`.
- Extend `CoachPreferencesForm`.
- Extend `preferencesToForm`.
- Add a `SUPPORT_ACTIVATION_LABELS` map.
- Add textareas labeled `Warnzeichen`, `Stabilisierende Schritte`, and `Support-Hinweis`.
- Add select labeled `Support-Aktivierung`.
- Include support fields in `updatePreferences.mutateAsync`.
- Show a read-state `Unterstützung` section that states `Pulse kontaktiert niemanden automatisch.`

- [x] **Step 4: Run Playwright test to verify GREEN**

Run:

```bash
npm run test:e2e -- frontend/e2e/pulse-usability.spec.ts -g "Settings edits explicit coach preferences" --project=desktop-chromium
```

Expected: PASS.

---

### Task 4: Docs, Focus, And Verification

**Files:**
- Modify: `docs/ai/current-focus.md`
- Modify if needed: files touched by type/build errors

- [x] **Step 1: Update current focus after implementation**

Add a short current-state bullet that Support Activation v1 is implemented: Settings > Coach stores explicit support warning signs, stabilizing actions, contact note and activation preference; Coach context treats it as user-provided support preferences; no automatic contact or clinical labeling.

- [x] **Step 2: Run migration guard**

Run:

```bash
npm run check:migrations
```

Expected: PASS and no destructive migration statements.

- [x] **Step 3: Run focused backend verification**

Run:

```bash
npm run test -w backend -- src/pulse/plugin.test.ts src/pulse/services/coach-engine.test.ts
```

Expected: PASS.

- [x] **Step 4: Run frontend and shared build**

Run:

```bash
npm run build -w shared && npm run build -w frontend
```

Expected: PASS.

- [x] **Step 5: Run focused frontend smoke**

Run:

```bash
npm run test:e2e -- frontend/e2e/pulse-usability.spec.ts -g "Settings edits explicit coach preferences" --project=desktop-chromium
```

Expected: PASS.

- [x] **Step 6: Commit and push**

Stage explicitly:

```bash
git add shared/types/pulse/profile.ts backend/src/db/pulse-schema.ts backend/src/db/migrations/0034_support_activation_preferences.sql backend/src/db/migrations/meta/_journal.json backend/src/pulse/services/coach.ts backend/src/pulse/routes/coach-routes.ts backend/src/pulse/lib/pulse-context.ts backend/src/pulse/services/coach-engine.ts backend/src/pulse/plugin.test.ts backend/src/pulse/services/coach-engine.test.ts frontend/src/features/settings/coach/coach-components.tsx frontend/e2e/fixtures/pulse-api.ts frontend/e2e/pulse-usability.spec.ts docs/ai/current-focus.md docs/superpowers/plans/2026-05-14-support-activation-v1.md
git commit -m "feat: add support activation preferences"
git push
```

Expected: branch `codex/resilience-support-next-slice` updated.
