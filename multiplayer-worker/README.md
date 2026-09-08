# 문법 아케이드 멀티플레이 Worker

Cloudflare Worker, SQLite Durable Objects, D1으로 교실 멀티 게임의 방 상태와 종료 리포트를 처리한다. 학생은 계정 없이 참가하고, 교사 경로는 Google 직접 로그인 후 자체 세션으로 인증한다. 기존 솔로 게임은 별도 경로에서 그대로 유지한다. 코드 구현과 실제 Google 연결·운영 배포 상태는 별도로 확인한다.

## 로컬 실행

저장소 루트의 `game/questions.js`는 읽기 전용 원본이다. 아래 생성 명령은 원본을 수정하지 않고 Worker용 JSON만 갱신한다.

```bash
cd multiplayer-worker
npm install
npm run build:questions
npx wrangler d1 migrations apply middle-grammar-multiplayer-reports --local --persist-to=.wrangler/state
npx wrangler dev --local --persist-to=.wrangler/state --var ENVIRONMENT:development
```

로컬 앱은 Wrangler가 제공하는 주소의 `/multiplayer/`에서 연다. 로컬 loopback 주소(`localhost`, `127.0.0.1`, `::1`)에서만 `X-Dev-Teacher-Email`과 교사 WebSocket의 `devTeacherEmail` 쿼리를 개발용으로 인정한다. preview·staging처럼 외부에 공개된 호스트에서는 `ENVIRONMENT=development`여도 두 값을 신뢰하지 않으며, 운영 환경에서도 모두 무시한다.

## 방 설정과 게임 모드

교사는 방을 만들 때 제한 시간을 1분, 3분, 5분, 7분, 10분 중에서 고를 수 있다.

플레이 스타일은 개인전이 기본이며, 필요할 때 2~4팀 팀전으로 전환한다. 팀전은 자동으로 인원을 고르게 배정하고 팀 합산 점수와 개인 기록을 따로 보여 준다. 금고 나눔은 같은 팀에만 적용하며, 미궁 조우에서는 팀원을 약탈 대상으로 잡지 않는다.

- `score_race`: 정답 점수와 연속 정답으로 경쟁하는 기본 모드.
- `treasure_heist`: 정답 뒤 안전 보너스, 협력 나눔, 고위험 금고 중 전략을 선택한다. 실제 결과는 선택 전 서버에만 보관한다.
- `maze_heist`: 정답 속도와 연속 정답으로 이동권을 얻어 열쇠, 함정, 순간이동, 방패와 숨은 보물을 탐색한다. 이동과 조우 결과는 서버가 판정하고 학생에게는 현재 위치 주변만 공개한다.
- `grammar_escape`: `야간학교 탈출`. 교실·자료실·현관의 세 방에서 정답으로 조사 기회를 얻고, 세 지점을 조사해 기호별 숫자 단서를 찾은 다음 기호 순서로 암호를 입력한다. 개인전은 각자, 팀전은 팀별 조사 기회·단서·문 진행을 공유한다. 1명 참가한 교사 방도 지원하며 별도 무인증 솔로 경로는 아니다.

야간학교는 정답당 조사 기회 1개(최대 6), 새 지점 조사당 1개를 사용한다. 찾은 단서는 무료로 다시 볼 수 있고 암호 오입력은 3초 재시도 대기를 적용한다. 탈출 여부·시간·완료 방·찾은 단서가 순위에 우선 반영되며 교사는 개인 정답률도 함께 확인한다. 서버는 미발견 숫자를 공개하지 않으며 팀의 동시 조사·문 열기는 순서 번호로 중복 처리를 차단한다. 종료 진행도는 D1 migration `0004_grammar_escape_reports.sql`의 필드에 저장한다.

신규 배경 3장은 `multiplayer/assets/night-*.webp`이며 생성 프롬프트와 크기는 [에셋 기록](../multiplayer/assets/night-school-assets.md)에 있다. [방탈출 구현 계약](../docs/superpowers/specs/2026-09-06-grammar-escape.md)을 참조한다.

교사는 기본 제공 문항 외에도 `/multiplayer/creator.html`에서 직접 입력, Quizlet식 붙여넣기, `.xlsx`, CSV/TSV, 사진 첨부로 5~30문항의 임시 세트를 만들 수 있다. 제작 세트는 현재 교사 브라우저의 로컬 저장소에 보관되며 방 생성 시 서버가 문항 길이, 선택지와 이미지 크기를 다시 검증한다.

`questionCount`는 게임 전체의 최대 풀이 수가 아니라 한 사이클의 문항 묶음 크기다. 학생이 묶음을 전부 풀면 제한 시간이 끝날 때까지 같은 묶음을 다음 사이클로 계속 제공한다. 정답 제출은 화면에 포함된 `occurrenceIndex`를 함께 보내므로 다음 사이클의 같은 문항은 새 문제로 인정하지만, 동일한 출현의 중복 제출은 409로 차단한다.

