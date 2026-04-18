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
| `general-verb-hard/index.html` | Baloo 2 · 다크 네이비 + 앰버 골드 (`#1e2a4a`, `#f59e0b`) |
| `gerund-basic/index.html` | Pretendard · 다크 네이비 + 앰버 골드 (`#0f172a`, `#fbbf24`) |

### 단어 뱃지 (vocab)

- `general-verb-hard`: `.vocab` div — 기본 숨김, "📖 단어 보기 ▾" 버튼 클릭 시 토글
- `be-verb/v2.html`: JS 자동 주입 (`vocabData` 객체)
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

## 새 워크시트 추가 시 체크리스트

1. `index.html` 단원 카드 추가 (stats 숫자 업데이트)
2. 정답 비교에 `norm()` 함수 반드시 포함
3. `sec2`(구분하기) 타입 문제는 `kor` 필드 추가
4. 단어는 문항당 vocab 뱃지 또는 ctx 박스로 제공
