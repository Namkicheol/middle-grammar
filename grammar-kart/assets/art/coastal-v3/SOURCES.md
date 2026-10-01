# Coastal V3 art sources

Generated on 2026-10-01 with OpenAI GPT Imagegen as original game art. The visual direction follows the locally supplied `output/kart-v3-art-direction.png`: a sunlit Mediterranean coastal circuit, cream stone, navy details, coral accents, friendly helmeted drivers, and clean molded-toy 3D forms. These assets were generated for this project and are not copied from the reference image or a third-party source.

The three original PNGs are preserved in `output/imagegen/`:

- `grammar-kart-coastal-v3-karts.png` — transparent 4-column by 3-row kart atlas.
- `grammar-kart-coastal-v3-roadside.png` — transparent 2-by-2 roadside atlas.
- `grammar-kart-coastal-v3-paddock.png` — wide coastal paddock background.

## Kart atlas

Rows identify the chassis color: teal classic, coral-red angular sport, then yellow rounded. Columns identify the view: straight rear, rear turning left, rear turning right, then front three-quarter showroom view. The first three columns are rear chase views; the turn poses face opposite directions and expose different sides of the kart. All sprites use the same white-helmeted driver.

The twelve transparent 512 × 512 WebP sprites are cropped by alpha bounds and aligned so the kart sits on a shared low baseline. Neutral white helmet and dark tire pixels remain neutral for color tinting.

## Roadside atlas

`roadside.webp` is a transparent 1024 × 1024 atlas with 512 × 512 cells, ordered row-major: palm tree in a stone planter, coastal grandstand, cream stone house with blue awning, then stacked coral and ivory tire barrier. Each prop is isolated from the transparent canvas and touches the bottom of its cell.

## Background

`paddock.webp` is a 1536 × 1024 WebP at quality 82. It shows the coastal paddock, bay, village, lighthouse, and a broad clear paved foreground. It contains no vehicle, text, or interface elements.
