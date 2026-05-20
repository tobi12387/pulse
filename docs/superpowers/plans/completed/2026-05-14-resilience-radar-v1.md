# Resilience Radar v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only resilience radar that surfaces multi-day low-mood, overload, routine-gap and support-plan signals in Data > Mental.

**Architecture:** Add shared mental response contracts, a pure backend builder plus authenticated route, and a compact frontend card using the existing Pulse API/TanStack Query pattern. Keep the slice deterministic and read-only: no DB migration, no LLM, no plan writes, no Garmin writes, no push/contact escalation.

**Tech Stack:** TypeScript, Fastify, Drizzle selects, Vitest, React/Vite, TanStack Query, Playwright.

---

## Scope Notes

- Branch: `codex/resilience-radar-v1`.
- Spec: `docs/superpowers/specs/2026-05-14-resilience-radar-v1-design.md`.
- Use existing Pulse tables and computed load series only.
- Keep copy safety-bounded and visible: no clinical diagnosis, no hidden labels.

## File Map

- Modify `shared/types/pulse/mental.ts`: add `PulseResilienceRadarResponse` and related types.
- Create `backend/src/pulse/services/resilience-radar.ts`: pure builder and DB loader.
- Create `backend/src/pulse/services/resilience-radar.test.ts`: pure builder coverage.
- Modify `backend/src/pulse/routes/checkin-routes.ts`: register `GET /mental/resilience-radar`.
- Modify `backend/src/pulse/plugin.test.ts`: route contract coverage.
- Modify `frontend/src/pulse/api-client.ts`: add API client method.
- Modify `frontend/src/pulse/hooks.ts`: add query key/hook and invalidation after check-ins.
- Create `frontend/src/features/data/resilience/ResilienceRadarCard.tsx`: compact card.
- Modify `frontend/src/features/data/mental/mental-components.tsx`: render the card.
- Modify `frontend/e2e/fixtures/pulse-api.ts`: default and override fixture response.
- Modify `frontend/e2e/pulse-usability.spec.ts`: focused Data > Mental Playwright coverage.
- Modify `docs/ai/current-focus.md` and `docs/decisions.md` after implementation.

## Task 1: Backend Contract And Pure Builder

- [x] **Step 1: Add shared response types**

Add to `shared/types/pulse/mental.ts`:

```ts
export type PulseResilienceRadarState = 'learning' | 'steady' | 'watch' | 'protect' | 'rebuild';
export type PulseResilienceRadarSignalId =
  | 'low_mood_trend'
  | 'low_energy_trend'
  | 'stress_pressure'
  | 'load_pressure'
  | 'routine_gap'
  | 'support_plan';

export interface PulseResilienceRadarAction {
  label: string;
  targetPath: string;
  resultPreview: string;
}

export interface PulseResilienceRadarSignal {
  id: PulseResilienceRadarSignalId;
  label: string;
  summary: string;
  evidence: string[];
}

export interface PulseResilienceRadarSupport {
  configured: boolean;
  suggested: boolean;
  preference: 'suggest_only' | 'coach_prompt' | 'manual_only';
  note: string | null;
}

export interface PulseResilienceRadarResponse {
  days: number;
  state: PulseResilienceRadarState;
  title: string;
  summary: string;
  primaryAction: PulseResilienceRadarAction;
  signals: PulseResilienceRadarSignal[];
  support: PulseResilienceRadarSupport;
  evidenceQuality: {
    checkins: number;
    garminDays: number;
    loadDays: number;
    confidence: 'insufficient' | 'learning' | 'usable';
  };
}
```

- [x] **Step 2: Add failing pure builder tests**

Create `backend/src/pulse/services/resilience-radar.test.ts` with tests that expect:

- repeated low mood/high stress plus configured `coach_prompt` support returns `state: 'protect'`, a `support_plan` signal, and a `/coach?prompt=` primary action.
- old check-ins but no recent check-ins returns `state: 'rebuild'` and primary action `/data?tab=today#data-mental`.
- too little data returns `state: 'learning'`.

Run:

```bash
npm run test -w backend -- src/pulse/services/resilience-radar.test.ts
```

Expected: FAIL because the module does not exist yet.

- [x] **Step 3: Implement pure builder and DB loader**

Create `backend/src/pulse/services/resilience-radar.ts` exporting:

- `buildResilienceRadar(input)`
- `getResilienceRadar(userId, days)`

Implementation rules:

- clamp days to 7-30, default 14 at route level;
- use visible averages only when at least 3 check-ins exist;
- mark `protect` when low mood/energy or high stress repeats;
- mark `rebuild` when no check-in exists in the last 3 days but prior check-ins exist;
- add `support_plan` only when support preferences are configured, state is `watch` or stronger, and preference is not `manual_only`;
- build Coach prompt deep link with `encodeURIComponent`.

- [x] **Step 4: Verify pure builder GREEN**

Run:

```bash
npm run test -w backend -- src/pulse/services/resilience-radar.test.ts
```

Expected: PASS.

## Task 2: Route Contract

