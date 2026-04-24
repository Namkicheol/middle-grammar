# middle-grammar — CLAUDE.md

## 프로젝트

중학 영어 문법 워크시트. GitHub Pages 배포. 순수 HTML/CSS/JS.

---

## 정답 처리 규칙 (필수)

### 텍스트 입력 정답 비교

모든 주관식 입력은 반드시 아래 두 조건을 동시에 적용한다.

1. **대소문자 무시** — `toLowerCase()` 후 비교
2. **축약형 ↔ 전체형 동일 처리** — 아래 norm 함수 적용

```javascript
function norm(s) {
  s = s.trim().toLowerCase().replace(/\s+/g, ' ');
  s = s.replace(/isn't/g,'is not').replace(/aren't/g,'are not')
       .replace(/wasn't/g,'was not').replace(/weren't/g,'were not')
       .replace(/don't/g,'do not').replace(/doesn't/g,'does not')
       .replace(/didn't/g,'did not').replace(/won't/g,'will not')
       .replace(/can't/g,'cannot').replace(/shouldn't/g,'should not');
  return s;
}
// 비교: norm(입력값) === norm(정답)
```

- `doesn't eat` ↔ `does not eat` → 동일 정답
- `Are you waiting` ↔ `are you waiting` → 동일 정답
- `isn't studying` ↔ `is not studying` → 동일 정답

### 빈 입력 방지 (필수)

`checkBlank` / `checkArrange` 모두 빈 상태로 제출 시 정답이 노출되는 버그 방지:

```javascript
// checkBlank
function checkBlank(k) {
  var inp = document.getElementById('bi-'+k);
  var card = document.getElementById('qc-'+k);
  if (card.classList.contains('ok') || card.classList.contains('ng')) return;
  if (!inp.value.trim()) { toast('답을 입력하세요!','ng'); inp.focus(); return; }
  // ...이하 정답 비교
}

// checkArrange
function checkArrange(btn) {
  var k = btn.dataset.qid;
  var card = document.getElementById('qc-'+k);
  if (card.classList.contains('ok') || card.classList.contains('ng')) return;
  if (!placed[k].length) { toast('단어를 배열하세요!','ng'); return; }
  // ...이하 정답 비교
}
```

### 객관식 버튼

버튼 텍스트가 정답과 동일하게 렌더링되므로 별도 norm 불필요. 단, 버튼과 `data-ans` 값은 완전히 일치시켜야 함.

### -ly 형용사 문제 (2026-04-24 추가)

look + 형용사 단원 등에서 **lovely · friendly · lively · lonely · kindly** 등 -ly로 끝나지만 형용사인 단어를 정답으로 하는 문제를 섞어 출제한다. "-ly = 부사"라는 선입견을 교정하는 데 효과적. 선택지에 -ly 부사형(lovingly 등)과 나란히 배치하여 구별 연습.

### ans2 (보조 정답)

완전히 다른 표현이 두 가지 모두 정답일 때만 사용. 축약형/전체형 차이는 norm으로 처리하므로 `ans2` 불필요.

---

## NE교과서 자료 (참고 자료)

### 저작권 주의

> NE능률 2022 개정 교과서 및 부속 교재의 저작권은 NE능률에 귀속된다.
> **문장을 그대로 사용하는 것은 금지.** 예문의 구조·어휘·맥락을 참고하되, 인명·소재·수치 등을 바꾸어 반드시 변형해서 사용한다. → 변형 상세 기준은 아래 "문장 변형 규칙 (필수)" 참조.

---

### 중1 교과서 자료

**파일 위치**: `Ne교과서 md파일/` (md 파일로 바로 Read 가능)

```
Ne교과서 md파일/
  2022me_중1_L{1~8}_교과서.md              ← 교과서 본문 대화·지문
  2022me_중1_L{1~8}_문법연습문제_기본AB.md  ← 기본 문법 연습 문제
  2022me_중1_L{1~8}_문법연습문제_심화.md    ← 심화 문법 연습 문제
  2022me_중1_L{1~8}_어법드릴문제.md         ← 어법 드릴 (단순 반복 연습)
```

**각 파일의 역할**:

| 파일 | 내용 | 워크시트 활용 |
|------|------|--------------|
| `_교과서.md` | 본문 대화·지문 (인물명·상황 포함) | 예문 소재·맥락 참고 후 변형 |
| `_문법연습문제_기본AB.md` | 선택·빈칸 채우기·단문 완성 | 기본 유형 문제 형식 참고 |
| `_문법연습문제_심화.md` | 오류 수정·문장 전환·단어 배열·두 문장 합치기 | 심화 유형 문제 형식 참고 |
| `_어법드릴문제.md` | 문법 포인트별 반복 훈련 (10문항) | 심화 유형 문제 형식 참고 |

