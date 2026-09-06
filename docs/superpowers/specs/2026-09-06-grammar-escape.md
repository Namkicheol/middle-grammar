# 야간학교 탈출 — 구현 계약

2026-09-06. 모드 `grammar_escape`. 기존 솔로 게임/다른 멀티 모드/교사 인증은 변경하지 않는다.

## 플레이

- 제한 시간 안에 교실 → 자료실 → 현관, 총 3개 방을 탈출한다. 약한 공포 분위기이며 점프 스케어·탈락·섬광은 없다.
- 정답마다 조사 기회 1개(최대 6). 각 방에 조사 지점 3개가 있으며 조사마다 기회 1개를 소모하고 숫자 단서를 얻는다.
- 단서에는 기호(달·별·해)가 붙고, 각 방의 잠금 안내에 표시된 기호 순서로 숫자 3개를 입력하면 문이 열린다. 3개 단서를 모두 찾아야 잠금 해제가 가능하다.
- 틀린 퀴즈는 조사 기회를 빼앗지 않는다. 틀린 암호는 3초 재시도 대기만 적용한다. 조사 완료 지점을 다시 누르면 비용 없이 기존 단서를 볼 수 있다.
- 개인전은 각자 진행한다. 팀전은 팀별로 조사 기회·단서·문 진행을 공유하고 개인 퀴즈/정답률은 따로 유지한다. 동시 조사는 seq로 한 번만 처리한다.
- 탈출한 참가자는 문제 풀이를 멈추고 탈출 기록·다른 참가자의 진행을 보며 기다린다. 1명 참가한 방도 동작한다(교사가 여는 1인 방이며 별도의 무인증 솔로 경로는 아님).

## 서버·클라이언트 계약

- `self.escape`: `{ roomIndex: number, roomsCleared: number, totalRooms: 3, title: string, story: string, focus: number, seq: number, escapedAt?: number, retryAt?: number, lockOrder: string[], hotspots: Array<{id:string,label:string,symbol:string,clue?:string}>, discoveredCount:number }`.
- 기호는 `moon`, `star`, `sun`. 방마다 지점 이름·기호 순서는 달라진다. 코드 정답/미발견 숫자는 공개하지 않는다. 각 실행의 암호는 서버에서 생성하고 저장한다.
- WebSocket 요청 `{type:'escape_action', action:'inspect'|'unlock', seq:number, hotspotId?:string, code?:string}`. 결과 `{type:'escape_result', result:{message:string}, room:PublicRoomView}`. 실패는 기존 error 메시지+최신 room으로 재동기화한다.
- 상태는 개인이면 playerId, 팀이면 teamId로 구분해 공유한다. 정답으로 focus가 바뀌거나 조사/문 열기가 성공하면 seq가 증가한다. 만료·다른 모드·탈출 후 동작·잘못된 seq·잘못된 payload를 서버가 거부한다.
- 공개 순위/팀 순위/교사 순위에 선택적 `escape: {roomsCleared:number,discoveredCount:number,escapedAt?:number}`를 추가한다. 다른 사람의 단서나 기회는 공개하지 않는다.
- 순위는 탈출자 우선 → 탈출 시간 오름차순 → 완료 방 수 내림차순 → 현재 방 단서 수 내림차순 → 기존 점수·정답률 동점 규칙. 팀전은 팀 진행 순위가 먼저이며 개인 기록은 별도다.
- 종료 D1 리포트에 탈출 요약을 보존한다(추가 migration). 기존 모드/레거시 리포트는 선택 필드 없이 동작한다.

## 화면

- 모드명 `야간학교 탈출`, 설명 `문제를 풀고 단서를 찾아, 세 개의 문을 열어라`.
- 조사 장면 + 단서 수첩 + 3자리 자물쇠 + 문법 문제. 질문을 접더라도 바로 돌아갈 수 있어야 한다. 팀이면 공유 상태임을 명시한다.
- 장면은 어두운 남색/민트 비상등/앰버 손전등, 글자는 밝고 읽기 쉽게. 390px에서 지점·선택지·입력 최소 44px, 키보드 접근, reduced-motion 준수.
- 탈출 타이틀/교사 진행표/종료 리포트에는 점수보다 방 진행·탈출 시간을 먼저 보여 준다.

## 검증

- 3개 방 완주, 오답·암호 오입력·조사 기회 부족, 정보 노출 없음, 중복/동시 제출, 팀 공유·팀 간 격리, 탈출 후/시간 종료 후 변경 불가, 늦은 입장·재접속, D1 리포트 보존.
- 기존 모드 회귀 테스트·TypeScript·프런트 JS 문법·Aside 실플레이·student-review.
- 요금제·결제·교사 인증 전환은 이번 구현에서 건드리지 않는다.
