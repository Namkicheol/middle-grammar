# 문법 아케이드 멀티플레이 Worker

Cloudflare Worker, SQLite Durable Objects, D1으로 교실 멀티 게임의 방 상태와 종료 리포트를 처리한다. 학생은 계정 없이 참가하고, 교사 경로는 운영 환경에서 Cloudflare Access JWT로 인증한다. 기존 솔로 게임은 별도 경로에서 그대로 유지한다.

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

## Cloudflare Access 교사 로그인

1. Cloudflare Zero Trust에서 Google을 identity provider로 연결한다.
2. `middle-grammar-multiplayer.obangti.workers.dev/api/teacher/*`를 대상으로 hostname 기반 self-hosted Access application을 만든다. 학생용 `/api/rooms/*`와 `/multiplayer/*`는 공개 경로로 유지한다.
3. Allow 정책에는 사용을 허용할 교사 이메일만 명시한다. 전체 도메인 허용이 필요하다면 학교가 관리하는 도메인인지 확인한 뒤 별도로 설정한다.
4. Access application의 Audience 태그와 팀 도메인을 Worker 환경 변수로 설정한다. 실제 값은 저장소에 기록하지 않는다.

```bash
npx wrangler secret put ACCESS_TEAM_DOMAIN
npx wrangler secret put ACCESS_AUD
```

`ACCESS_TEAM_DOMAIN`은 `학교팀.cloudflareaccess.com` 형식이고, `ACCESS_AUD`는 Access application의 Audience 태그다. 운영 교사 요청은 `Cf-Access-Jwt-Assertion`의 서명, issuer, audience, email claim 검증을 모두 통과해야 한다. MVP는 `workers.dev` 주소를 사용하며, 별도 운영 도메인을 붙일 때는 같은 경로 정책을 새 hostname에도 적용한다.

## 배포 전 확인

```bash
npm run build:questions
npm run test:all
npm run typecheck
npx wrangler deploy --dry-run
```

그다음 실제 D1 ID, `workers.dev` 또는 custom domain 경로, Access 정책, 두 환경 변수, 원격 마이그레이션 적용 여부를 확인한 후 `npx wrangler deploy`를 실행한다. 비밀번호, 토큰, 계정 ID는 README나 Git에 넣지 않는다.

## 보존 정책

종료된 교사 리포트와 학생 결과는 90일 보존한다. 매일 실행되는 cron이 90일을 넘긴 D1 결과를 삭제한다. 진행 전 대기실은 24시간 후, 종료된 Durable Object 실시간 상태는 리포트 저장 뒤 24시간 후 정리한다.

## 후속 TODO

- `grammar_escape`: 약한 공포 분위기의 방탈출. 기본 개인전이며 방 생성 때 개인전/2~4팀 협동을 선택하고, 1명 참가 시 같은 엔진을 솔로로 사용한다.
- 교사 로그인: Cloudflare Access application, 허용 교사 이메일, Audience와 팀 도메인 연결. 유료 플랜이나 결제 설정 없이 별도 승인 후 진행한다.
- 문제 세트 영구 보관·공유: 현재 브라우저 임시 저장에서 교사 계정별 세트 라이브러리로 확장한다.
- 수업 리포트: 게임 모드별 아이템·이동·탈출 진행도와 문항별 오답 분포를 추가한다.
