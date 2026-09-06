# Arena v1 raster asset prompts

Generated with the built-in `image_gen` tool. The local reference image was used only for visual style, lighting, palette, and material direction:

`/Users/namgicheol/.codex/generated_images/01a0715a-7edb-7172-993e-76c41ce84fa1/exec-4a795049-81fb-44d6-a2a6-8137873f8892.png`

## `gym-background.webp`

```text
Use case: stylized-concept
Asset type: responsive browser game environment backdrop, final production raster, 1536 x 1024 landscape composition
Input images: Image 1 is a visual style, lighting, material, and architectural reference only; do not copy its UI, text, projection screen, banners, scoreboard, buttons, logo, or header.
Primary request: an empty cinematic school gym interior matching Image 1's restrained realistic game-art look.
Scene/backdrop: central uninterrupted dark teal painted masonry wall with subtle age and panel seams; tall blue-gray daylight windows on both far side walls; exposed dark steel roof trusses and beams; two or three warm industrial pendant lamps; polished honey-brown wooden basketball court floor with very restrained court lines; shallow equipment-free side benches may sit low at extreme edges.
Subject: the architecture itself, no focal object. The central wall must remain visually quiet and fully clear so HTML question UI can be layered over it.
Style/medium: cinematic stylized-realistic 3D game environment render, tactile but restrained, premium educational game art.
Composition/framing: exact straight-on symmetrical wide shot, camera centered at standing eye level, full bleed edge to edge, central wall occupies the middle, windows and beams frame the sides, floor occupies the lower fifth. No perspective tilt or fisheye.
Lighting/mood: deep teal ambient interior, cool window light, soft warm pools from amber ceiling lamps, focused and inviting rather than spooky.
Color palette: dark teal, muted blue-gray, warm amber, aged black steel, honey wood; restrained saturation.
Materials/textures: painted masonry, worn steel, glass panes, lightly polished wood, believable subtle surface wear.
Constraints: absolutely NO projection screen, NO blank board, NO scoreboard, NO banners, NO UI, NO header bar, NO text, NO letters, NO numbers, NO logos, NO controls, NO buttons, NO people, NO balls or equipment, NO watermark. Must work as a seamless-looking full-bleed background behind responsive HTML.
Avoid: giant central rectangle, poster-like framing, legible signage, excessive orange, dramatic smoke, clutter, characters, dutch angle.
```

## `projection-frame.webp`

```text
Use case: stylized-concept
Asset type: production game UI surface asset, exact 2.25:1 wide landscape rectangle, intended final crop 1536 x 683
Input images: Image 1 is a style and material reference only. Recreate only the large warm ivory projection-canvas surface and its thin aged dark metal frame; exclude everything else.
Primary request: a single perfectly rectilinear front-on projector frame containing a blank warm ivory canvas, filling the image edge to edge.
Scene/backdrop: none. The outermost pixels are the projector's thin dark gunmetal border; inside is uninterrupted warm ivory projection canvas.
Subject: one empty wide rectangular projection canvas with a narrow uniform dark metal edge on all four sides.
Style/medium: cinematic stylized-realistic 3D game UI material, restrained premium texture matching the reference.
Composition/framing: exact orthographic front-on view, 2.25:1 horizontal aspect ratio, the frame fills 100% of the image with no margin and no visible background. Border thickness about 2.5% of the image height, even and square-cornered. Inner canvas fills all remaining area. No perspective convergence, no slant, no depth angle.
Lighting/mood: soft warm even projector glow, subtle edge shadow only.
Color palette: creamy warm ivory canvas, charcoal/dark teal gunmetal border, very restrained amber warmth.
Materials/textures: fine paper/canvas tooth, extremely subtle age variation, lightly worn brushed dark metal edge.
Constraints: blank surface only; NO text, NO symbols, NO letters, NO numbers, NO UI controls, NO buttons, NO wall, NO gym, NO windows, NO beams, NO lamps, NO banners, NO screws inside canvas, NO logos, NO watermark. Keep center quiet and readable. Frame must be a true straight rectangle, not trapezoid.
Avoid: surrounding environment, decorative corners, ornate frame, rolled screen housing, hanging cords, perspective, vignette obscuring the canvas, strong stains, shadows across the center.
```

## `answer-panels.webp`

Initial generation prompt:

