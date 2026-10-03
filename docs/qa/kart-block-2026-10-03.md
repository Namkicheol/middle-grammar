# Kart readability and Block Blast viewport — 2026-10-03

## Scope

Continue the existing `codex/kart-answer-gates-20261001` release branch. Preserve the coastal art, audio, authoritative multiplayer rules, teacher editing work, and other uncommitted games.

## Kart

- Reduce the oversized player sprite to a 1.05–1.4 scale range.
- Show four dashed lanes and translucent, outlined A/B/C/D marks using the same centers as answer selection. Move the marks to 36m ahead so nearby rivals and the camera offset interfere less.
- Add bounded roadside optical-flow marks and stronger peripheral streaks; attenuate them during questions. No simulation-speed or question-timing change.
- Enlarge existing obstacle/reward sprites by about 24%, with a minimum distant size and grounded highlight/shadow.
- Explain item effects in a tap-open guide in the garage, solo race and multiplayer waiting/race screen. A visible 44px close button and Escape dismiss the guide.
- Show truthful pickup gains. Stars/coins charge the boost meter; they do not award score points. Multiplayer notifications use public server state deltas and do not replay old pickups on initial sync.
- Preserve existing full-inventory behavior and replace the misleading solo `undefined` reward message with a full-inventory notice.

## Verification

- Kart authoritative regression: 13/13 passed; changed JavaScript syntax and diff checks passed.
- Local WebKit 390×844 and 1280×720: item guide open/close, all four answer-lane buttons, fixed canvas geometry during question/help, exit and restart. No page errors.
- Controlled local multiplayer state messages: waiting-screen guide and star pickup notification. This is not a new real classroom/network load test.
- Student review checked lane correspondence and visibility; root inspected final screenshots and corrected letter placement plus the initially obstructed close action.
- Local evidence is under `output/kart-readability-20261003/` (not committed). Lazyweb visual reference: https://www.lazyweb.com/report/lazyweb/2df7d3e0-0330-4a94-a18c-1c97dcd31c48/?source=create

Physical old-tablet performance is not measured. Solo remains an 1800m finish race; multiplayer time is controlled by the teacher's room setting. No production deployment is represented by these local checks.

## Block Blast

- Use viewport-height grid layout; fit the square board into the space remaining after the HUD, mission, tray and footer. Match effect overlays to the resized board.
- Keep answer/result cards scrollable within the viewport and provide a CSS fallback for browsers without container units.
- Retain the previously fixed 25-second solo interval, authoritative classroom timer and result/retry improvements, with their matching regression expectations.
- WebKit verified 1280×720, 1440×800, 390×667 and 320×568: no page scroll overflow, visible tray/footer, exact overlay/board alignment, real pointer placement into cells 35/36/37/44 and result controls. Zero JavaScript errors. Root reviewed desktop and mobile screenshots.
- State regression and effect/timing checks passed. Local evidence: `output/blast-viewport-20261003/verify.json` and associated screenshots. This is responsive browser emulation, not physical-device testing.
