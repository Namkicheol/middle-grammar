# 문법 아케이드 멀티플레이 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 솔로 게임을 보존하면서 교사 방 생성, 번호·QR 참가, 서버 판정 점수전, 실시간 순위와 정답률 리포트를 제공한다.

**Architecture:** 정적 클라이언트는 `/multiplayer/`에 두고 Cloudflare Worker가 API와 정적 파일을 제공한다. 방마다 SQLite Durable Object 하나가 authoritative 상태와 WebSocket을 관리하고, 종료 결과는 D1에 기록한다.

**Tech Stack:** Vanilla HTML/CSS/JavaScript, TypeScript, Cloudflare Workers, SQLite Durable Objects, D1, Vitest Workers pool, Wrangler

**Spec:** `docs/superpowers/specs/2026-09-05-multiplayer-mvp-design.md`

## Global Constraints

- `game/questions.js`는 읽기 전용이며 수정하거나 재생성하지 않는다.
- 기존 여섯 솔로 게임 URL과 점수 로직은 바꾸지 않는다.
- 학생은 계정 없이 닉네임과 재접속 토큰으로 참가한다.
- 교사 API는 production에서 Cloudflare Access 이메일 헤더가 없으면 401을 반환한다.
- 점수와 정답 검증은 서버만 수행한다.
- 브라우저 화면 검증은 Aside Browser에서 390×844와 데스크톱으로 수행한다.
- Quizlet·Excel·사진·직접 입력 제작 기능과 약탈 모드는 이 계획의 범위 밖이다.

---

### Task 1: 서버 판정 게임 엔진

**Files:**
- Create: `multiplayer-worker/package.json`
- Create: `multiplayer-worker/tsconfig.json`
- Create: `multiplayer-worker/src/room-engine.ts`
- Create: `multiplayer-worker/test/room-engine.test.ts`

**Interfaces:**
- Consumes: `Question { id, kor, eng, ans, opts, level }`
- Produces: `createRoomState`, `joinPlayer`, `startRoom`, `submitAnswer`, `publicRoomState`, `teacherRoomState`

- [x] **Step 1: Write failing tests** for nickname normalization, configurable late join, occurrence-based duplicate prevention, timed question cycles, 100–150 score formula, tie sorting, and privacy-filtered public state.
- [x] **Step 2: Run** `cd multiplayer-worker && npm test -- --run test/room-engine.test.ts` and confirm failures reference missing engine exports.
- [x] **Step 3: Implement** pure functions with immutable return values and explicit `EngineError` codes `ROOM_STARTED`, `DUPLICATE_ANSWER`, `UNKNOWN_PLAYER`, and `INVALID_ANSWER`.
- [x] **Step 4: Run** `cd multiplayer-worker && npm test -- --run test/room-engine.test.ts` and confirm all engine tests pass.

### Task 2: Worker, Durable Object, WebSocket, D1 기록

**Files:**
- Create: `multiplayer-worker/wrangler.jsonc`
- Create: `multiplayer-worker/src/index.ts`
- Create: `multiplayer-worker/src/room.ts`
- Create: `multiplayer-worker/src/types.ts`
- Create: `multiplayer-worker/migrations/0001_initial.sql`
- Create: `multiplayer-worker/test/worker.test.ts`

**Interfaces:**
- Consumes: Task 1 engine exports.
- Produces: `POST /api/teacher/rooms`, `GET /api/teacher/rooms/:code/{state,ws}`, `POST /api/teacher/rooms/:code/{start,finish}`, `GET /api/teacher/reports/:code`, `POST /api/rooms/:code/join`, `GET /api/rooms/:code/state`, `POST /api/rooms/:code/socket-ticket`, `GET /api/rooms/:code/ws`.

