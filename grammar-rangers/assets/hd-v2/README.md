# Grammar Rangers HD v2 sprites

Sixteen character and siege-unit atlases generated with OpenAI built-in image generation in July 2026.

- Allies face right; enemies face left.
- Each runtime strip has four 256×256 frames.
- Actions: `idle`, `run`, `attack`, `hurt`.
- The original HD v1 character image was used as the identity and costume reference.
- Prompts locked character identity, costume, weapon, direction, scale, and head height on a flat chroma background.
- Chroma-key atlases are local build intermediates; transparent runtime strips live in `units/`.
- Atlas slicing, row-spill cleanup, and foot-baseline alignment use `game2/assets/hd-v2/prepare_sheets.py`.

Added sprite sets:

- `rock-giant`
- `arcane-catapult`
- `battle-priest`
- `rift-warlock`
- `castle-marksman`
- `abyss-warlord`
- `crimson-dragon-tyrant`
