# PLAN — 리딩 직소 학습지 생성 웹앱

브랜치: `worktree-reading-jigsaw-app`
참고 자료: `refs/학습지 참고자료/` (동아윤 / English 2 / 미래엔최 3종)
방향: 본문 텍스트 / PDF / HWP 업로드 → 직소 형태 리딩 학습지 HTML 자동 생성.
배포: `index.html` 메인 허브에 게임 카드처럼 신규 카드 1장 추가, 별도 디렉토리.

---

## 0. 디자인 톤 (UI 우선)

게임 카드와 동급의 비주얼 — "쓰던 학습지 만들기 도구"가 아니라 "툴 자체가 작품"으로 보이게.

| 요소 | 방향 |
|------|------|
| 메인 컬러 | 워크시트 다크 네이비 + 앰버 계열 (`gerund-hard` 등 심화 톤)과 게임 다크 아케이드 중간. **종이 질감 + 네온 포인트**. |
| 타이포 | 한글 `Pretendard` / 영문 `Inter` + 강조 `Baloo 2`. 본문 영역은 `Noto Serif KR`로 "학습지 종이" 느낌. |
| 레이아웃 | 좌측 사이드바(설정 / 단계 진행 표시) + 우측 캔버스(편집/미리보기 토글). 모바일은 단일 컬럼. |
| 인터랙션 | 본문 클릭 → 빈칸 토글, 드래그로 조각 경계 이동, 단계별 펜슬 인디케이터 점등. |
| 출력물 | 인쇄 영역만 종이 톤 화이트로 자동 전환 (`@media print`). 화면용 / 인쇄용 두 톤. |

UI 검증: 각 화면 mock → chrome-devtools로 실측 → "구리면 다시" 원칙.

---

## 1. 사용자 흐름 (Happy Path)

```
[1] 자료 업로드
    │  · 텍스트 직접 붙여넣기
    │  · .txt / .md 파일 드롭
    │  · .pdf / .hwp / .hwpx 드롭 (kordoc 변환은 서버 없어 우선 텍스트만, HWP/PDF는 v2)
    ▼
[2] 본문 정제
    │  · 자동 문장 분할
    │  · 단원 소제목 자동 감지 (대문자 헤더 패턴)
    │  · 사용자가 줄/문장 병합 수정 가능
    ▼
[3] 조각 분할
    │  · 자동: 3~5조각, 균등 + 소제목 우선
    │  · 수동: 문장 사이 클릭으로 경계 추가/이동
    │  · 각 조각 난이도 별점(★☆☆ ~ ★★★) 자동 추정 + 수동 조정
    ▼
[4] 빈칸·문법 표시
    │  · 영문에서 단어 클릭 → 빈칸 토글
    │  · 한글 해석 추가 (사용자 입력 또는 GPT 번역 — v1은 사용자 입력 또는 빈칸)
    │  · 문법 포인트 문장 선택 → Step 4 카드에 자동 등록
    │  · 어휘 자동 추출 (대문자/고유명사 제외, 빈도 낮은 단어 우선)
    ▼
[5] 학생용·교사용 동시 미리보기
    │  · 토글로 빈칸 채워진 버전 ↔ 빈칸 버전 전환
    │  · 인쇄 미리보기 / PDF 다운로드 / HTML 저장
    ▼
[6] 저장
    · 로컬: localStorage에 프로젝트 저장 (이름·날짜)
    · 내보내기: `.html` 단일 파일 / `.md` / 클립보드 복사
```

---

## 2. 정보 구조 (Data Model)

```js
{
  meta: {
    title: "Be a Smart Shopper!",
    lesson: "L4",
    textbook: "동아(윤) 중2",
    createdAt: "2026-05-20T20:30",
  },
  source: "원문 통째 텍스트…",
  sentences: [
    { id: 0, en: "Be a Smart Shopper!", ko: "똑똑한 쇼핑객이 되세요", section: 0 },
    { id: 1, en: "Do you think you are a smart shopper?", ko: "...", section: 0 },
    ...
  ],
  sections: [
    { id: 0, label: "A", stars: 1, range: [0, 4], heading: null },
    { id: 1, label: "B", stars: 2, range: [5, 11], heading: "Hunger Marketing" },
    ...
  ],
  blanks: [
    { sid: 1, type: "en", span: [12, 15], answer: "are" },
    { sid: 1, type: "ko", span: [4, 7], answer: "여러분이" },
  ],
  vocab: [
    { sid: 1, word: "shopper", meaning: "쇼핑객" },
    ...
  ],
  grammarPoints: [
    { sid: 4, note: "주격 관계대명사 which / that", explanation: "..." },
  ],
  styleMode: "english2" | "donga" | "miraen", // 출력 베이스
  hangulHint: "off" | "consonant" // 자음 힌트 (`ㅈㄹ` for `전략`)
}
```