**단원별 문법 포인트 (중1)**:

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

---

### 중2 교과서 자료

**파일 위치**: `Ne교과서 md파일/` (중1과 동일 폴더, md 파일로 바로 Read 가능)

```
Ne교과서 md파일/
  (22개정) 중학교 영어 2 교과서 전단원 PDF.md  ← 교과서 본문 전단원 통합 (L1~L8, ~9000줄)
  2022me_중2_L{1~8}_문법연습문제_기본AB.md      ← 기본 문법 연습 문제
  2022me_중2_L{1~8}_문법연습문제_심화.md        ← 심화 문법 연습 문제
```

> 중2 어법드릴 md는 없다. 교과서 본문은 통합 파일 한 개로 관리됨.
> 통합 파일은 9000줄이므로 Read 시 `offset`/`limit`으로 해당 Lesson 범위만 읽는다.

**통합 파일 Lesson별 줄 범위 (대략)**:

| Lesson | 시작 줄 | 끝 줄 |
|--------|--------|-------|
| L1 | 1 | 1663 |
| L2 | 1664 | 2913 |
| L3 | 2914 | 4058 |
| L4 | 4059 | 5252 |
| L5 | 5253 | 6432 |
| L6 | 6433 | 8064 |
| L7~L8 | 8065 | 9092 |

**단원별 문법 포인트 (중2)**:

| 단원 | 핵심 문법 |
|------|-----------|
| L1 | 수여동사 (give/show/tell/make/buy), 주격 관계대명사 (who/which/that) |
| L2 | 현재완료 (have+p.p.), 비교급·최상급 |
| L3 | 형용사적 용법 to부정사 (명사 수식), so ~ that … |
| L4 | so ~ that, 수동태 |
| L5 | 동사+목적어+to부정사, 목적격 관계대명사 |
| L6 | 지각동사+목적어+-ing/동사원형, 간접의문문 |
| L7 | make/let/have+목적어+동사원형, as+원급+as |
| L8 | 가주어 it, 의문사+to부정사 |

**파일 네이밍 규칙 (중2)**: `g2-<topic>-basic/hard/` (예: `g2-give-relclause-basic`)

### 문장 변형 규칙 (필수 · 강제)

교과서·교재 예문을 참고할 때 **이름·대명사만 교체하는 건 불충분**. 문법 포인트·문장 길이는 유지하되, 아래 요소 중 **주어 + 목적어/부사구를 포함해 최소 2개** 이상 바꿔서 원문과 눈에 띄게 다르게 만든다.

- **인명 교체**: Jenny → Mia, Kevin → Jake 등 (교과서에 등장한 그대로 사용 금지)
- **소재 교체**: 스포츠·음식·직업 등 구체적 어휘 변경
- **수치·장소 교체**: 숫자, 요일, 나라명 등 변경
- **문장 구조 유지, 어휘만 교체**: 동일 문법 포인트를 다른 소재로 표현

```
❌ 원본: He (am / is) my teacher.
❌ 부족: She (am / is) my teacher.          (대명사만)
✅ 충분: She (am / is) our coach.           (주어 + 목적어)

❌ 원본: I kept waiting for one hour for my friend. (wait)
❌ 부족: She kept waiting for one hour for her friend. (대명사만)
✅ 충분: Mia kept waiting for two hours for her cousin. (주어·시간·대상)

❌ 원본: When Paul came home, his sister was watching television.
❌ 부족: When Jake came home, his sister was watching television.  (이름만)
✅ 충분: When Jake got home, his brother was playing video games.
```

### 예문 출처 방침 (2026-04-24 업데이트)

교과서 예문 참고와 Claude 자체 창작을 **약 반반(50:50)** 섞어 사용한다.

- **교과서 참고 예문**: 해당 Lesson md 파일을 소재·맥락·문형 참고 후 변형. 문장을 그대로 복사 금지.
- **Claude 자체 창작 예문**: 문법 포인트에 맞는 자연스러운 문장을 직접 작성. 교과서 참고 불필요.

**교과서 참고 예문을 쓸 때 대조 검증 (교과서 참고 시에만 적용):**

1. 해당 Lesson md 파일 Read 후 핵심 구절(동사+목적어, 주요 명사, 장소)을 Grep으로 검색
2. 매칭되면 → 주어·목적어·부사구를 **최소 2개 더** 바꿔서 재작성
3. 이름·대명사만 교체는 불충분 — 최소 2요소 이상 교체 필수 (저작권)

