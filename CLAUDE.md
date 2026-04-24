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

### ans2 (보조 정답)

완전히 다른 표현이 두 가지 모두 정답일 때만 사용. 축약형/전체형 차이는 norm으로 처리하므로 `ans2` 불필요.

---

## Ne교과서 md 파일 (참고 자료)

### 저작권 주의

> NE능률 2022 개정 중1 교과서 및 부속 교재(문법연습문제, 어법드릴)의 저작권은 NE능률에 귀속된다.
> **문장을 그대로 사용하는 것은 금지.** 예문의 구조·어휘·맥락을 참고하되, 인명·소재·수치 등을 바꾸어 반드시 변형해서 사용한다. → 변형 상세 기준은 아래 "문장 변형 규칙 (필수)" 참조.

### 파일 위치

```
Ne교과서 md파일/
  2022me_중1_L{1~8}_교과서.md          ← 교과서 본문 대화·지문
  2022me_중1_L{1~8}_문법연습문제_기본AB.md  ← 기본 문법 연습 문제
  2022me_중1_L{1~8}_문법연습문제_심화.md    ← 심화 문법 연습 문제
  2022me_중1_L{1~8}_어법드릴문제.md         ← 어법 드릴 (단순 반복 연습)
```

### 각 파일의 역할

| 파일 | 내용 | 워크시트 활용 |
|------|------|--------------|
| `_교과서.md` | 본문 대화·지문 (인물명·상황 포함) | 예문 소재·맥락 참고 후 변형 |
| `_문법연습문제_기본AB.md` | 선택·빈칸 채우기·단문 완성 | 기본 유형 문제 형식 참고 |
| `_문법연습문제_심화.md` | 오류 수정·문장 전환·단어 배열·두 문장 합치기 | 심화 유형 문제 형식 참고 |
| `_어법드릴문제.md` | 문법 포인트별 반복 훈련 (10문항) | 심화 유형 문제 형식 참고 |

### 단원별 문법 포인트

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

### 🚨 예문 생성 전 **원본 대조 검증 의무** (2026-04-23 추가 · 엄격)

새 워크시트 문장을 만든 **직후, 커밋 전**에 반드시 해당 단원의 md 파일 4종과 대조하여 변형 기준 미달을 잡아낸다.

**검증 절차 (필수):**

1. 해당 Lesson의 md 파일 4종을 Read로 먼저 전부 읽기
   - `Ne교과서 md파일/2022me_중1_L{N}_교과서.md`
   - `Ne교과서 md파일/2022me_중1_L{N}_문법연습문제_기본AB.md`
   - `Ne교과서 md파일/2022me_중1_L{N}_문법연습문제_심화.md`
   - `Ne교과서 md파일/2022me_중1_L{N}_어법드릴문제.md`

2. 내가 만든 각 문장의 **핵심 구절(동사+목적어, 주요 명사, 장소)** 을 Grep으로 md 파일에서 검색

3. 매칭되는 경우 → 주어·목적어·부사구를 **최소 2개 더** 바꿔서 재작성

4. 특히 **어법드릴의 B섹션 목적 to부정사 정답 문장**(예: "Mandy went to a park to jog", "She called the restaurant to reserve a table")은 **완성 문장 그대로 복제 금지**. 주어·장소·동사·목적어를 다 바꿔야 한다.

**왜 이 규칙이 필요한가 (2026-04-23 사고 기록):**
L5 reflexive-to 기초·심화 제작 시 7개 문장이 원본과 구조·어휘가 일치(일부는 완전 동일)해 저작권 위험·변형 기준 미달 상태로 커밋됨. 사용자가 직접 확인해서 발견했고, 일괄 재변형 필요. → 앞으로 **모든 워크시트 제작 시 "원본 → grep → 변형" 루프 필수**.

```
# 검증 예시 (L5 제작 시)
Read Ne교과서 md파일/2022me_중1_L5_어법드릴문제.md
Grep "to reserve|Mandy|went to a park|to jog|hurt herself" reflexive-to-*/index.html
  → 매칭되면 재변형
```

### 기본 유형 제작 (기존 방식 유지)

현재 방식 그대로 유지. 교과서 예문은 소재·맥락 참고용으로만 사용하고, 문장은 변형한다.

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
| `sounds.js` | 효과음 (Web Audio API, 외부 파일 없음) |
| `Ne교과서 md파일/` | Ne능률 중1 교과서 원본 md (L1–L8, 교과서·기본AB·심화·어법드릴) |
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

