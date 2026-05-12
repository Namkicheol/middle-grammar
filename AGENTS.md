# middle-grammar — AGENTS.md

## 프로젝트

중학 영어 문법 워크시트. GitHub Pages 배포. 순수 HTML/CSS/JS.

Codex 작업 시 이 파일을 우선 읽고, 세부 규칙은 아래 로컬 문서를 참고한다. 기존 `CLAUDE.md`는 Claude용 legacy 문서이므로, 지침이 충돌하면 `AGENTS.md`를 우선한다.

---

## Codex 작업 원칙

1. 요청 범위만 외과적으로 수정한다. 관련 없는 리팩토링, 디자인 전면 개편, 새 의존성 추가 금지.
2. 사용자가 명시하지 않으면 `git add`, `commit`, `push`를 자동 실행하지 않는다.
3. 이미 수정된 파일은 사용자 변경으로 간주하고 되돌리지 않는다.
4. 새 워크시트나 대형 수정은 먼저 관련 NE 자료와 가이드 문서를 읽고 진행한다.
5. 테스트/검증은 변경 범위에 맞게 한다. HTML 워크시트는 최소한 브라우저 콘솔 오류, 정답 처리, `sounds.js`/`score-popup.js` 로드 순서를 확인한다.

---

## 로컬 지침 문서

| 상황 | Codex에서 참고할 문서 |
|------|----------------------|
| 새 워크시트 제작, 문제 유형·난이도 결정, 체크리스트 | `.claude/skills/middle-grammar-worksheet/SKILL.md` |
| 정답 처리, `norm()`, 해석 표시, 해설 작성, 배열 순서 | `.claude/skills/middle-grammar-answer/SKILL.md`, `answer-checker-guide.md` |
| 디자인 시스템, 색상·헤더 장식·폰트·문제 타입 | `.claude/skills/middle-grammar-design/SKILL.md` |
| 효과음 연결·수정 | `.claude/skills/middle-grammar-sounds/SKILL.md` |
| 블로그 글, `blog-deploy` 파일 형식 | `.claude/skills/middle-grammar-blog/SKILL.md` |
| 블로그 이미지(Pencil) | `.claude/skills/blog-image-pencil/SKILL.md` |
| 워크시트 교사 관점 품질 점검 | `.claude/agents/teacher-review.md`의 체크리스트를 수동 적용 |

주의: 위 파일들은 Claude custom skill/agent 형식이지만, Codex에서는 자동 호출 대상이 아니라 로컬 참고 문서로 읽고 적용한다.

---

## 파일 구조

| 경로 | 내용 |
|------|------|
| `index.html` | 메인 허브 (단원 목록) |
| `be-verb/v2.html` | be동사 + 일반동사 현재형 (45문제) |
| `past-be/index.html` | be동사 과거형 기본 (40문제) |
| `past-be-hard/index.html` | be동사 과거형 심화 (25문제) |
| `general-verb-hard/index.html` | 일반동사 심화 (25문제) |
| `gerund-basic/index.html` | 현재진행형 vs 동명사 기초 — Pretendard 스타일 (50문제) |
| `gerund-basic/index2.html` | 현재진행형 vs 동명사 기초 — Baloo 2 스타일 (50문제) |
| `gerund-hard/index.html` | 현재진행형 vs 동명사 심화 (50문제) |
| `to-will-basic/index.html` | to부정사 & 조동사 will/should 기초 (45문제) |
| `to-will-hard/index.html` | to부정사 & 조동사 will/should 심화 (25문제) |
| `g2-give-relclause-basic/index.html` | 중2 L1 수여동사 & 주격 관계대명사 기초 |
| `g2-give-relclause-hard/index.html` | 중2 L1 수여동사 & 주격 관계대명사 심화 |
| `g2-perfect-compare-basic/index.html` | 중2 L2 현재완료 & 비교급·최상급 기초 |
| `g2-perfect-compare-hard/index.html` | 중2 L2 현재완료 & 비교급·최상급 심화 |
| `g2-to-if-basic/index.html` | 중2 L3 형용사적 to부정사 & 접속사 if 기초 (40문제) |
| `g2-to-if-hard/index.html` | 중2 L3 형용사적 to부정사 & 접속사 if 심화 (25문제) |
| `sounds.js` | 효과음 (Web Audio API) |
| `score-popup.js` | 점수 결과 팝업 |
| `Ne교과서 md파일/` | NE능률 중1·중2 교과서·기본AB·심화·어법드릴 md |
| `worksheet-sentence-guide.md` | 문제 예문 출처·유형 규칙 가이드 |
| `answer-checker-guide.md` | 정답 처리·검증 가이드 |

---

## NE교과서 자료

**파일 위치**: `Ne교과서 md파일/` (로컬 참고용. 원문 복사 금지)

### 중1