> Claude 자체 창작 예문에는 md 파일 Read·Grep 불필요. 문법 포인트와 수준에만 맞으면 된다.

**왜 이 규칙이 필요한가 (2026-04-23 사고 기록):**
L5 reflexive-to 기초·심화 제작 시 7개 문장이 원본과 구조·어휘가 일치(일부는 완전 동일)해 저작권 위험·변형 기준 미달 상태로 커밋됨. 교과서를 참고할 때는 반드시 변형 기준을 지킨다.

### 중2 기초 워크시트 난이도 방침 (2026-04-24 추가)

교과서 **"Let's use it"** 수준을 기준으로 한다. 말 그대로 기초 — 개념 확인과 단순 응용이 목적.

**학습유형 60% + 연습유형 40%** 비율로 구성한다.

| 구분 | 설명 | 문제 유형 |
|------|------|----------|
| 학습유형 (60%) | 괄호 안에서 고르기, 문법 개념 바로 적용 | MCQ 4지선다 |
| 연습유형 (40%) | 빈칸 채우기, 단어 배열 | input · scramble |

**기초에서 내는 것 / 내지 않는 것:**

| 수여동사 | 주격 관계대명사 |
|---------|----------------|
| ✅ IO(목적격 대명사) 고르기: gave ___ a book → me/him/her/us/them | ✅ who/which/that 고르기 (선행사 기준) |
| ✅ IO+DO 어순 맞는 것 고르기: gave me a book vs gave a book me | ✅ 빈칸에 who/which/that 쓰기 |
| ✅ 수여동사 동사형 선택 (give/show/tell/make/buy) | ✅ 두 문장 → 관계대명사로 합치기 (간단) |
| ❌ IO+DO ↔ DO+전치사+IO 전환 → **심화에서만** | ❌ 복잡한 선행사 판단 (사람/사물/동물 혼합 고난도) |
| ✅ to/for MCQ 인식 문제(3~4문제 소량) — give→to, make→for 구별 | |
| ❌ to/for/of 전치사 전체 문장 변환 → **심화에서만** | |

> **피드백 (2026-04-24~25):** 전치사 문제를 기초에서 아예 빼면 안 됨. 단, **변환(문장 전체 바꾸기)**은 어렵고 **인식(MCQ로 to/for 선택)**은 기초 수준에 적합. → to/for MCQ 3~4문제 소량 포함, 전체 문장 변환은 심화 전용.

### 기본 유형 제작 (기존 방식 유지)

교과서 예문 참고 + Claude 자체 창작을 반반 섞어 사용. 교과서 참고 시 변형 기준 적용.

- 문제 형식: 현재 워크시트의 `mcq` / `input` / `scramble` / `dist` 방식
- 단문(s0) 중심, ctx 없음
- be동사·일반동사 기초 → 진행형·동명사 → 과거형 순서

### 심화 유형 제작 (기존 방식 유지 + 추가 유형)

기존 심화 방식을 유지하면서 아래 유형을 추가로 활용할 수 있다. **문장은 반드시 변형.**

| 유형 | 설명 | 출처 예시 |
|------|------|-----------|
| 오류 수정 | 밑줄 친 부분을 올바른 형태로 고쳐 쓰기 | `_심화.md` A유형 |
| 문장 전환 | 주어 교체 / 긍·부정·의문문으로 바꾸기 | `_심화.md` B유형 |
| 두 문장 합치기 | when / because / that으로 연결 | `_심화.md` / `_드릴.md` B유형 |
| 반복 드릴 | 동일 문법 포인트 10문항 집중 훈련 | `_어법드릴문제.md` |
| 문장 완성 (우리말) | 한국어 해석 주고 괄호 단어로 영문 완성 | `_심화.md` C유형 |

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
| `sounds.js` | 효과음 (Web Audio API, 외부 파일 없음) |
| `Ne교과서 md파일/` | NE능률 중1(교과서·기본AB·심화·어법드릴) + 중2(기본AB·심화) md |
| `NE 능률 중2 교과서 자료/` | 중2 원본 .hwp 파일 (L1~L8) |
| `worksheet-sentence-guide.md` | 문제 예문 출처·유형 규칙 가이드 |

---

## 디자인 시스템

### 색상 테마

| 파일 | 테마 |
|------|------|
| `index.html`, `be-verb/v2.html`, `gerund-basic/index2.html`, `gerund-hard/index.html`, `to-will-basic/index.html` | Baloo 2 · 파란 그라디언트 (`#0ea5e9 → #6366f1`) |
| `general-verb-hard/index.html`, `past-be/index.html`, `past-be-hard/index.html`, `to-will-hard/index.html` | Baloo 2 · 다크 네이비 + 앰버 골드 (`#1e2a4a`, `#f59e0b`) |
| `gerund-basic/index.html` | Pretendard · 다크 네이비 + 앰버 골드 (`#0f172a`, `#fbbf24`) |