---

## 3. 자동화 알고리즘 (브라우저, 서버 없음)

| 작업 | 방법 |
|------|------|
| 문장 분할 | `.?!` + 따옴표·약어 예외처리 (정규식 + 휴리스틱). 사용자 수정 가능. |
| 소제목 탐지 | 짧고 마침표 없고 다음 줄과 격차 큰 줄 → 후보. 사용자 confirm. |
| 조각 분할 | 자동: `ceil(N/조각수)` + 소제목 경계 스냅. |
| 어휘 추출 | 영어 표제어화(간단 stemmer) → 빈도 1~2 + 일반 영단어 사전(`refs/NE-md변환/` 단어 풀과 차집합). |
| 빈칸 후보 | 본문 핵심구(고빈도 콜로케이션) + 사용자 클릭. |
| 문법 포인트 | 패턴 매칭(관계대명사 `who/which/that+동사`, 수동태 `be+p.p.`, to부정사 등) → 문장 하이라이트. |
| 자음 힌트 | 한글 `초성 추출 함수`로 자동 생성. |
| 별점 난이도 | 조각 평균 문장 길이 + 문법 포인트 개수 → 1~3성. |

LLM 호출 없음(v1). v2에 사용자 API 키 옵션.

---

## 4. 출력 양식

### 4.1 학생용 HTML (조각당 1페이지, 인쇄 호환)

```html
<section class="jigsaw-piece" data-stars="2">
  <header class="piece-head">
    <div class="piece-label">B</div>
    <div class="piece-title">L4. Are You Money Smart? · 본문 직소</div>
    <div class="piece-stars">★★☆</div>
  </header>

  <aside class="piece-sidebar">
    <ul class="checklist">…</ul>
    <ol class="vocab">…</ol>
  </aside>

  <ol class="slow-reading">
    <li>
      <p class="en">Yuna: That's <span class="blank"></span> on social media now.</p>
      <p class="ko">유나: 저건 지금 소셜 미디어에서 <span class="blank"></span> 드레스야.</p>
      <p class="grammar-note">…</p>
    </li>
    …
  </ol>

  <section class="comprehension">…</section>
  <section class="grammar-point">…</section>
</section>
```

### 4.2 교사용

같은 마크업, `data-mode="teacher"` 토글로 빈칸 위치에 정답 노출 + 보충 해설.

### 4.3 인쇄

`@media print`로 사이드바 폭 축소·페이지 강제 분리·헤더/푸터 추가.

---

## 5. 파일 구조

```
reading-jigsaw/
├─ index.html             # 앱 진입 (워크플로 6단계)
├─ app.js                 # 메인 컨트롤러
├─ engine/
│   ├─ parser.js          # 문장 분할 / 소제목 탐지
│   ├─ split.js           # 조각 분할
│   ├─ vocab.js           # 어휘 추출
│   ├─ grammar.js         # 문법 포인트 탐지
│   ├─ blanks.js          # 빈칸 처리
│   └─ hangul.js          # 자음 힌트
├─ ui/
│   ├─ sidebar.js         # 좌측 단계 UI
│   ├─ editor.js          # 본문 편집기
│   ├─ preview.js         # 학생/교사 토글 미리보기
│   └─ exporter.js        # HTML/PDF/MD 출력
├─ styles/
│   ├─ tokens.css         # 컬러·폰트·spacing
│   ├─ app.css            # 앱 UI
│   ├─ worksheet.css      # 학습지 본체 (인쇄 호환)
│   └─ print.css
└─ assets/
    ├─ fonts/             # Pretendard, Baloo 2, Noto Serif KR (CDN 우선 → 로컬 v2)
    └─ samples/           # 동아윤 L4 등 샘플 본문 데이터
```

