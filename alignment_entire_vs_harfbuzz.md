## Goal

Align the visual position of the two rendering modes so they appear in the exact same place:
- **Entire text**: Browser `<text>` element using the web font
- **HarfBuzz SVG path**: Paths generated per glyph, used for export (e.g., laser cutting)

This ensures there is no discrepancy between the fast on‑screen display and the exported outlines.

## Principles we enforced

- **No font-size changes**: The slider value is the single source of truth; the HarfBuzz mode never rescales text to fit.
- **Same baseline**: Both modes use the same baseline formula `y = fontSize × 1.2`.
- **Same canvas sizing**: Both modes use the same SVG height formula `maxHeight = fontSize × 1.5` so vertical placement matches.
- **Same centering**: Both modes center the line horizontally using the same computed canvas width.

## Implementation details (where/what)

All changes are in `text-to-path-converter.js`.

- **Entire text mode** (unchanged from the original desired behavior)
  - `renderEntireText(settings)` renders with:
    - `x="50%"`, `text-anchor="middle"`
    - `y = fontSize × 1.2`

- **HarfBuzz mode**
  - In `renderSVG()` when `displayMode === 'harfbuzz'`:
    - We call `universalShaper.shapeText(...)` to get typographic dimensions.
    - We set `totalWidth = max(shapingResult.totalWidth + 20, 100)`.
    - We set `maxHeight = fontSize × 1.5` (to match the entire-text mode height behavior).
    - We pass the computed width to the renderer via `settings._canvasWidthForCentering` so the renderer can horizontally center without changing font size.

  - In `renderHarfBuzzSVGPath(settings)`:
    - We compute the total advance width (`totalTextWidth`) by summing glyph advances from the correct OpenType font (Latin vs Hebrew).
    - We compute `canvasWidth` from `settings._canvasWidthForCentering` and center with:
      - `startX = (canvasWidth − totalTextWidth) / 2`
    - We render glyph paths at:
      - `x = startX` (accumulated by glyph advances)
      - `y = fontSize × 1.2` (same baseline as entire-text)
    - Fill/stroke use the same UI colors/width as other modes.

## Why this works

- Using the exact same baseline and canvas height removes vertical drift.
- Centering both modes from the same canvas width removes horizontal drift.
- Avoiding any auto-fit/scale guarantees the HarfBuzz outlines represent the exact same size as the browser-rendered text.

## Notes

- Web fonts are loaded via `@font-face` (OpenSans and OpenSans Hebrew). Matching fonts are essential to keep metrics consistent.
- The slider labels now update live so the UI reflects the values actually used for rendering.

## Quick test steps

1. Enter text (e.g., `שלום`).
2. Set direction to RTL.
3. Render with `Display Mode: Entire text`.
4. Switch to `Display Mode: HarfBuzz` and render again.
5. The text should sit at the same vertical baseline and be centered the same way.

## Impact

- On-screen preview (fast) and exported paths (for laser cutting) now visually coincide, preventing misalignment between design and output.