Durable Object에는 학생별 과거 제출 상세 전체를 쌓지 않는다. 직전 출현의 상세 1건만 유지하고 점수·정답 수·풀이 수·총 응답 시간은 누적 카운터로 저장해, 반복 풀이가 많아도 방 상태 크기가 제출 횟수에 비례해 커지지 않는다.

- `allowLateJoin`의 기본값은 `true`다. 켜면 게임이 시작된 뒤에도 전체 제한 시간이 끝나기 전까지 참가할 수 있다. 60명 정원과 중복 닉네임 차단은 그대로 적용된다. 끄면 시작 뒤 참가 요청은 409로 거부한다.
- `shuffleQuestions`의 기본값은 `true`다. 켜면 해당 단원의 문항을 무작위로 뽑고 학생별 문항 순서도 섞는다. 끄면 서버 문항 파일의 안정적인 앞쪽 문항을 선택하고 학생별 문항 순서를 유지한다. 선택지 순서는 두 설정 모두 섞을 수 있다.

늦게 참가한 학생도 방 전체 종료 시각을 함께 사용하므로 별도의 추가 시간이 생기지 않는다.

## D1 생성과 마이그레이션

처음 한 번 D1 데이터베이스를 만든다.

```bash
npx wrangler d1 create middle-grammar-multiplayer-reports
```

명령이 출력한 실제 `database_id`를 `wrangler.jsonc`의 `REPORTS` 바인딩에 넣는다. 운영 마이그레이션은 배포 전에 실행한다.

```bash
npx wrangler d1 migrations apply middle-grammar-multiplayer-reports --remote
```

방마다 내부 UUID를 사용하므로 6자리 참가 번호가 나중에 재사용되어도 이전 리포트를 덮어쓰지 않는다.

## Google 교사·관리자 로그인 (Access 미사용)

Google OAuth 웹 클라이언트의 등록된 callback은 `https://middle-grammar-multiplayer.obangti.workers.dev/api/auth/google/callback`이다. 기존 Google 프로젝트에서 결제 계정 연결 없이 설정할 수 있는지 먼저 확인한다. 새 프로젝트가 결제를 요구하면 생성하지 않는다. Google 약관·동의는 운영자가 직접 확인한다.