### 심화 워크시트 헤더 장식 (필수 · 2026-04-21~)

`past-be-hard`, `to-will-hard` 이후 제작되는 **모든 다크 네이비 테마 심화 워크시트**는 다음 헤더 장식 요소를 포함한다. 단조로운 감을 줄이기 위한 표준 규격이다.

| 요소 | 내용 |
|------|------|
| `.h-letter` × 4 | 주제와 관련된 알파벳/기호 4개를 각 모서리에 떠다니게 배치 (투명도 `rgba(245,158,11,.14)`, `floatL` 9/11/7/13s 무한 애니메이션) |
| `.h-orb` × 2 | blur 50px 그라디언트 원 2개 (오렌지 + 인디고) |
| `.header::before` | 22px 간격 도트 그리드 |
| `.header::after` | 하단 웨이브(반원) 컷 |
| `.hbadge-dot` | 상단 배지 안의 펄스 애니메이션 점 |
| `padding` | `44px 20px 54px` (기본 `24px 20px 32px`보다 크게) |

예시: `to-will-hard`는 A/B/C/D, `past-be-hard`는 W/A/S/?. 알파벳 대신 "!" · "?" 등 의미 있는 기호도 가능.

### 섹션 헤더·지문 폰트 (심화 공통)

```css
.sec-hdr .lbl  { font-size:.78rem; }
.sec-hdr h2    { font-size:1.18rem; }
.sec-hdr .desc { font-size:.95rem; color:#5a6b8a; font-weight:500; line-height:1.55; }
.passage       { font-size:1.02rem; line-height:1.9; padding:18px 20px; }
.passage .ptitle{ font-size:.78rem; }
```

이전의 `.desc .8rem / gray` · `.passage .9rem`은 너무 작다는 피드백으로 상향 조정됨 (2026-04-21).

### 단어 뱃지 (vocab)

- `general-verb-hard`, `past-be-hard`: `.vocab` div — 기본 숨김, "📖 단어 보기 ▾" 버튼 클릭 시 토글
- `be-verb/v2.html`: JS 자동 주입 (`vocabData` 객체)
- `gerund-hard`: `vocabMap` 객체로 globalNum 기준 자동 주입
- 동명사 파일 sec0/sec1: `kor` 필드로 한국어 해석 표시 (context 제공용)
- 동명사 파일 sec2(구분하기): `kor` 필드로 한국어 해석 표시

### 문제 타입

| 타입 | 설명 |
|------|------|
| `mcq` | 객관식 4지선다 |
| `input` | 주관식 입력 |
| `scramble` | 단어 배열 |
| `dist` | 현재진행형 vs 동명사 구분 (2지선다) |

---

## 기초 워크시트 — 문제 내 한국어 해석 표시 규칙 (필수 · 2026-04-25 추가)

기초 워크시트의 MCQ·input 문제는 **영문 q-text 바로 아래**에 `.q-kor` div로 한국어 전체 해석을 표시한다.

```html
<!-- MCQ 예시 -->
<div class='q-text'>They <em>___</em> lived here for ten years.</div>
<div class='q-kor'>그들은 10년 동안 여기서 살아 왔다.</div>
<div class='choices' ...>

<!-- input 예시 (q-text에 input이 포함된 경우: q-text 뒤, check-btn 앞) -->
<div class='q-text'>She <input ...> six countries so far.</div>
<div class='q-kor'>그녀는 지금까지 여섯 나라를 방문했다.</div>
<button class='check-btn' ...>
```

**적용 기준:**
- ✅ 특정 영문 문장이 있는 MCQ (have/has 고르기, 형태 고르기, since/for 고르기 등): 해당 문장 해석 표시
- ✅ "다음 중 어법에 맞는 것 고르기" 유형: 정답 문장의 의미(Korean) 표시 — 정답을 노출하지 않고 목표 의미를 알려줌
- ✅ 빈칸 input 문제: 완성된 문장의 전체 해석 표시
- ❌ scramble(단어 배열): q-text 자체가 `📌 [한국어]` 형태이므로 **q-kor 불필요 (중복)**

**CSS (기초 워크시트 공통):**
```css
.q-kor{font-size:.82rem;color:#1e6fa0;font-weight:600;margin-bottom:10px;padding:4px 10px;background:#e0f2fe;border-radius:6px;}
```

> 이 규칙은 신규 기초 워크시트부터 적용. 기존 파일은 사용자 요청 시 업데이트.

