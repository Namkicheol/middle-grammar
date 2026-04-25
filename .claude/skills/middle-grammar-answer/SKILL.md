---
name: middle-grammar-answer
description: middle-grammar 워크시트 정답 처리 규칙. 주관식 입력 norm 함수(축약형↔전체형), 빈 입력 방지(checkBlank/checkArrange), 한국어 해석 표시(q-kor), 해설(answer-hint) 작성, 섹션 구성, 배열 단어 순서 규칙. 문제 만들 때 반드시 호출.
---

# 정답 처리 규칙

## 텍스트 입력 정답 비교

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

## 빈 입력 방지 (필수)

```javascript
// checkBlank
function checkBlank(k) {
  var inp = document.getElementById('bi-'+k);
  var card = document.getElementById('qc-'+k);
  if (card.classList.contains('ok') || card.classList.contains('ng')) return;
  if (!inp.value.trim()) { toast('답을 입력하세요!','ng'); inp.focus(); return; }
}

// checkArrange
function checkArrange(btn) {
  var k = btn.dataset.qid;
  var card = document.getElementById('qc-'+k);
  if (card.classList.contains('ok') || card.classList.contains('ng')) return;
  if (!placed[k].length) { toast('단어를 배열하세요!','ng'); return; }
}
```

## 객관식 버튼

버튼 텍스트가 정답과 동일하게 렌더링되므로 별도 norm 불필요. 단, 버튼과 `data-ans` 값은 완전히 일치시켜야 함.

## -ly 형용사 문제

look+형용사 단원 등에서 **lovely · friendly · lively · lonely · kindly** 등 -ly로 끝나지만 형용사인 단어를 정답으로 섞어 출제. "-ly = 부사"라는 선입견 교정.

## ans2 (보조 정답)

완전히 다른 표현이 두 가지 모두 정답일 때만 사용. 축약형/전체형 차이는 norm으로 처리하므로 `ans2` 불필요.

---

# 한국어 해석 표시 규칙 (q-kor)

## 핵심 판단 기준

**"이 문제, 해석 없이 풀 수 있나?"**
- NO → `.q-kor` 또는 `q-sub` 해석 추가
- YES → 생략 가능

해석이 필요한 대표 상황:
- 어휘가 생소하거나 문장이 길어 의미 파악이 어려울 때
- because·when·that 등 접속사 의미 선택, 맥락 추론이 답을 결정할 때
- 빈칸 채우기(input)에서 문장 전체 의미를 모르면 답을 쓸 수 없을 때

## 기초 워크시트

영문 q-text 바로 아래에 `.q-kor` div로 한국어 전체 해석 표시.

```html
<!-- MCQ 예시 -->
<div class='q-text'>They <em>___</em> lived here for ten years.</div>
<div class='q-kor'>그들은 10년 동안 여기서 살아 왔다.</div>

<!-- input 예시 -->
<div class='q-text'>She <input ...> six countries so far.</div>
<div class='q-kor'>그녀는 지금까지 여섯 나라를 방문했다.</div>
```

적용 기준:
- ✅ 특정 영문 문장이 있는 MCQ: 해당 문장 해석 표시
- ✅ 빈칸 input 문제: 완성된 문장의 전체 해석 표시
- ❌ scramble(단어 배열): q-text 자체가 `📌 [한국어]` 형태이므로 q-kor 불필요

**CSS (기초 워크시트 공통):**
```css
.q-kor{font-size:.82rem;color:#1e6fa0;font-weight:600;margin-bottom:10px;padding:4px 10px;background:#e0f2fe;border-radius:6px;}
```

## 심화 워크시트

기본적으로 s0 문제에 ctx/q-kor 사용을 금지하지만, 의미 이해가 선행돼야 풀 수 있는 문제는 예외.

```html
<div class='q-text'>She gave her mentor some <em>___</em> advice. (valuable / valuably)</div>
<div class='q-kor'>그녀는 멘토에게 귀중한 조언을 해 주었다.</div>
```

심화 워크시트 CSS:
```css
.q-kor{font-size:.80rem;color:#7fa8c9;font-weight:600;margin-bottom:10px;padding:4px 10px;background:rgba(30,106,160,.15);border-radius:6px;}
```

---

# 해설(answer-hint) 작성 규칙

모든 문제의 해설에는 반드시 **한국어 전체 문장 해석**을 포함한다.

```html
<div class="answer-hint" id="ah-a1">
  💡 정답: <strong>was</strong> — The box(단수) → was<br>
  📝 해석: 선반 위의 상자는 비어 있었다.
</div>

<!-- JS render 방식 -->
html += `<div class='answer-hint' id='ah-${id}'>💡 <strong>정답: ${q.ans}</strong><br>📝 해석: ${q.kor}<br><br>👉 해설: ${q.hint}${vHtml}</div>`;
```

- 요약 아님 — 영어 문장 전체를 번역한 완전한 문장
- Mr.Kim / Mrs. 등 호칭은 절대 한국어로 번역하지 않음 (예: "김씨" 금지)
- scramble 문제 — `q-text` 자체가 `📌 [한국어]` 형태면 `📝 해석:` 생략 가능 (중복)

---

# 섹션 구성 규칙

## ctx div

- s0(단문 문제): 문제 위 한국어 요약·맥락 div **금지** — 해설에만 해석 제공
- s1(짧은 지문): `<div class="ctx">📖 지문 A — ...</div>` 형태로 제공 가능
- s1(단어 배열): ctx는 배열 목표 문장의 한국어 버전으로 사용

## 짧은 지문 (s1) 형식

- **TOEIC Part 6 형식 금지** (선택지 (A)~(D) + 지문 라벨 형식)
- 대신: 지문은 `ctx` 박스로 위에 표시하고, 문제는 **빈칸 직접 입력** 방식

## 10번 이후 be동사 힌트

```html
<span class="ex">(be)</span>
<span class="ex">(be, 부정형)</span>
```

---

# 배열(scramble) 문제 단어 순서 규칙

단어 칩은 반드시 정답 문장 순서와 **달라야** 한다.

```html
<!-- 나쁜 예 -->
<button>She</button><button>writes</button><button>in</button><button>her</button><button>diary</button>

<!-- 좋은 예 -->
<button>diary</button><button>every</button><button>She</button><button>night</button><button>writes</button>
```

```javascript
// 나쁜 예
{ ans:"I am doing my homework", words:["I","am","doing","my","homework"] }

// 좋은 예
{ ans:"I am doing my homework", words:["am","doing","homework","I","my"] }
```