필수 연결 설정은 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_ORIGIN`이다. `AUTH_ORIGIN`은 위 callback의 origin과 같아야 한다. 교사 가입 정책은 기본값인 allowlist와 `TEACHER_SIGNUP_MODE=open` 중에서 고른다. 기본값에서는 `ADMIN_EMAILS` 또는 `TEACHER_EMAILS`에 등록된 계정만 로그인할 수 있어 설정 누락 시 안전하게 차단된다. `open`에서는 Google이 이메일을 검증한 모든 계정을 일반 교사로 허용하며 `TEACHER_EMAILS`는 필요하지 않다. 두 모드 모두 `ADMIN_EMAILS`에 등록한 소유자만 관리자이고, 관리자 역할은 클라이언트 입력이나 Google claim으로 바꿀 수 없다. 현재 방·리포트 소유권 검사는 두 역할 모두 본인에게만 허용한다.

비밀값과 실제 허용 이메일은 Git에 넣지 않는다. 운영 설정은 Wrangler secret 입력 또는 보호된 파일 경로로 전달하고, 로컬 `.dev.vars`는 gitignore한다. 공개 가입을 승인한 환경에서만 Wrangler 변수 `TEACHER_SIGNUP_MODE`를 정확히 `open`으로 설정한다. 다른 값이나 미설정 상태는 공개 가입을 열지 않는다. 인증에는 `0005_teacher_auth.sql`, 교사 차단·감사 기록에는 `0006_teacher_moderation.sql`이 필요하며 **코드 배포 전에 두 원격 migration이 적용됐는지 확인해야 한다.** 연결 설정 또는 기본 allowlist가 비어 있으면 로그인 화면은 연결 준비 중으로 표시하고 교사 API는 차단한다. 기존 Access 헤더는 인증에 사용하지 않는다.

`ADMIN_EMAILS`로 지정된 관리자는 교사 관리 화면에서 가입 교사를 조회·검색하고 차단 또는 차단 해제할 수 있다. 차단 대상은 이메일이 아니라 Google `sub`에 고정되므로 이메일 변경으로 우회할 수 없다. 차단하면 해당 교사의 기존 세션을 폐기하고 연결된 교사 방 WebSocket도 해제한다. 해제해도 폐기된 세션은 되살아나지 않으며 새 Google 로그인으로 새 세션을 받아야 한다. 관리자는 자기 자신이나 다른 관리자 계정을 차단할 수 없고, 일반 교사는 관리 API에 접근할 수 없다. 관리자 동작과 선택 입력은 D1 감사 기록에 남기되 토큰·쿠키 같은 비밀값은 저장하지 않는다.

- `/api/auth/google/start`, `/api/auth/google/callback`: 일회성 state·nonce·PKCE, Google 서명·issuer·audience·필수 claim 검증.
- `/api/auth/session`: 로그인 정보와 요청 검증용 CSRF 토큰. 토큰은 프런트 메모리에서만 유지한다.
- `/api/auth/logout`: 세션 폐기와 연결된 교사 WebSocket 종료. 학생 연결은 유지한다.
- 세션은 8시간이며 서버에는 opaque cookie의 해시만 저장한다. 관리자 이메일이라도 Google 본인 인증 없이는 로그인할 수 없다.
- OAuth URL의 일회성 code가 자동 요청 로그에 남지 않도록 invocation log를 끄고, 인증 오류는 안전한 코드만 반환한다.

## 배포 전 확인

```bash
npm run build:questions
npm run test:all
npm run typecheck
npx wrangler deploy --dry-run
```

야간학교의 프런트 회귀 검사는 `node scripts/test-escape-ui.mjs`, 교사 인증·로그아웃 화면의 상태 검사는 `node scripts/test-auth-ui.mjs`로 실행한다. 로컬 migration 적용 후 개발 Worker가 `127.0.0.1:8787`에 켜져 있으면 `node scripts/smoke-escape.mjs`로 실제 HTTP/WebSocket 개인 완주·팀 동시 조사·리포트 저장을 검사한다. smoke는 loopback 이외의 서버에서 실행을 거부하며 로컬 테스트 방만 만든다.

그다음 실제 D1 ID, `workers.dev` 또는 custom domain 경로, 원격 마이그레이션 적용 여부를 확인한 후 `npx wrangler deploy`를 실행한다. 교사 인증이 아직 연결되지 않았다면 운영 교사 API의 401 차단을 유지하고, 코드 배포와 수업 사용 가능 상태를 구분해 보고한다. Access 가입이나 요금제 선택으로 이 차단을 해제하지 않는다. 비밀번호, 토큰, 계정 ID는 README나 Git에 넣지 않는다.

## 학생 기록과 보존 정책

학생은 계정을 만들거나 로그인하지 않는다. 수업 참여 중에는 재접속, 실시간 순위, 종료 결과 표시를 위해 방의 Durable Object에 임의 player ID, 학생이 입력한 닉네임, 응답·점수·진행 상태와 resume token의 해시를 임시 저장한다. 따라서 개인 데이터가 전혀 저장되지 않는다고 표현하지 않는다.

`STUDENT_RECORD_RETENTION=session`으로 생성한 새 방은 학생 결과를 D1 리포트에 쓰지 않는다. 종료 결과는 해당 방의 인증된 교사와 참가 학생이 확인할 수 있도록 종료 시점부터 30분 동안 Durable Object에만 남긴 뒤 `deleteAll()`로 방 전체를 삭제한다. 시작하지 않은 대기실도 생성 후 2시간이 지나면 삭제한다. 진행 중인 방은 제한 시간이 끝난 뒤 같은 30분 규칙을 적용한다.

이 설정은 새로 생성되는 방에 캡처되며 기존 방·기존 D1 기록의 보존 정책을 소급 변경하거나 삭제하지 않는다. 이전 정책으로 이미 저장된 종료 리포트와 학생 결과는 기존 90일 cron 대상이다. 운영자가 별도 삭제를 승인하지 않는 한 역사 기록을 일괄 삭제하지 않는다. 세션 전용 결과 조회도 교사 로그인과 방 소유권 검사를 그대로 적용한다.

## 후속 TODO

- `grammar_escape` 코드와 원격 `0004`는 배포됐다. 교사 로그인도 2026-09-06 운영 연결됐다.
- 교사 로그인: Google OAuth·운영 비밀 설정·원격 `0005`·기존 allowlist 인증 코드 배포 완료. Worker 버전 `4078ef21-6d3f-468a-9f2b-0473ddb8d763`에서 실제 관리자 로그인 → 방 생성 → 테스트 학생 참가·응답 → 시간 종료·리포트 → 로그아웃·재로그인을 확인했다. 검증된 Google 계정을 일반 교사로 받는 `TEACHER_SIGNUP_MODE=open` 코드는 로컬 구현·테스트했으며, 운영 변수 설정과 새 Worker 배포·실계정 readback은 별도 완료 확인이 필요하다. [인증 설계](../docs/superpowers/specs/2026-09-06-no-plan-teacher-auth.md)를 따른다. Cloudflare Access 가입·요금제 선택·카드 등록은 하지 않는다.
- 교사 관리: 관리자 조회·검색·차단·해제 UI와 `google_sub` 기반 서버 차단, 기존 세션 폐기, 재시도 가능한 방 연결 해제를 로컬 migration `0001`~`0006` 환경에서 검증했다. 일반 교사 403, 56명 pagination, 상태 필터, 검색, 차단 사유·해제 readback, 390px 화면도 로컬에서 확인했다. 원격 `0006` 적용, 새 Worker 배포, 운영 관리자·차단 계정 readback은 아직 수행하지 않았다.
- 문제 세트 영구 보관·공유: 현재 브라우저 임시 저장에서 교사 계정별 세트 라이브러리로 확장한다.
- 수업 리포트: 게임 모드별 아이템·이동·탈출 진행도와 문항별 오답 분포를 추가한다.