- [x] **Step 1: Write failing Worker tests** proving production teacher requests without a valid Access JWT return 401, valid room creation returns a six-digit code, joins appear in lobby state, duplicate answer returns 409, and students never receive other students' accuracy.
- [x] **Step 2: Run** `cd multiplayer-worker && npm test -- --run test/worker.test.ts` and confirm route failures.
- [x] **Step 3: Implement** Worker routing and one named Durable Object per room code; persist room state before broadcasting and store finalized summaries with prepared D1 statements keyed by immutable room UUID.
- [x] **Step 4: Implement WebSocket messages** `hello`, `room_state`, `start`, `answer`, `answer_result`, `finish`, `error`; use a 60-second single-use student socket ticket and verified teacher identity.
- [x] **Step 5: Reject external internal-trust headers** on public student sockets and restrict development teacher identity to non-production loopback requests, with regression tests.
- [x] **Step 6: Run** `cd multiplayer-worker && npm test` and `npx wrangler deploy --dry-run --outdir /tmp/middle-grammar-multiplayer-dry-run`.

### Task 3: 서버용 문항 생성물

**Files:**
- Create: `multiplayer-worker/scripts/build-question-bank.mjs`
- Create: `multiplayer-worker/src/generated/questions.json`
- Create: `multiplayer-worker/test/question-bank.test.ts`
- Modify: `multiplayer-worker/package.json`

**Interfaces:**
- Consumes: root `game/questions.js` object named `GAME_QUESTIONS`.
- Produces: `{ generatedAt, source, units }` JSON where every question has a unique ID, answer present in options, and no browser-only code.

- [x] **Step 1: Write failing tests** requiring 32 visible units, at least 900 unique questions, unique IDs, and each answer in `opts`.
- [x] **Step 2: Implement** a Node VM parser that reads but never edits `game/questions.js`, extracts only `GAME_QUESTIONS`, validates it, and writes deterministic sorted JSON except for `generatedAt`.
- [x] **Step 3: Run** `cd multiplayer-worker && npm run build:questions && npm test -- --run test/question-bank.test.ts`.
- [x] **Step 4: Run the generator twice** and compare unit/question content after omitting `generatedAt`; confirm identical output.

### Task 4: 학생·교사 멀티플레이 화면

**Files:**
- Create: `multiplayer/index.html`
- Create: `multiplayer/styles.css`
- Create: `multiplayer/app.js`
- Create: `multiplayer/api.js`

**Interfaces:**
- Consumes: Task 2 HTTP and WebSocket messages.
- Produces: role chooser, student join/lobby/play/result views, teacher setup/lobby/live/report views, and QR SVG rendered from the room join URL.

- [x] **Step 1: Create semantic screen regions** with 44px minimum controls, labeled room-code/nickname fields, live status region, and keyboard-visible focus.
- [x] **Step 2: Implement API adapter** using same-origin `/api`; persist only `playerId` and `resumeToken` in `sessionStorage` and reconnect with capped exponential backoff.
- [x] **Step 3: Implement student state renderer** so a QR query `?room=123456` pre-fills the code, lobby shows participant count, occurrence 단위로 답 제출 상태를 분리하고, result shows only the student's own accuracy.
- [x] **Step 4: Implement teacher renderer** with grade/unit/time/question selectors, 1·3·5·7·10분, 10·15·20 반복 문항 묶음, 중간 입장/문항 순서 설정, create/start/finish controls, six-digit code, QR, full leaderboard, and private accuracy table.
- [x] **Step 5: Add QR generation** as a bundled Worker dependency that emits SVG; do not use a third-party runtime API or CDN.

### Task 5: 기존 게임 허브 3단계 개편

**Files:**
- Modify: `game/index.html`

**Interfaces:**
- Consumes: unchanged `GAME_QUESTIONS` and existing `startSelectedGame(unitKey)` routes.
- Produces: `혼자 하기 | 같이 하기`, grade-first selection, collapsible chosen-game summary, eight Lesson rows per grade, and secondary all-grade random action.

