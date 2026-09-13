# Sentence Blast / Whack Grammar browser QA — 2026-09-13

## Scope

- Local server: `http://127.0.0.1:4173`
- Browser: Aside, one agent-owned tab; functional interactions used CSS locators after DOM/snapshot inspection.
- Existing dirty work was preserved. No source fix was needed from this QA pass.

## Sentence Blast

URL: `http://127.0.0.1:4173/sentence-blast/?unit=all&seconds=0&qa=resume-blast`

The following state changes used an explicit fixture setup only to select the challenge kind or expose the end screen; the answer and navigation actions were real browser clicks.

- Initial direct launch: 64 board cells, 3 tray pieces, HUD timer `∞`.
- Choice: forced choice fixture (`Math.random=.01`), then real click on the option matching the inspected answer. Result: `grammarCorrect=1`, score `500`, `feedback.ok` (`정답! 문법 폭발 … +500`), then the challenge closed.
- Choice wrong: forced choice fixture, then real click on a non-answer option. Result: `feedback.ng` (`다시 확인해요 … 정답: are`), check button changed to `계속`; real `계속` click returned to play.
- Arrange wrong: forced arrange fixture (`Math.random=.99`), then real clicks in rendered reverse token order. Result: `feedback.ng` with the submitted reverse sentence and expected sentence; real `계속` click returned to play.
- Arrange correct: forced arrange fixture, then real clicks in `data-token=0..n-1` order and real `BLAST` click. Result: `grammarCorrect=2`, score `1000`, `feedback.ok`; after close, `chips=0` and `answer-zone=0`.
- Cleanup after both challenge continuations: overlay hidden and both source/answer containers empty (`chips=0`, `answer-zone=0`), so stale chips did not survive the next challenge.
- Restart: `finish()` was used only as end-screen fixture setup; real click on `button.again` reloaded the game and read back `phase=play`, score `0`, lines `0`, grammar total `0`, 64 empty cells, and timer `∞`.
- Browser errors: after reload, captured `console` errors `[]` and `pageerror` `[]`.

### 390px constrained check

Aside's page object has no native `setViewportSize` (confirmed as `undefined`), so a same-tab test-only iframe was used as the constrained browsing context. The child URL was confirmed as the same Sentence Blast URL.

- Child viewport: `innerWidth=390`, `innerHeight=844`.
- Child `documentElement.scrollWidth=390`, body scroll width `390`, `overflowX=false`.
- Child rendered 64 board cells and timer `∞`.
- Real child-frame clicks on `계속` and board cell produced hidden challenge state, score `20`, and 2 filled cells.

## Static regression checks

```text
node sentence-blast/state-regression.test.js  # passed
node whack-grammar/state-regression.test.js   # passed
```

Whack's live interaction pass was covered separately by the lead agent; this file records only the shared static regression result for that game.
