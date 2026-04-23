# answer-checker 에이전트 — 한국어 가이드

## 개요

`answer-checker`는 middle-grammar 프로젝트 전용 QA 자동화 에이전트다.  
워크시트 HTML 파일을 새로 만들거나 수정했을 때 **정답 처리 규칙이 올바르게 구현됐는지** 자동으로 점검한다.

---

## 언제 자동 실행되나

Claude Code가 아래 상황을 감지하면 answer-checker를 자동으로 호출한다.

| 상황 | 예시 |
|------|------|
| 새 워크시트 HTML 파일 생성 | `to-will-basic/index.html 파일 만들었어` |
| 기존 워크시트 수정 후 점검 요청 | `gerund-hard/index.html 수정했는데 정답 점검해줘` |
| scramble 문제 추가 | `scramble 문제 5개 추가했어` |

---

## 점검 항목 8가지

### 1. `norm()` 함수 존재 & 정확성
- 파일 안에 `norm()` 함수가 있는지 확인
- 아래 10개 축약형 변환이 모두 포함됐는지 확인

```
isn't → is not      aren't → are not
wasn't → was not    weren't → were not
don't → do not      doesn't → does not
didn't → did not    won't → will not
can't → cannot      shouldn't → should not
```

- 정답 비교가 `norm(입력값) === norm(정답)` 형태인지 확인 (raw 문자열 비교 금지)

---

### 2. 빈 입력 방지
- **`checkBlank`**: `inp.value.trim()`이 비어있으면 `toast('답을 입력하세요!','ng')` 후 즉시 반환 — 정답 노출 전
- **`checkArrange`**: `placed[k].length === 0`이면 즉시 반환 — 정답 노출 전
- 빈 상태로 제출해도 정답이 절대 보이지 않는지 확인

---

### 3. 정답 값 (`ans`, `ans2`) 검증
- 모든 `data-ans` 속성과 JS 데이터의 `ans` 필드 철자·문법·구두점 점검
- 축약형/전체형 혼용 여부 플래그 (런타임은 norm이 처리하지만 데이터 자체는 일관성 유지)
- `ans2`는 **완전히 다른 표현 두 가지가 모두 정답**일 때만 허용 (축약형↔전체형 차이는 norm으로 처리하므로 ans2 불필요)

---

### 4. 객관식(`mcq`) 선택지 일치
- 버튼 텍스트와 `data-ans` 값이 공백·대소문자·구두점까지 완전히 일치하는지 확인
- 숨겨진 공백이나 특수문자 없는지 확인

---

### 5. 배열(scramble) 문제 단어 순서 셔플
- 모든 scramble 문제에서 `words` 배열(JS) 또는 `word-pool` 버튼 순서가 **정답 순서와 다른지** 확인
- 정답 순서 그대로인 문제는 즉시 플래그

---

### 6. 해설(`answer-hint`) 한국어 번역
- 모든 문제에 `.answer-hint` 요소가 있는지 확인
- `📝 해석:` + 완전한 한국어 문장 번역 포함 여부 확인
- `💡 정답:` + 정답이 **굵게** 표시됐는지 확인
- 요약 아님 — 영어 문장 전체를 번역한 완전한 문장이어야 함
- Mr./Mrs. 등 호칭은 한국어로 번역 금지 ("김씨" 등 불가)

---

### 7. 이미 답한 문제 재채점 방지
- `checkBlank` / `checkArrange` 모두 `card.classList.contains('ok') || card.classList.contains('ng')`를 먼저 확인하고 이미 답한 문제면 즉시 반환하는지 확인

---

### 8. `sounds.js` 연동
- `<script src="../sounds.js"></script>`가 `score-popup.js` 뒤에 있는지 확인
- `toast()` 호출이 `type: 'ok'` 또는 `type: 'ng'` 형태인지 확인

---

## 결과 출력 형식

```
## 정답 점검 결과 — [파일명]

### ✅ 통과 항목
- [통과한 항목 나열]

### ❌ 오류 / 경고
| 항목 | 위치 | 문제 내용 | 수정 제안 |
|------|------|-----------|----------|
| norm() | checkBlank() | norm() 비교 누락 | norm(inp.value) === norm(ans) 로 수정 |

### 📋 요약
총 N개 항목 점검 — 통과 X / 오류 Y / 경고 Z
```

문제가 없으면: **"모든 정답 처리 규칙이 올바르게 구현되어 있습니다."**

---

## 에이전트 행동 원칙

- 대상 파일을 먼저 꼼꼼히 읽은 뒤 보고
- 이슈 위치는 줄 번호 또는 함수명으로 정확하게 명시
- 레이아웃·색상·폰트 등 정답 무관 스타일 변경은 제안하지 않음
- 파일 전체 재작성 금지 — 문제가 있는 부분만 최소 수정 제안
- 여러 파일이면 각 파일을 개별 보고
- **빈 입력 버그(정답 노출)는 최우선 심각 오류로 처리**

---

## 에이전트 메모리 위치

`.claude/agent-memory/answer-checker/`  
대화를 거듭하며 아래 정보를 누적 기록한다.

- 파일별 `egmToast` vs `toast` 사용 여부 (sounds.js 연동에 영향)
- 정적 HTML 방식 vs JS 데이터 방식 구분
- 특정 문법 주제에서 자주 나오는 `ans` 오타
- `norm()` 누락 또는 잘못된 사용 파일 목록
