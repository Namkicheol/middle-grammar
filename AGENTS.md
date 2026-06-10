# middle-grammar

이 파일이 canonical 작업 지침이다. `CLAUDE.md`(Claude Code)와 `AGENTS.md`(Codex)는 같은 파일이다(symlink). Claude Code·Codex 공통.

## 프로젝트

- 중학 영어 문법 워크시트
- GitHub Pages 배포
- 순수 HTML/CSS/JS
- NE능률 교과서·부속 교재 자료를 참고하되 원문 복사는 금지

## 작업 흐름

1. 요청 범위를 먼저 좁힌다.
   - 사용자가 요청한 파일과 직접 관련된 공통 파일만 수정한다.
   - 관련 없는 리팩토링, 디자인 전면 개편, 새 의존성 추가는 하지 않는다.
2. 필요한 로컬 문서를 읽는다.
   - 새 워크시트: `worksheet-sentence-guide.md`, `.claude/skills/middle-grammar-worksheet/SKILL.md`
   - 정답·해설: `answer-checker-guide.md`, `.claude/skills/middle-grammar-answer/SKILL.md`
   - 디자인: `.claude/skills/middle-grammar-design/SKILL.md`
   - 효과음: `.claude/skills/middle-grammar-sounds/SKILL.md`
   - 블로그: `.claude/skills/middle-grammar-blog/SKILL.md`
   - 블로그 이미지: `.claude/skills/blog-image-pencil/SKILL.md`
   - 교사 관점 점검(워크시트): `.claude/agents/teacher-review.md` 체크리스트
   - 학생 관점 점검(게임): `.claude/agents/student-review.md` 체크리스트
3. 구현 후 변경 범위에 맞게 검증한다.
   - HTML 워크시트는 브라우저 콘솔 오류, 정답 처리, 빈 입력 방지, `sounds.js`/`score-popup.js` 로드 순서를 확인한다.
   - 게임(`game2/`, `game/`, `whack-grammar/` 등)을 만들거나 크게 고친 뒤, 또는 "게임 점검" 요청 시에는 기술 검증과 함께 `student-review` 에이전트로 학생 플레이테스트를 함께 돌린다(재미·동기·체감 난이도·선택의 의미·온보딩).
   - 문서만 바꾼 경우에는 링크·경로·우선순위 문구가 모순되지 않는지 확인한다.
4. Git 작업은 사용자의 현재 지시에 따른다.
   - 사용자가 pull/push/commit까지 맡기면 알아서 처리한다.
   - 그 외에는 변경 사항과 검증 결과를 보고한다.
   - 기존 변경은 사용자 작업으로 보고 되돌리지 않는다.

## 스킬·에이전트 자료 취급

`.claude/skills/*/SKILL.md`와 `.claude/agents/*.md`는 Claude Code의 skill/agent 정의다. Claude Code 세션에서는 자동 로드되며, Codex에서는 자동 로드되지 않으므로 로컬 참고 문서로 읽어 절차·체크리스트를 그대로 따른다.

전역 지침은 `~/.claude/CLAUDE.md`(Claude Code) / `~/.codex/AGENTS.md`(Codex)에 있다.

브랜치 prefix는 사용하는 도구 관례를 따른다 (Claude Code `claude/`, Codex `codex/`).

커밋 트레일러(`Co-Authored-By: Claude…`)는 도구 기본 동작을 따르되 강제하지 않는다. Codex 커밋에는 넣지 않는다.

## 파일 구조

| 경로 | 내용 |
|------|------|
| `index.html` | 메인 허브 |
| `sounds.js` | 효과음 (Web Audio API) |
| `score-popup.js` | 점수 결과 팝업 |
| `worksheet-sentence-guide.md` | 예문 출처·문장 변형 규칙 |
| `answer-checker-guide.md` | 정답 처리·검증 규칙 |
| `refs/NE-md변환/` | NE능률 중1·중2 교과서·기본AB·심화·어법드릴 md (저작권 — `refs/`는 gitignore, 로컬 참고 전용) |
| `refs/NE-중1-교과서/` | NE능률 중1 원본 PDF·hwp + 문법연습문제·어법드릴 (로컬 전용) |
| `refs/NE-중2-교과서/` | NE능률 중2 원본 PDF + 문법연습문제 (로컬 전용) |
| `refs/학습지 참고자료/` | 미래엔(최) 본문 활동지·직소 자료 (로컬 전용) |
| `game/questions.js` | 게임·whack·game2 공유 문항 은행 (손수 관리 파일 — 재생성 금지, 직접 수정) |
| `blog-deploy/` | 티스토리 발행용 markdown |
| `blog-images/YYYY-MM-DD/` | 블로그 본문·썸네일 이미지 |
| `<topic>-basic/index.html` | 중1 기초 워크시트 |
| `<topic>-hard/index.html` | 중1 심화 워크시트 |
| `g2-<topic>-basic/index.html` | 중2 기초 워크시트 |
| `g2-<topic>-hard/index.html` | 중2 심화 워크시트 |

## 현재 워크시트 맵