`index.html` 허브: 게임 카드 영역 아래 **새 섹션 "리딩 도구"** 또는 **메인 카드 한 장** 추가. (사용자 결정 필요)

---

## 6. 메인 index.html 통합

| 옵션 | 설명 |
|------|------|
| A | 게임 카드 옆에 동일 디자인 톤으로 한 장. "리딩 직소 만들기". |
| B | 새 섹션 헤더 `리딩 도구` 추가 + 카드. 추후 도구 확장 대비. |

추천: **B (확장성)**. 첫 카드만 들어가도 헤더는 의미 있음.

카드 디자인은 게임 카드와 차별화 — 게임은 다크 아케이드, 도구는 종이 + 네온 강조. 같은 그리드, 다른 톤.

---

## 7. 단계 (실제 작업 순서)

| 단계 | 산출물 | 검증 |
|------|--------|------|
| 1. 디자인 토큰 + UI 목업 | `styles/tokens.css`, 정적 mock HTML | chrome-devtools 스크린샷 검수 |
| 2. 파서 (문장 분할 + 소제목) | `engine/parser.js` + 단위 테스트 (3개 샘플) | 동아윤 L4 본문 → 14문장 분할 일치 |
| 3. 조각 분할 + 별점 | `engine/split.js` | 자동 분할 후 사용자 1~2회 수동 보정으로 완성 가능 |
| 4. 어휘 / 문법 / 빈칸 추출 | `engine/{vocab,grammar,blanks}.js` | 동아윤 L4 결과가 참고 자료와 70% 이상 일치 |
| 5. 미리보기 + 학생/교사 토글 | `ui/preview.js` | 스타일 3종(English2 / 동아 / 미래엔) 토글 가능 |
| 6. 출력 (HTML/PDF/MD) | `ui/exporter.js` | 인쇄 미리보기 깨짐 없음 |
| 7. localStorage 저장/불러오기 | `app.js` | 새로고침해도 프로젝트 유지 |
| 8. index.html 카드 추가 | `index.html` 패치 | 메인 허브에서 진입 가능 |
| 9. 샘플 자료 1건 풀 시연 | 동아윤 L4 데모 | 사용자 검수 통과 |
| 10. 머지 & 푸시 | `worktree-reading-jigsaw-app` → `main` | 자동 검증 게이트 통과 |

---

## 8. v1 범위 / v2 이후

| v1 (이번 브랜치) | v2 (추후) |
|------------------|-----------|
| 텍스트 / `.txt` / `.md` 입력 | `.pdf` / `.hwp` / `.hwpx` 입력 (kordoc 서버 또는 WASM 변환) |
| 한글 해석 사용자 직접 입력 또는 빈칸만 | LLM 자동 번역 (사용자 API 키 옵션) |
| 영어 빈칸 사용자 클릭 | 자동 추천 빈칸 (TF-IDF 기반) |
| 스타일 1종 (English 2 베이스) | 스타일 3종 토글 |
| 인쇄 / HTML 다운로드 | PDF 직접 다운로드 (jsPDF) |

---

## 9. 미해결 / 사용자 결정 필요

1. **index.html 통합 방식**: A(카드만) / B(섹션 헤더 + 카드) 중 어떤 거?
2. **베이스 스타일**: v1에서 English 2 / 동아윤 / 미래엔최 중 어느 거 우선?
3. **저작권**: 사용자가 직접 본문을 올려서 본인 수업용으로만 쓰면 본 앱은 단순 도구 — 본문이 결과물에 그대로 들어가도 OK인지 (사용 컨텍스트 확인).
4. **공유 형태**: 결과물 HTML을 학생에게 보낼지, 인쇄만 할지? (전자면 단일 HTML 파일 자체 완결성 중요)
5. **로컬 저장 외 동기화**: GitHub Pages만으로 충분한지, 클라우드 저장 필요 여부.

---

## 10. 즉시 다음 액션

→ 위 9번 결정 사항 사용자 컨펌 후
→ 1단계 (디자인 토큰 + UI 목업)로 진입.
