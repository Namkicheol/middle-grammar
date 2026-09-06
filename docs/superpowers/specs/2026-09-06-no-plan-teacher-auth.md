# 요금제 선택 없는 교사 로그인 설계

상태: 2026-09-06 Google OAuth 운영 연결·원격 migration 0005·인증 코드 배포와 소유자 관리자 로그인 E2E 완료. Google 앱은 테스트 상태이며 다른 교사 추가·게시 준비는 남아 있다. 사용자 지시에 따라 기존 Cloudflare Access 도입 계획을 대체한다.

## 비용 경계

- Cloudflare Access / Zero Trust는 사용하지 않는다. 무료 항목을 포함해 신규 요금제 선택, 카드 등록, 구독 활성화를 요구하지 않는다.
- 교사 인증은 Google OpenID Connect를 Worker에 직접 연결한다. Firebase Identity Platform, 문자 인증, 유료 이메일 발송 서비스는 도입하지 않는다.
- 이미 사용하는 Worker·SQLite Durable Object·D1의 무료 범위를 전제로 한다. 기존 계정의 실제 상품 상태는 배포 전 읽기 전용으로 확인하며, 임의로 상품이나 구독을 변경하지 않는다.
- 무료 범위는 무제한 사용을 뜻하지 않는다. 방 생성·참가·인증 요청에 제한을 두고, 한도에 도달하면 재시도 안내와 함께 이용을 제한한다. 자동 유료 전환은 구현·신청하지 않는다.

## 교사·학생 흐름

1. 교사가 Google 로그인 버튼을 누른다. 로그인용 OAuth 웹 앱 등록은 필요하지만 결제나 Cloudflare Access 가입은 필요 없다.
2. 서버가 Google의 authorization code를 교환하고 ID token의 서명, issuer, audience, 만료, nonce, `email_verified`를 검증한다.
3. 운영자가 등록한 교사 이메일 허용 목록과 대조한다. Google 계정이 있다는 이유만으로 방 생성 권한을 부여하지 않는다. 처음 로그인 시 검증된 `sub`와 이메일을 교사 레코드에 연결하며 이후 식별은 `sub`를 기준으로 한다.
4. 서버가 임의의 세션 토큰을 발급하고 해시만 D1에 저장한다. 브라우저에는 `Secure; HttpOnly; SameSite=Lax; Path=/`인 host-only 쿠키를 저장한다. 만료는 8시간, 로그아웃은 서버 세션 폐기와 쿠키 삭제를 함께 한다.
5. 교사는 본인 방과 리포트만 관리한다. 기존 이메일 기반 방 소유권도 검증된 교사 정보와 연결해 유지한다.
6. 학생은 기존처럼 계정 없이 6자리 번호·QR·닉네임으로 참가한다.
7. 소유자는 서버의 `ADMIN_EMAILS`에 관리자, 추가 교사는 `TEACHER_EMAILS`에 일반 교사로 등록한다. 클라이언트 입력으로 역할을 바꿀 수 없다. 현재 관리자는 본인 방 소유권 규칙을 유지하며, 별도 교사 관리 UI·타 교사 데이터 접근 권한은 추가하지 않는다.

## 보안과 연결

- 인증 시작/콜백에 일회성 state, nonce, PKCE S256을 사용하고 실패·재사용·만료를 거부한다. 콜백 주소는 운영 origin의 고정 경로이며 임의 외부 redirect는 허용하지 않는다.
- 생성·시작·종료·로그아웃 등 변경 API는 동일 origin과 CSRF 토큰을 검증한다. 교사 WebSocket도 세션과 Origin을 검사하며 로그아웃·세션 만료 뒤 기존 소켓을 닫는다.
- 세션, OAuth code, 비밀값은 URL 로그·localStorage·Git·Obsidian에 기록하지 않는다. Google에서 받은 access/refresh token은 보관하지 않는다.
- 로컬 loopback 개발용 인증만 유지한다. 운영에서는 개발 헤더나 Access 헤더만으로 로그인할 수 없게 한다.
- 설정 누락 시 안전하게 차단하되, 사용자에게 요금제 가입을 안내하지 않고 로그인 연결 준비 중임을 알린다.
- 멀티 앱과 인증 API를 현재 Worker의 같은 origin에서 제공해 쿠키가 Vercel과 Worker 사이를 건너지 않게 한다.

## 구현 순서와 검증

1. `src/index.ts`의 `requireTeacher`와 `src/types.ts`의 Access 설정을 자체 인증 모듈로 대체한다. Google 시작·콜백·세션 확인·로그아웃 경로와 D1 교사/세션 migration을 추가한다.
2. `multiplayer/app.js`의 `/cdn-cgi/access/login` 이동을 새 로그인 시작 경로로 교체하고 로그인 상태·오류·로그아웃을 연결한다.
3. 위조/만료 토큰, 잘못된 audience·nonce·state, 콜백 재사용, 미허용 이메일, CSRF, 타 교사 방 접근, WebSocket Origin, 로그아웃·만료를 테스트한다. 학생 참가와 기존 게임 회귀 테스트를 유지한다.
4. Google OAuth 클라이언트와 허용 교사 목록을 연결한다. 허용 이메일은 사용자에게 확인하며 추정하거나 전체 Google 계정을 허용하지 않는다. 계정 동의가 필요한 화면은 사용자에게 맡긴다.
5. Aside에서 실제 교사 로그인 → 방 생성 → 학생 참가 → 종료 리포트 → 로그아웃을 확인한 뒤에만 운영 로그인 완료로 보고한다.

## 현재와 목표의 구분

현재 로컬·운영 코드는 Access JWT 대신 Google 직접 로그인·자체 세션을 사용한다. Worker 버전 `4078ef21-6d3f-468a-9f2b-0473ddb8d763`에서 설정 완료 응답과 실제 관리자 로그인, 방 생성, 테스트 학생 참가·응답, 종료 리포트, 로그아웃·재로그인을 확인했다. UI 확인은 사용자가 지정한 Codex 옆 브라우저에서 수행했다. 미인증 교사 API는 여전히 401로 차단되며, 인증을 비활성화하는 우회는 하지 않는다. 다른 교사의 허용 목록·Google 앱 게시와 추가 관리 UI는 완료 범위에 포함하지 않는다.

## 공식 참고

- [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect)
- [Google 로그인 앱 등록](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid)
- [Google 로그인 Codelab](https://codelabs.developers.google.com/codelabs/sign-in-with-google-button)
- [Workers 무료 한도](https://developers.cloudflare.com/workers/platform/limits/)
- [SQLite Durable Objects 무료 제공](https://developers.cloudflare.com/durable-objects/)