```text
2022me_중1_L{1~8}_교과서.md
2022me_중1_L{1~8}_문법연습문제_기본AB.md
2022me_중1_L{1~8}_문법연습문제_심화.md
2022me_중1_L{1~8}_어법드릴문제.md
```

| 단원 | 핵심 문법 |
|------|-----------|
| L1 | be동사 현재형·부정문, 일반동사 현재형·부정문 |
| L2 | 현재진행형·의문문, 동명사 (avoid/enjoy/keep 등) |
| L3 | be동사·일반동사 과거형, 시간 접속사 when |
| L4 | 동사의 목적어로 쓰인 to부정사, 조동사 will·should |
| L5 | 재귀대명사, 목적을 나타내는 to부정사 |
| L6 | 감각동사 look+형용사, 이유 접속사 because |
| L7 | make+목적어+형용사, 명사절 접속사 that |
| L8 | 감탄문 (How/What), something+형용사 |

### 중2

```text
(22개정) 중학교 영어 2 교과서 전단원 PDF.md
2022me_중2_L{1~8}_문법연습문제_기본AB.md
2022me_중2_L{1~8}_문법연습문제_심화.md
```

중2 통합 파일 Lesson별 줄 범위:

| Lesson | 시작 줄 | 끝 줄 |
|--------|--------|-------|
| L1 | 1 | 1663 |
| L2 | 1664 | 2913 |
| L3 | 2914 | 4058 |
| L4 | 4059 | 5252 |
| L5 | 5253 | 6432 |
| L6 | 6433 | 8064 |
| L7~L8 | 8065 | 9092 |

| 단원 | 핵심 문법 |
|------|-----------|
| L1 | 수여동사 (give/show/tell/make/buy), 주격 관계대명사 (who/which/that) |
| L2 | 현재완료 (have+p.p.), 비교급·최상급 |
| L3 | 형용사적 용법 to부정사 (명사 수식), 접속사 if |
| L4 | so ~ that, 수동태 |
| L5 | 동사+목적어+to부정사, 목적격 관계대명사 |
| L6 | 지각동사+목적어+-ing/동사원형, 간접의문문 |
| L7 | make/let/have+목적어+동사원형, as+원급+as |
| L8 | 가주어 it, 의문사+to부정사 |

**파일 네이밍 규칙 (중2)**: `g2-<topic>-basic/`, `g2-<topic>-hard/`

---

## 저작권 및 문장 변형

NE능률 2022 개정 교과서의 저작권은 NE능률에 귀속된다. 교과서·교재 문장을 그대로 사용하지 않는다.

- 이름·대명사만 바꾸는 것은 불충분하다.
- 주어, 목적어, 장소, 시간, 소재 등 최소 2개 이상을 바꾼다.
- 교과서 참고 예문과 창작 예문을 대략 50:50으로 섞는다.
- 자세한 기준은 `worksheet-sentence-guide.md`와 `.claude/skills/middle-grammar-worksheet/SKILL.md`를 따른다.

---

## 한국어 용어 규칙

도출과정·정답 해설·개념 설명 등 한국어 텍스트 작성 시, 이 레포의 문서와 제공된 교재/기출 원문에 있는 한국어 표현만 사용한다.

- refs에 없는 한국어 번역어를 새로 만들지 않는다.
- refs에서 한국어 표현을 찾지 못하면 영어 원어를 그대로 쓴다.
- 같은 파일 안에서 같은 개념의 한국어/영어 표현을 혼용하지 않는다.

---

## 새 워크시트 체크리스트

- [ ] 관련 NE 자료와 `worksheet-sentence-guide.md`를 읽고 핵심 패턴 파악.
- [ ] 예문은 교과서 참고 변형 50% + 창작 50%. 원문 그대로 금지.
- [ ] 문제 유형은 `mcq`, `input`, `scramble`, `dist` 등을 자연스럽게 분산.
- [ ] 기초는 35~50문제, 심화는 종합훈련 15 + 짧은 지문 10 구조 우선.
- [ ] `norm()` 적용, 빈 입력 방지, `q-kor`, `answer-hint` 규칙 확인.
- [ ] scramble 단어 칩 순서는 정답 순서와 다르게 배치.
- [ ] `sounds.js`, `score-popup.js` 로드 순서 확인.
- [ ] `index.html` 허브 카드 추가가 필요한지 확인.
- [ ] 한국어 텍스트에 임의 조어가 없는지 확인.
- [ ] 교사 관점 점검: 패턴 독점, drill 비율, 스캐폴딩, 오답 선택지, 난이도 progression.

---

## 하지 말 것

- 요청 외 워크시트 디자인 전면 개편.
- `index.html` 메인 허브 레이아웃 변경 (카드 추가/순서 조정 외).
- 새 디자인 시스템·컴포넌트 라이브러리·외부 JS 의존성 추가.
- NE교과서 원문 복사·인용.
- refs에 없는 한국어 개념 번역어 도입.
