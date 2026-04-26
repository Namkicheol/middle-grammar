# middle-grammar — CLAUDE.md

## 프로젝트

중학 영어 문법 워크시트. GitHub Pages 배포. 순수 HTML/CSS/JS.

---

## 스킬 가이드

| 상황 | 호출할 스킬 |
|------|------------|
| 새 워크시트 제작, 문제 유형·난이도 결정, 체크리스트 | `middle-grammar-worksheet` |
| 정답 처리 (norm 함수), 해석 표시, 해설 작성, 배열 순서 | `middle-grammar-answer` |
| 디자인 시스템 (색상·헤더 장식·폰트·문제 타입) | `middle-grammar-design` |
| 효과음 (sounds.js) 연결·수정 | `middle-grammar-sounds` |
| 블로그 글 작성, blog-deploy 파일 형식 | `middle-grammar-blog` |
| 이미지 생성 (Pencil MCP) | `blog-image-pencil` |
| 워크시트 교사 관점 품질 점검 (패턴독점·드릴비율·스캐폴딩) | `teacher-review` agent |

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
| `Ne교과서 md파일/` | NE능률 중1·중2 교과서·기본AB·심화·어법드릴 md |
| `worksheet-sentence-guide.md` | 문제 예문 출처·유형 규칙 가이드 |

---

## NE교과서 자료

**파일 위치**: `Ne교과서 md파일/` (md 파일로 Read 가능)

### 중1

```
2022me_중1_L{1~8}_교과서.md
2022me_중1_L{1~8}_문법연습문제_기본AB.md
2022me_중1_L{1~8}_문법연습문제_심화.md
2022me_중1_L{1~8}_어법드릴문제.md
```

단원별 문법 포인트 (중1):

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

```
(22개정) 중학교 영어 2 교과서 전단원 PDF.md  ← 9000줄, offset/limit으로 해당 Lesson만 읽기
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

단원별 문법 포인트 (중2):

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

**파일 네이밍 규칙 (중2)**: `g2-<topic>-basic/hard/`

---

## 저작권 주의

> NE능률 2022 개정 교과서의 저작권은 NE능률에 귀속된다.
> 문장을 그대로 사용하는 것은 금지. 반드시 변형 사용. → 상세 변형 기준은 `middle-grammar-worksheet` 스킬 참고.
