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

---

## 디자인 시스템

### 색상 테마

| 파일 | 테마 |
|------|------|
| `index.html`, `be-verb/v2.html`, `gerund-basic/index2.html`, `gerund-hard/index.html` | Baloo 2 · 파란 그라디언트 (`#0ea5e9 → #6366f1`) |
| `general-verb-hard/index.html`, `past-be/index.html`, `past-be-hard/index.html` | Baloo 2 · 다크 네이비 + 앰버 골드 (`#1e2a4a`, `#f59e0b`) |
| `gerund-basic/index.html` | Pretendard · 다크 네이비 + 앰버 골드 (`#0f172a`, `#fbbf24`) |

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

## 새 워크시트 추가 시 체크리스트

1. `index.html` 단원 카드 추가 (stats 숫자 업데이트)
2. 정답 비교에 `norm()` 함수 반드시 포함
3. `checkBlank` / `checkArrange` 빈 입력 방지 코드 반드시 포함
4. 모든 해설에 `📝 해석:` 한국어 전체 문장 번역 포함
5. s0 문제 위 한국어 요약 div 삽입 금지
6. 짧은 지문은 ctx 박스 + 빈칸 입력 방식 (TOEIC 형식 금지)
7. 단어는 문항당 vocab 뱃지 또는 ctx 박스로 제공
8. **파일 작업 완료 후 자동으로 `git add → commit → push origin main`** — 사용자가 따로 요청하지 않아도 항상 실행
