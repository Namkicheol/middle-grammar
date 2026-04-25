---
name: middle-grammar-sounds
description: middle-grammar 효과음 시스템(sounds.js). Web Audio API 기반 정답/오답/결과 사운드. 새 워크시트에 sounds.js 연결하는 방법. sounds.js 수정·연결 작업 시 호출.
---

# 효과음 시스템 (sounds.js)

Web Audio API 기반. 외부 오디오 파일 없이 브라우저에서 직접 생성.

## 사운드 종류

| 상황 | 내용 |
|------|------|
| 정답 | E5→G5 밝은 두 음 (sine) |
| 오답 | D4→B3 부드러운 낮은 두 음 (triangle, 기분 안 나쁘게) |
| 섹션/결과 70점↑ | C5-E5-G5-C6 4음 팡파르 |
| 섹션/결과 50~69점 | C5-E5-G5 3음 |
| 섹션/결과 50점 미만 | C5-D5 2음 (격려) |

- 빈칸 미입력(`답을 입력하세요!`) 등 유효성 오류는 오답 소리 없음
- 섹션 팝업 + 결과화면 동시 발생 시 1.5초 쿨다운으로 중복 재생 방지

## 연결 방식

`sounds.js`는 `window.toast` / `window.egmToast` / `window.showScorePopup`을 래핑하고, `MutationObserver`로 `#result` / `#egm-result` div를 감지한다. **각 워크시트 HTML은 별도 수정 불필요** — `score-popup.js` 다음에 스크립트 한 줄만 추가.

```html
<script src="../score-popup.js"></script>
<script src="../sounds.js"></script>
```

- `gerund-basic/index.html`은 `egmToast`(type: `'o'`/`'x'`) 사용 → 자동 감지
- 나머지 파일은 `toast`(type: `'ok'`/`'ng'`) 사용 → 자동 감지

## 새 워크시트에 효과음 추가 시

`score-popup.js` 뒤에 `<script src="../sounds.js"></script>` 한 줄 추가. `toast` 함수가 표준 패턴(`type: 'ok'`/`'ng'`)을 따르면 자동으로 작동.