```text
Use case: stylized-concept
Asset type: production game UI sprite strip, exact 4:1 horizontal raster, four equal button-face cells for CSS background-size 400%
Input images: Image 1 is a style, tactile material, bevel, bolt, and restrained color reference only. Generate a new clean sprite; do not crop or reproduce the screenshot.
Primary request: exactly four equally wide front-on rectangular tactile metal answer-button faces arranged edge-to-edge as one continuous horizontal 4:1 strip.
Scene/backdrop: none. The four buttons fill every pixel of the image.
Subject: four identical-size rectangular cells in this exact left-to-right order: muted burnt orange-red, desaturated steel blue, warm amber-gold, deep teal. Each cell is a flat colored metal face with a narrow charcoal metal bevel at its own perimeter and exactly four small round recessed bolts, one near each corner.
Style/medium: cinematic stylized-realistic 3D game UI material matching the reference, tactile painted metal, restrained wear, premium but simple.
Composition/framing: exact orthographic FRONT-ON view, overall aspect ratio exactly 4:1. Four cells each occupy exactly 25% of image width and 100% height. The cells touch directly; no external margin, no transparent padding, no gutter, no space between cells. All vertical boundaries exactly at 25%, 50%, and 75%. Identical border thickness and identical bolt placement in every cell. Perfect horizontal and vertical edges. No perspective, no slant, no trapezoids, no overlap.
Lighting/mood: soft even overhead studio light, minimal bevel highlights, no cast shadow outside the strip.
Color palette: restrained orange-red #c95b3e family, steel blue #486d98 family, amber-gold #d89b27 family, teal #278b82 family; charcoal bevels; avoid neon saturation.
Materials/textures: lightly scuffed painted metal with subtle grain, narrow worn dark metal bevel, tiny round dark bolts.
Constraints: EXACTLY four panels, exactly equal width, exactly four bolts per panel. NO letters, NO A/B/C/D, NO words, NO numbers, NO icons, NO glyphs, NO symbols, NO logos, NO watermark. NO surrounding control deck, NO gym, NO floor, NO background, NO margins, NO gaps. The colored face centers must stay empty and readable for HTML text overlay.
Avoid: perspective dashboard, angled buttons, rounded pill shapes, unequal cell sizes, large shadows, extra screws, text-like scratches, bright neon colors, gaps, cropped outer edges.
```

The generated four-panel artwork was normalized to an exact 1600x400 sprite after generation. Each generated panel was resampled into an exact 400-pixel cell; the top and bottom bolt bands were proportionally preserved so the bolts remain round, while the empty center texture was shortened to the final 4:1 geometry. This is a newly generated sprite, not a crop of the reference screenshot.

An additional built-in geometry-correction attempt was inspected and discarded because it introduced empty canvas outside the panels. It did not contribute pixels to the final asset. Its prompt was:

```text
Use case: precise-object-edit
Asset type: production game UI sprite strip, final exact 4:1 horizontal raster for CSS background-size 400%
Input images: Image 1 is the edit target, the four-panel sprite just generated.
Primary request: change only the overall geometry: remake the same four panels as SHORT, nearly square button faces in one exact 4:1 strip. Keep the same left-to-right colors, material, front-on view, empty centers, narrow bevels, and four round bolts per panel.
Composition/framing: output canvas aspect ratio MUST be exactly 4:1, for example 1792 x 448. Each of the four panels must be exactly square and occupy exactly 25% of image width and 100% of image height. Preserve round bolts as circles; do not vertically squash or stretch the original portrait buttons. Re-render the panels naturally at the shorter proportions. Boundaries exactly at 25%, 50%, 75%. The four outer bevels touch directly, with no outside margin, gutter, gap, or background. Perfect orthographic FRONT-ON edges, no perspective or slant.
Constraints: exactly four equal panels; orange-red, steel blue, amber-gold, teal in that order; exactly four small round bolts on each. NO text, letters, words, numbers, icons, glyphs, logos, UI deck, gym, background, margins, gaps, or watermark.
Keep unchanged: colors, restrained cinematic game-art style, tactile painted-metal texture, charcoal bevel design, subtle wear, even lighting.
Avoid: 2:1 canvas, tall portrait panels, stretched bolts, perspective, uneven widths, blank separators, cast shadows outside the strip.
```