0. **🚨 예문 생성 전 해당 Lesson의 md 4종 파일 Read → 문장 작성 후 핵심 구절 Grep 대조 → 매칭 발견 시 재변형** (위 "예문 생성 전 원본 대조 검증 의무" 참고, 스킵 절대 금지)
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
12. **블로그 배포 자료 자동 제시 (신규 워크시트에만 해당)** — **새 워크시트 파일이 처음 만들어졌을 때만** 아래 4종 세트를 묻지 않고 제공. 기존 파일을 수정·리팩터링·디자인 변경하는 경우는 이미 블로그 포스트가 존재하므로 **제시하지 않는다** (사용자 피드백 2026-04-21).
    - ① 블로그 제목 (`[중1 영문법] 또는 [중1 영문법 심화] + 문법명 + 라이브워크시트 + (N문제)` 형식)
    - ② 태그 (중1영어, 중1영문법 계열 공통 + 문법 키워드 + 심화 여부)
    - ③ iframe 주소 (`https://namkicheol.github.io/middle-grammar/<폴더>/`)
    - ④ 제미나이 썸네일 명령어 (16:9 1280x720, 한국 유튜브 팝/만화풍, 기초=하늘·민트·노랑, 심화=다크 네이비+골드. 주제·말풍선·캐릭터·배지 문구까지 구체적으로)

---

## 문제 예문 출처 & 유형 규칙 요약

> 상세 내용은 `worksheet-sentence-guide.md` 참고.

### 예문 우선순위

```
1순위  Ne교과서 문법연습문제_기본AB / 어법드릴문제 예문 변형
2순위  Ne교과서 문법연습문제_심화 예문 변형
3순위  Ne교과서 교과서 본문(대화·지문) 예문 변형
```

- 예문은 단어 교체·주어 변경·시제 변환 등으로 반드시 변형해서 사용 (직접 복사 금지)
- **이름·대명사만 교체는 불충분** — 목적어·부사구 포함 최소 2요소 이상 교체 필수 (저작권)
- 교과서 인물 이름(Jaeho, Minjeong, Sam 등)은 그대로 사용 가능

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

기본 워크시트는 문법 포인트와 난이도에 맞게 아래 유형을 조합한다.
총 45문제 기준: Section A(Point A) 20문제 + Section B(Point B) 15문제 + Section C(단어배열) 10문제.

#### 유형 목록 및 난이도

| 유형 | 설명 | 난이도 | 주요 활용 상황 |
|------|------|--------|---------------|
| `mcq-4` | 4지선다 — 인과관계·문맥 이해 필요 | ★★★ | 문맥 파악이 핵심인 문법 (because절 고르기 등) |
| `mcq-2` | 2지선다 — 접속사 두 개 중 선택 | ★★ | 비슷한 두 표현 구별 (because vs but, because vs so) |
| `input-fill` | 빈칸에 단어 1개 채우기 (접속사·조동사·형태) | ★ | 형태 훈련, 대소문자 판단 (because/Because) |
| `input-form` | 주어진 힌트(동사원형 등)로 올바른 형태 완성 | ★★ | 주어-동사 수일치, 시제 변환 |
| `input-comp` | 두 문장을 접속사로 연결하는 절 전체 쓰기 | ★★★ | because·when·that 절 영작 |
| `scramble` | 단어 칩 배열 | ★★ | 어순 정리, 혼합 복습 |

#### 섹션별 유형 배분 원칙

- **Point A (형태·형식 중심)**: `mcq-4` × 10 + `input-form` × 10 (주어-동사 수일치, 형용사/부사 선택 등 형태 훈련)
- **Point B (접속사·문맥 중심)**: 아래 원칙으로 15문제 구성
  - 인과·시간 등 문맥 독해가 필요한 문법 → `mcq-4` 비중 높게 (최대 10문제)
  - because·when 등 접속사 자체 식별이 목적 → `input-fill`(because 채우기) + `mcq-2`(2지선다) 조합
  - 절 영작이 중학 수준에서 너무 어렵다고 판단 → `input-comp` 2문제 이하로 제한
- **Section C (단어배열)**: 10문제 (look·because 등 단원 혼합)

#### 난이도 판단 기준

- 영작(`input-comp`) 전체 문장 만들기는 기초에서 2문제 이하로 제한
- 접속사 자체를 쓰는 `input-fill`은 쉬운 유형 — 대소문자 판단만 요구해도 충분
- `mcq-4`는 인과관계·문맥 추론이 필요해 상대적으로 어렵다 — 기초에서는 5문제 이하 권장
- 문법 난이도가 낮은 단원일수록 `scramble` 비중을 높여 반복 연습 강화

```
예시 (L6 look·because 기초):
  Section A: mcq-4 × 10 (형용사vs부사) + input-form × 10 (look/looks 수일치) = 20
  Section B: mcq-4 × 5 (인과관계 절 선택) + input-comp × 2 (영작) + input-fill × 4 + mcq-2 × 4 = 15
  Section C: scramble × 10 = 10
```

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