---

## 해설(answer-hint) 작성 규칙

모든 문제의 해설에는 반드시 **한국어 전체 문장 해석**을 포함한다.

```html
<!-- 정적 HTML 방식 -->
<div class="answer-hint" id="ah-a1">
  💡 정답: <strong>was</strong> — The box(단수) → was<br>
  📝 해석: 선반 위의 상자는 비어 있었다.
</div>

<!-- JS render 방식 (gerund-hard) -->
html += `<div class='answer-hint' id='ah-${id}'>💡 <strong>정답: ${q.ans}</strong><br>📝 해석: ${q.kor}<br><br>👉 해설: ${q.hint}${vHtml}</div>`;
```

- 요약 아님 — 영어 문장 전체를 번역한 완전한 문장
- Mr.Kim / Mr. / Mrs. 등 호칭은 절대 한국어로 번역하지 않음 (예: "김씨" 금지)
- **예외: scramble(배열) 문제** — `q-text` 자체가 `📌 [한국어]` 형태면 `📝 해석:` 생략 가능 (중복이므로)

---

## 섹션 구성 규칙

### ctx div (한국어 맥락 제공)

- s0(단문 문제): 문제 위 한국어 요약·맥락 div **금지** — 해설에만 해석 제공
- s1(짧은 지문): 지문 내용을 `<div class="ctx">📖 지문 A — ...</div>` 형태로 제공 가능
- s1(단어 배열): ctx는 배열 목표 문장의 한국어 버전으로 사용

### 짧은 지문 (s1) 형식

- **TOEIC Part 6 형식 금지** (선택지 (A)~(D) + 지문 라벨 형식)
- 대신: 지문은 `ctx` 박스로 위에 표시하고, 문제는 **빈칸 직접 입력** 방식으로 구성

### 10번 이후 be동사 힌트

- 10번부터 `(be)` 또는 `(be, 부정형)` 힌트를 q-text 안에 추가:

```html
<span class="ex">(be)</span>
<span class="ex">(be, 부정형)</span>
```

---

## 효과음 시스템 (sounds.js)

Web Audio API 기반. 외부 오디오 파일 없이 브라우저에서 직접 생성.

### 사운드 종류

| 상황 | 내용 |
|------|------|
| 정답 | E5→G5 밝은 두 음 (sine) |
| 오답 | D4→B3 부드러운 낮은 두 음 (triangle, 기분 안 나쁘게) |
| 섹션/결과 70점↑ | C5-E5-G5-C6 4음 팡파르 |
| 섹션/결과 50~69점 | C5-E5-G5 3음 |
| 섹션/결과 50점 미만 | C5-D5 2음 (격려) |

- 빈칸 미입력(`답을 입력하세요!`) 등 유효성 오류는 오답 소리 없음
- 섹션 팝업 + 결과화면 동시 발생 시 1.5초 쿨다운으로 중복 재생 방지

### 연결 방식

`sounds.js`는 `window.toast` / `window.egmToast` / `window.showScorePopup`을 래핑하고, `MutationObserver`로 `#result` / `#egm-result` div를 감지한다. **각 워크시트 HTML은 별도 수정 불필요** — `score-popup.js` 다음에 스크립트 한 줄만 추가.

```html
<script src="../score-popup.js"></script>
<script src="../sounds.js"></script>
```

- `gerund-basic/index.html`은 `egmToast`(type: `'o'`/`'x'`) 사용 → 자동 감지
- 나머지 6개 파일은 `toast`(type: `'ok'`/`'ng'`) 사용 → 자동 감지

### 새 워크시트에 효과음 추가 시

`score-popup.js` 뒤에 `<script src="../sounds.js"></script>` 한 줄 추가. `toast` 함수가 표준 패턴(`type: 'ok'`/`'ng'`)을 따르면 자동으로 작동.

---

## 배열(scramble) 문제 단어 순서 규칙 (필수)

단어 칩은 반드시 정답 문장 순서와 **달라야** 한다. 정답 순서 그대로 나열하면 배열 문제의 의미가 없어진다.

- 정적 HTML(`word-pool` 버튼): 버튼 순서를 정답 순서와 다르게 배치
- JS 데이터(`words` 배열): 배열 내 단어 순서를 정답 순서와 다르게 작성

```html
<!-- 나쁜 예 (정답 순서 그대로) -->
<button>She</button><button>writes</button><button>in</button><button>her</button><button>diary</button>

<!-- 좋은 예 (셔플됨) -->
<button>diary</button><button>every</button><button>She</button><button>night</button><button>writes</button>
```