- [x] **Step 1: Add navigation controls** before the mode list; `같이 하기` links to `../multiplayer/` without changing solo routes.
- [x] **Step 2: Reorder selection state** to grade → game → topic and render only the selected grade's eight Lesson rows.
- [x] **Step 3: Collapse the six-card game selector** after selection into `✓ {게임명} · 변경` and expand it when change is requested.
- [x] **Step 4: Preserve the user's current Sentence Blast copy** `블록 15초 → 문법 챌린지 → 문법 폭발` and existing localStorage best-score behavior.
- [x] **Step 5: Check** all six modes × both grades route to their former URLs with the chosen unit key.

### Task 6: 통합 검증과 운영 문서

**Files:**
- Create: `multiplayer-worker/README.md`
- Modify: `docs/superpowers/plans/2026-09-05-multiplayer-mvp.md`

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces: reproducible local start, Cloudflare Access/D1 provisioning instructions, test evidence, and remaining production setup list.

- [x] **Step 1: Document local start** with `npm install`, D1 migration, question build, and `wrangler dev --persist-to=.wrangler/state` commands.
- [x] **Step 2: Document production setup** for D1 binding IDs, Cloudflare Access Google allowlist, custom domain, migration, and deploy dry-run; never include credentials.
- [x] **Step 3: Run full automated checks** with `cd multiplayer-worker && npm run test:all && npm run build:questions && npm run typecheck`.
- [x] **Step 4: Run Aside Browser flow** with one teacher session and two student sessions: create → join by code → start → answer → late join → live rank → finish → report.
- [x] **Step 5: Run Aside Browser responsive checks** at 390×844 for the redesigned solo hub and student join screen; confirm no horizontal overflow and launch within three taps plus one swipe.
- [x] **Step 6: Run `student-review`** against the final game and resolve any blocker-level onboarding, fairness, or mobile findings.
- [x] **Step 7: Update this plan's checkboxes and add exact commands/results** under a `Verification evidence` section.

## Deferred backlog

- Problem-set studio: direct form editing, Excel/XLSX upload, Quizlet paste/import, image upload and preview.
- `보물 약탈전`: server-selected steal/gift events with shield and anti-targeting rules.
- `암호 해킹전`: bluff-and-guess round layered on correct-answer currency.
- Existing solo games: opt-in result bridge so a teacher can select one as a same-settings competition.

## Verification evidence

### Automated

```bash
cd multiplayer-worker
npm run test:all
npm run typecheck
npx wrangler deploy --dry-run --outdir /tmp/middle-grammar-multiplayer-final-dry-run
node --check ../multiplayer/api.js
node --check ../multiplayer/app.js
git diff --check
```

- Worker/engine: 36 tests passed, including production Access rejection, forged internal-header rejection, non-loopback development-header rejection, timed cycle boundaries, 1,000-answer bounded state, hard deadline, late join, scoring, and privacy.
- Question bank: 5 tests passed; 32 visible units and 921 unique valid questions from the read-only `game/questions.js` source.
- TypeScript, both browser-module syntax checks, Wrangler dry-run, and whitespace checks passed.
- Wrangler dry-run found four static multiplayer assets and the Durable Object, D1, cron, and production environment bindings.

### Aside Browser

- Solo hub: both play tabs, grade-first switching, eight Lesson rows and 16 topics per grade, six solo modes, Sentence Blast copy, random action, multiplayer link, and zero console errors passed.
- Room `179280`: 1 minute, 10-question fixed-order set, late join enabled; a second student joined after start, teacher participant count became two, and the final report showed score, accuracy, correct count, answered count, and average response time.
- Room `114967`: after 11 submissions from a 10-question repeated set, the student saw `오늘의 12번째 문제`, the teacher saw total answers 11, and the report stored answered count 11; console/page errors were zero.
- Aside Chromium device emulation at 390×844: solo hub and student join each had `scrollWidth=390`, no horizontal overflow, eight visible Lesson rows, join form bottom at 447px, and 44px minimum form controls.

### Reviews

- `student-review`: final PASS after replacing the misleading teacher progress metric, updating student phase notices, and making the timed question set repeat until the deadline.
- Final security/code review: PASS with no remaining Critical/Important findings after stripping external trust headers, restricting development identity to non-production loopback, and bounding each player's detailed answer state to one record.