- [x] **Step 1: Add failing route test**

In `backend/src/pulse/plugin.test.ts`, add a `GET /api/pulse/mental/resilience-radar` test near the mental route tests. Insert several mental check-ins and a coach preference with support fields, call the route and assert:

- HTTP 200;
- `state` is `protect`;
- `signals` contains `support_plan`;
- `primaryAction.targetPath` starts with `/coach?prompt=`;
- no Garmin mocks are called.

Run:

```bash
npm run test -w backend -- src/pulse/plugin.test.ts -t "resilience radar"
```

Expected: FAIL because the route is not registered yet.

- [x] **Step 2: Register route**

In `backend/src/pulse/routes/checkin-routes.ts`, import `getResilienceRadar` and add:

```ts
app.get('/mental/resilience-radar', { onRequest: [app.authenticate] }, async (req) => {
  const userId = req.user.sub;
  const q = req.query as { days?: string };
  const parsed = Number.parseInt(q.days ?? '14', 10);
  const days = Number.isFinite(parsed) ? parsed : 14;
  return getResilienceRadar(userId, days);
});
```

- [x] **Step 3: Verify route GREEN**

Run:

```bash
npm run test -w backend -- src/pulse/plugin.test.ts -t "resilience radar"
```

Expected: PASS.

## Task 3: Frontend Card And Fixture

- [x] **Step 1: Add failing Playwright coverage**

In `frontend/e2e/fixtures/pulse-api.ts`, add an optional `resilienceRadar` fixture override and a default response for `/api/pulse/mental/resilience-radar`.

In `frontend/e2e/pulse-usability.spec.ts`, add `Data mental shows resilience radar support prompt`:

- mock a `protect` radar with `support_plan`;
- visit `/data?tab=mental`;
- expect `Resilienz-Radar`, evidence text and `Supportplan vorbereiten`;
- click the button and assert the Coach input is prefilled;
- assert no coach send happened.

Run:

```bash
npm run test:e2e -- frontend/e2e/pulse-usability.spec.ts -g "Data mental shows resilience radar" --project=desktop-chromium
```

Expected: FAIL because the card does not exist yet.

- [x] **Step 2: Add API client and hook**

In `frontend/src/pulse/api-client.ts`, import `PulseResilienceRadarResponse` and add:

```ts
resilienceRadar: (days = 14): Promise<PulseResilienceRadarResponse> =>
  request(`/mental/resilience-radar?days=${encodeURIComponent(String(days))}`),
```

In `frontend/src/pulse/hooks.ts`, add query key `resilienceRadar(days)` and hook `useResilienceRadar(days = 14)`. Invalidate it after check-in submit and voice/text check-in writes where existing mental queries are invalidated.

- [x] **Step 3: Render Data > Mental card**

Create `frontend/src/features/data/resilience/ResilienceRadarCard.tsx` with loading/error-friendly props from `useResilienceRadar`. Render:

- label `Resilienz-Radar`;
- title and summary;
- primary action button that navigates to `primaryAction.targetPath`;
- evidence quality chips;
- up to three signals with evidence.

In `mental-components.tsx`, render the card below `ResilienceGuidanceCard` and before the check-in completion/form block.

- [x] **Step 4: Verify Playwright GREEN**

Run:

```bash
npm run test:e2e -- frontend/e2e/pulse-usability.spec.ts -g "Data mental shows resilience radar" --project=desktop-chromium
```

Expected: PASS.

## Task 4: Docs And Final Verification

- [x] **Step 1: Update durable context**

Add a short `docs/decisions.md` entry explaining Resilience Radar v1 as a read-only early-pattern layer.

Update `docs/ai/current-focus.md` only with a durable snapshot bullet.

- [x] **Step 2: Run focused verification**

Run:

```bash
npm run test -w backend -- src/pulse/services/resilience-radar.test.ts src/pulse/plugin.test.ts -t "resilience radar|Resilience Radar"
npm run test:e2e -- frontend/e2e/pulse-usability.spec.ts -g "Data mental shows resilience radar" --project=desktop-chromium
npm run build -w shared && npm run build -w backend && npm run build -w frontend
git diff --check
```

- [x] **Step 3: Commit and push**

Stage explicit files only and commit:

```bash
git add shared/types/pulse/mental.ts backend/src/pulse/services/resilience-radar.ts backend/src/pulse/services/resilience-radar.test.ts backend/src/pulse/routes/checkin-routes.ts backend/src/pulse/plugin.test.ts frontend/src/pulse/api-client.ts frontend/src/pulse/hooks.ts frontend/src/features/data/resilience/ResilienceRadarCard.tsx frontend/src/features/data/mental/mental-components.tsx frontend/e2e/fixtures/pulse-api.ts frontend/e2e/pulse-usability.spec.ts docs/ai/current-focus.md docs/decisions.md docs/superpowers/specs/2026-05-14-resilience-radar-v1-design.md docs/superpowers/plans/2026-05-14-resilience-radar-v1.md
git commit -m "feat: add resilience radar"
git push -u origin codex/resilience-radar-v1
```