```javascript
// 나쁜 예
{ ans:"I am doing my homework", words:["I","am","doing","my","homework"] }

// 좋은 예
{ ans:"I am doing my homework", words:["am","doing","homework","I","my"] }
```

---

## 새 워크시트 추가 시 체크리스트

0. **예문 출처 결정**: 교과서 참고 예문(~50%)과 Claude 자체 창작(~50%)을 섞어 사용. 교과서 참고 시에만 해당 Lesson md 파일 Read → 핵심 구절 Grep 대조 → 매칭 발견 시 재변형 적용. 자체 창작 예문은 대조 검증 불필요.
1. `index.html` 단원 카드 추가 (stats 숫자 업데이트)
2. 정답 비교에 `norm()` 함수 반드시 포함
3. `checkBlank` / `checkArrange` 빈 입력 방지 코드 반드시 포함
4. 모든 해설에 `📝 해석:` 한국어 전체 문장 번역 포함
5. s0 문제 위 한국어 요약 div 삽입 금지
6. 짧은 지문은 ctx 박스 + 빈칸 입력 방식 (TOEIC 형식 금지)
7. 단어는 문항당 vocab 뱃지 또는 ctx 박스로 제공
8. `score-popup.js` 뒤에 `<script src="../sounds.js"></script>` 추가 (효과음)
9. **배열 문제 단어 칩 순서는 정답 순서와 반드시 다르게 배치** (위 규칙 참고)
10. **파일 작업 완료 후 자동으로 `git add → commit → push origin main`** — 사용자가 따로 요청하지 않아도 항상 실행. 워크트리 브랜치에서 작업 중이라도 `git push origin HEAD:main`으로 main에 바로 머지·배포까지 완료한다.
11. **문제 예문 출처 & 유형 규칙은 `worksheet-sentence-guide.md` 참고** (필수)
12. **블로그 배포 자료 — `blog-deploy/<unitNN-topic>.md` 파일로 저장** (신규 워크시트에만 해당)
    - **새 워크시트 파일이 처음 만들어졌을 때만** 작성. 기존 파일 수정·리팩터링은 **작성하지 않는다** (사용자 피드백 2026-04-21).
    - 파일 하나에 아래 항목을 **순서대로 모두** 작성한다 (상세 형식 → 아래 "블로그 배포 파일 형식" 섹션 참고):
      1. **제목** — `[중1 영문법]` / `[중1 영문법 심화]` / `[중2 영문법]` / `[중2 영문법 심화]` + 문법명 + 라이브워크시트 + (N문제)
      2. **태그** — 중1영어/중2영어·중1영문법/중2영문법 계열 공통 + 문법 키워드 + 심화 여부
      3. **iframe 주소** — `https://namkicheol.github.io/middle-grammar/<폴더>/`
      4. **썸네일 명령어** — 제미나이용, 16:9 1280x720, 기초=하늘·민트·노랑 / 심화=다크 네이비+골드
      5. **agent 점검 결과** — answer-checker 실행 후 수정 내용 기록. 문제 수 변경 시 제목·썸네일 배지 문구도 업데이트.
      6. **블로그 본문** — "블로그 글 작성 규칙" 섹션에 따라 티스토리 기초영문법용 마크다운 전문 작성

---

## 블로그 글 작성 규칙 (기초영문법 카테고리)

> 티스토리 **기초영문법** 카테고리 전용. 상세 원본은 `blog write.md` 참고.

### 기본 방침

- **형식**: 마크다운 (티스토리 마크다운 에디터, `<span>` 인라인 색상 허용)
- **톤**: 친근함 (중학생 대상, `~이야`, `~거든` 가능)
- **색깔**: 파랑·주황·빨강 3색 중심 (보라 거의 안 씀)

### 색깔 시스템

| 용도 | 색상 코드 | 사용 예 |
|---|---|---|
| 핵심 개념·정의 | `#3182ce` (파랑) | `<span style="color:#3182ce;">**개념어**</span>` |
| 주의·경고·함정·비문 | `#c53030` (빨강) | `<span style="color:#c53030;">**주의**</span>` |
| 현직쌤 팁 박스 | `#dd6b20` (주황) | `> 💡 <span style="color:#dd6b20;">**현직쌤 팁**</span>:` |
| 장점·긍정 | `#319795` (청록) | `<span style="color:#319795;">장점</span>` |

**span 권장 개수**: 5,000~8,000자 → 6~10개 / 8,000~12,000자 → 10~15개

**금기**:
- 한 문단에 4가지 색 이상 ❌
- 전체 문장 색 감싸기 ❌ (키워드 1~3단어만)
- 헤더(`##`, `###`)에 색 ❌
- 중복 강조 ❌ (볼드+색 단어에 밑줄·이탤릭 추가)

