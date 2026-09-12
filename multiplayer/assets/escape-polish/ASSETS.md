# Multiplayer escape art distribution

These PNGs are a deployment copy of the canonical solo escape art in
`escape/assets/`. The multiplayer Worker serves only `multiplayer/`, so its
renderer intentionally uses same-origin `./assets/escape-polish/` URLs.

When the canonical artwork changes, copy the three files here and keep the
filenames in sync with `multiplayer/escape-game.js`.