| 구분 | 파일 |
|------|------|
| 중1 L1 | `be-verb/v2.html`, `general-verb-hard/index.html` |
| 중1 L2 | `gerund-basic/index.html`, `gerund-basic/index2.html`, `gerund-hard/index.html` |
| 중1 L3 | `past-be/index.html`, `past-be-hard/index.html` |
| 중1 L4 | `to-will-basic/index.html`, `to-will-hard/index.html` |
| 중1 L5 | `reflexive-to-basic/index.html`, `reflexive-to-hard/index.html` |
| 중1 L6 | `look-because-basic/index.html`, `look-because-hard/index.html` |
| 중1 L7 | `make-that-basic/index.html`, `make-that-hard/index.html` (make+형용사 & 접속사 that) |
| 중1 L8 | `exclaim-something-basic/index.html`, `exclaim-something-hard/index.html` (감탄문 What/How & -thing+형용사) |
| 중2 L1 | `g2-give-relclause-basic/index.html`, `g2-give-relclause-hard/index.html` |
| 중2 L2 | `g2-perfect-compare-basic/index.html`, `g2-perfect-compare-hard/index.html` |
| 중2 L3 | `g2-to-if-basic/index.html`, `g2-to-if-hard/index.html` |
| 중2 L4 | `g2-sothat-passive-basic/index.html`, `g2-sothat-passive-hard/index.html`, `g2-passive-practice/index.html` |
| 중2 L5 | `g2-want-relclause-basic/index.html`, `g2-want-relclause-hard/index.html` (동사+목적어+to부정사 & 목적격 관계대명사) |
| 중2 L6 | `g2-perceive-indirectq-basic/index.html`, `g2-perceive-indirectq-hard/index.html` (지각동사 & 간접의문문) |
| 중2 L7 | `g2-causative-asas-basic/index.html`, `g2-causative-asas-hard/index.html` (사역동사 & 원급 비교) |
| 중2 L8 | `g2-itto-whatto-basic/index.html`, `g2-itto-whatto-hard/index.html` (가주어 it & 의문사+to부정사) |
| 특수 | `reading-jigsaw/index.html` (리딩 직소 활동) |

## NE교과서 자료

> 모든 NE 자료는 `refs/`(gitignore, 로컬 전용) 하위에 있다. 커밋·푸시되지 않는다.

중1 자료:

```text
refs/NE-md변환/2022me_중1_L{1~8}_교과서.md
refs/NE-md변환/2022me_중1_L{1~8}_문법연습문제_기본AB.md
refs/NE-md변환/2022me_중1_L{1~8}_문법연습문제_심화.md
refs/NE-md변환/2022me_중1_L{1~8}_어법드릴문제.md
```

중2 자료:

```text
refs/NE-md변환/(22개정) 중학교 영어 2 교과서 전단원 PDF.md
refs/NE-md변환/2022me_중2_L{1~8}_문법연습문제_기본AB.md
refs/NE-md변환/2022me_중2_L{1~8}_문법연습문제_심화.md
```

중2 통합 파일 줄 범위:

| Lesson | 시작 줄 | 끝 줄 |
|--------|--------|-------|
| L1 | 1 | 1663 |
| L2 | 1664 | 2913 |
| L3 | 2914 | 4058 |
| L4 | 4059 | 5252 |
| L5 | 5253 | 6432 |
| L6 | 6433 | 8064 |
| L7~L8 | 8065 | 9092 |

## 문장·저작권 규칙

- NE능률 교과서·교재 문장을 그대로 사용하지 않는다.
- 이름·대명사만 바꾸는 것은 불충분하다.
- 주어, 목적어, 장소, 시간, 소재 등 최소 2개 이상을 바꾼다.
- 교과서 참고 예문과 창작 예문을 대략 50:50으로 섞는다.
- 원문 대조가 필요한 경우 rg/Grep으로 핵심 구절을 검색한다.

## 한국어 용어 규칙

도출과정·정답 해설·개념 설명 등 한국어 텍스트는 이 레포의 문서, 제공된 교재, 기출 원문에 있는 표현만 사용한다.

- refs에 없는 한국어 번역어를 새로 만들지 않는다.
- refs에서 한국어 표현을 찾지 못하면 영어 원어를 그대로 쓴다.
- 같은 파일 안에서 같은 개념의 한국어/영어 표현을 혼용하지 않는다.

## 새 워크시트 체크리스트

- [ ] 관련 NE 자료와 `worksheet-sentence-guide.md`를 읽었다.
- [ ] 예문은 교과서 참고 변형 50% + 창작 50%로 구성했다.
- [ ] 문제 유형은 `mcq`, `input`, `scramble`, `dist` 등을 자연스럽게 분산했다.
- [ ] 기초는 35~50문제, 심화는 종합훈련 15 + 짧은 지문 10 구조를 우선했다.
- [ ] `norm()` 적용, 빈 입력 방지, `q-kor`, `answer-hint` 규칙을 확인했다.
- [ ] scramble 단어 칩 순서는 정답 순서와 다르게 배치했다.
- [ ] `sounds.js`, `score-popup.js` 로드 순서를 확인했다.
- [ ] `index.html` 허브 카드 추가 여부를 확인했다.
- [ ] 한국어 텍스트에 임의 조어가 없는지 확인했다.
- [ ] 패턴 독점, drill 비율, 스캐폴딩, 오답 선택지, 난이도 progression을 점검했다.

## 하지 말 것

- 요청 외 디자인 전면 개편.
- `index.html` 메인 허브 레이아웃 변경 (카드 추가·순서 조정 외).
- 새 디자인 시스템·컴포넌트 라이브러리·외부 JS 의존성 추가.
- NE교과서 원문 복사·인용.
- refs에 없는 한국어 개념 번역어 도입.