### SVG 도해

- **만들어야 할 때**: 위계 구조, 과정·흐름, 비교·대조 — 제안 없이 바로 제작
- **불필요할 때**: 단순 나열 → 표, 짧은 대비(2~3항목) → 2열 표

```html
<p align="center">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 280" width="700" style="max-width:100%;height:auto;">
  <rect x="0" y="0" width="700" height="280" fill="#fafafa" stroke="#e2e8f0"/>
  <text x="350" y="28" text-anchor="middle" font-size="15" font-weight="bold" fill="#2d3748">제목</text>
</svg>
</p>
```

SVG 색상: 파랑 `#ebf8ff`/`#3182ce` · 주황 `#fef5e7`/`#dd6b20` · 빨강 `#fff5f5`/`#c53030`
글씨: 제목 15~16px, 본문 10~12px

### 이미지 삽입

- **출처**: Pexels만 사용 / **크기**: `w=600`, 3~5장
- **허구 URL 생성 절대 금지** — 실제 존재하는 ID만 사용

```html
<p align="center">
<img src="https://images.pexels.com/photos/XXXX/pexels-photo-XXXX.jpeg?w=600" alt="설명" width="600"/>
</p>
```

### 글 작성 공통 규칙

- **~ 물결표**: 앞뒤 공백 필수 → `A ~ B` (티스토리 취소선 오류 방지)
- 색깔·SVG는 디폴트 적용, "빼줘" 요청 시에만 제외

---

## 블로그 배포 파일 형식 (blog-deploy 템플릿)

`blog-deploy/<unitNN-topic>.md` 파일 하나에 아래 순서로 모두 작성한다.

```
# [중1/중2 영문법] 문법명 라이브워크시트 (N문제)

**태그**: 중1영어/중2영어, 중1영문법/중2영문법, 키워드1, 키워드2, ...

**iframe**: https://namkicheol.github.io/middle-grammar/<폴더>/

**썸네일 명령어**:
16:9 비율 1280x720 유튜브 썸네일. 한국 유튜브 팝/만화풍 스타일.
(기초) 배경 하늘색→민트 그라디언트. 귀여운 중학생 캐릭터. 노란 말풍선에 예문.
상단 흰 배지에 "기초 N문제". 하단에 문법명 굵은 흰색 폰트.
(심화) 배경 다크 네이비(#1e2a4a). 골드 배지 "심화 N문제".
오류 발견 포즈 캐릭터. 하단에 문법명 굵은 골드(#f59e0b) 폰트.

**agent 점검 결과** (YYYY-MM-DD):
(answer-checker 실행 후 수정 내용 기록)

---

## 블로그 본문

(티스토리 기초영문법 카테고리용 마크다운 전문)
(색깔 시스템·SVG·이미지 규칙 모두 적용)
```

**규칙**:
- 기초·심화가 동시에 나왔으면 같은 파일 안에 `---`로 구분해 두 세트 작성
- agent 점검으로 문제 수 바뀌면 제목·썸네일 배지 문구도 함께 수정

---

## 문제 예문 출처 & 유형 규칙 요약

> 상세 내용은 `worksheet-sentence-guide.md` 참고.

### 예문 출처 방침 (2026-04-24)

교과서 참고 예문과 Claude 자체 창작을 **약 50:50**으로 섞는다.

| 출처 | 설명 | 대조 검증 |
|------|------|----------|
| 교과서 참고 변형 | 기본AB·어법드릴·심화·교과서 본문 소재 참고 후 변형 | 필요 (Grep 대조) |
| Claude 자체 창작 | 문법 포인트·수준에 맞게 직접 작성 | 불필요 |

- 교과서 참고 시: 단어 교체·주어 변경·시제 변환 등으로 반드시 변형 (직접 복사 금지)
- **이름·대명사만 교체는 불충분** — 목적어·부사구 포함 최소 2요소 이상 교체 필수 (저작권)
- 교과서 인물 이름(Jaeho, Minjeong, Sam 등)은 그대로 사용 가능
- Claude 자체 창작 예문은 자유롭게 작성 가능 — 교과서 md 파일 Read 불필요

### Lesson별 문법 단원

| Lesson | Point A | Point B |
|--------|---------|---------|
| L1 | be동사 현재형·부정문 | 일반동사 현재형·부정문 |
| L2 | 현재진행형·의문문 | 동명사 (동사 목적어) |
| L3 | be동사·일반동사 과거형 | 시간 접속사 when |
| L4 | to부정사 (동사 목적어) | 조동사 will, should |
| L5 | 재귀대명사 | 목적을 나타내는 to부정사 |
| L6 | 감각동사 look + 형용사 | 이유 접속사 because |
| L7 | make + 목적어 + 형용사 | 명사절 접속사 that |
| L8 | 감탄문 (What / How) | something + 형용사 |

