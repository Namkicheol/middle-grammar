# 우주 약탈단 QA receipt

- 확인일: 2026-09-23 (Asia/Seoul)
- 로컬 Worker live round: `scripts/test-space-raiders-live.mjs` → 30 students over HTTP/WebSocket, 30 correct point awards, teacher leaderboard ranks 1–30, finish/readback `finished`.
- Engine checks: `npm run typecheck`; `npx vitest --config vitest.config.ts --run test/room-engine.test.ts test/classroom-modes.test.ts` → 88 tests passed.
- Browser checks: local anonymous Playwright with the real `multiplayer/index.html`, `app.js`, and `space-raiders.css`, deterministic room/socket fixtures only for layout isolation. Student question and planet-choice screens plus teacher live screen were rendered at 390×844 and 1440×900. All four checks had `document.scrollWidth === document.documentElement.clientWidth`; no constrained-window overflow.
- Local asset readback before release: cover/ship PNGs and all six audio files returned HTTP 200 from `/multiplayer/assets/space-raiders/`.

The live Worker round is the gameplay receipt; the fixture-backed browser pass is limited to responsive screen geometry and visual state rendering.
