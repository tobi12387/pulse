# Home Daily Decision Closure QA

Date: 2026-05-05

## Scope

Home no-training fallback decisions now close locally on Home before Coach is needed. Coach remains available as a secondary prepared-prompt support action, and synthetic `nextBestActions.id` values are not sent to the action-closure endpoint.

## Verification

| Check | Result |
|---|---|
| Red test: `npm run test:e2e -- frontend/e2e/ux-daily-flow.spec.ts --project=desktop-chromium --grep "root-target"` before fix | Failed because clicking a `/` action patched a synthetic id. |
| `npm run test:e2e -- frontend/e2e/ux-daily-flow.spec.ts --project=desktop-chromium --project=mobile-chromium` | Passed: 10/10. |
| `npm run test:e2e -- --grep "daily decision\|Daily loop\|Home daily\|Coach prompt"` | Passed: 26/26. |
| `npm run build -w frontend` | Passed. |
| `npm run qa:ux-evidence` | Passed: desktop and mobile route evidence captured. |
| `npm run test:scripts` | Passed: 9/9. |

## Evidence Pack

Generated under:

- `test-results/route-evidence/2026-05-05-5d684bd/desktop-chromium/`
- `test-results/route-evidence/2026-05-05-5d684bd/mobile-chromium/`

Manifest summary:

- Desktop viewport: `1280x720`, 7 screenshots, `horizontalOverflow=false` for all routes.
- Mobile viewport: `412x839`, 7 screenshots, `horizontalOverflow=false` for all routes.
- Mobile Data tab strip still reports off-viewport tab buttons inside the intended horizontal control; document width stays at viewport width.