### 기본유형 — 문법 포인트·난이도에 따른 유형 선택

**총 문제 수는 45문제 고정이 아님.** 자연스럽게 낼 수 있는 문제만 낸다. 억지로 유형을 만들어 채우지 않는다.

#### 유형 목록

| 유형 | 설명 | 주요 활용 상황 |
|------|------|---------------|
| `mcq-4` | 4지선다 | 문맥 파악이 핵심 (because절 고르기, 형용사vs부사 등) |
| `input-form` | 힌트 주어진 형태 완성 | 주어-동사 수일치, 동사 형태 변환 |
| `input-comp` | 절 전체 영작 | because·when 절 쓰기 — **기초에서는 2문제 이하** |
| `scramble` | 단어 칩 배열 | 어순 정리, 혼합 복습 |

#### 배분 원칙

- Section A (Point A): 문법 형태 훈련 — `mcq-4` + `input-form` 조합
- Section B (Point B): 자연스럽게 낼 수 있는 유형만. 인과·문맥 추론이 필요하면 `mcq-4`, 절 전체를 써야 이해가 되는 문법이면 `input-comp` 소량
- Section C: `scramble` — 단원 혼합 복습
- **억지 유형(접속사 한 글자 채우기, 2지선다 etc.)은 내지 않는다**

- mcq 소재: 어법드릴 문장을 단어 교체해서 구성
- input 소재: 기본AB의 빈칸 완성 문제 활용
- scramble 소재: 심화의 단어 배열 문제 활용 (단, 정답 순서와 다르게 섞기)

### 심화유형 — 현행 구조 유지 + 문법학습지 변형 유형 일부 추가

기존 scramble 중심 심화 구조는 그대로 유지하되, **전체 심화 문제의 30–40%**는 아래 문법학습지 변형 유형을 섞어 추가한다.

| 변형 유형 | 참고 출처 | 워크시트 타입 |
|-----------|-----------|--------------|
| 오류 수정 (틀린 형태 → 고쳐 쓰기) | 심화 "밑줄 친 부분을 올바른 형태로 고쳐 써 봅시다" | `input` |
| 문장 변환 (긍정→부정, 현재→과거 등) | 심화 "지시대로 바꿔 써 봅시다" | `input` |
| 두 문장 합치기 (접속사 활용) | 심화 "두 문장을 연결하시오" | `scramble` |
| 우리말 → 영작 | 심화 "우리말과 일치하도록 완성하시오" | `input` / `scramble` |

### 심화 문제 작성 원칙 (2026-04-24 추가)

#### 문법 용어 지양

문제 본문(`q-sub`, `q-text`)에 **IO · DO · 수여동사** 등 문법 메타 용어를 쓰지 않는다.
대신 **한국어 해석 + 괄호 단어** 형태로 자연스럽게 안내한다.

```
❌ 나쁜 예: 다음 문장을 「수여동사 + DO + 전치사 + IO」 형태로 바꾸세요.
✅ 좋은 예: 같은 의미가 되도록 빈칸을 채우세요. (to 사용)
           She gave me some useful tips. → She gave some useful tips ___ for the exam.
```

answer-hint의 해설에는 문법 용어 사용 가능 (학생이 힌트를 클릭한 후에 보는 내용이므로).

#### 두 문장 합치기 — 점진적 스캐폴딩 (4단계)

두 문장을 하나로 합치는 문제는 아래 4단계로 점진 난이도를 구성한다.

| 단계 | 제공 범위 | 빈칸 범위 | 예시 |
|------|-----------|-----------|------|
| 1단계 (문장 반) | 주절 + 관계대명사 제공 | 관계절 동사+나머지만 빈칸 | `She composed a melody which _____.` |
| 2단계 (주어+동사) | 주절 + 관계대명사 제공 | 관계절 동사+나머지만 빈칸 (사람/사물 구분 연습) | `I met a scientist who _____.` |
| 3단계 (주어만) | 주절만 제공 | 관계대명사부터 전체 빈칸 | `They launched a drone _____.` |
| 4단계 (다 빈칸) | 두 문장만 q-sub에 제공 | 완성 문장 전체 빈칸 | 전체 작성 |

- 1·2단계는 관계대명사를 노출해 사람/사물 구분에 집중하게 함
- 3단계는 관계대명사를 학생이 선택 → `data-ans2`로 which/that 모두 허용
- 4단계는 전체 문장 작성 → `data-ans2`로 which/that 모두 허용
