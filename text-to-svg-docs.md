# Text to SVG Path Converter - Technical Documentation

## Overview
This is a web-based tool that converts text into SVG paths using actual font outlines. It supports bidirectional text (RTL/LTR) using the industry-standard `bidi-js` library, custom fonts (now via bundled webfont), and various styling options. The generated paths are true vector outlines, not text elements, making them font-independent and suitable for precision applications like laser cutting.

## Core Technologies
- **OpenType.js** (v1.3.4) - Parses font files and extracts glyph outlines as bezier curves
- **D3.js** (v7.8.5) - Handles SVG DOM manipulation and calculations
- **bidi-js** - Full Unicode Bidirectional Algorithm (UAX#9) for robust RTL/LTR text support
- **Webfont Integration** - Uses bundled WOFF fonts (NotoSans with Latin and Hebrew support) for both SVG path and text rendering

## Key Components

### 1. Webfont Loading System
- The app now uses bundled webfonts (`notosans-variablefont_wdthwght-webfont.woff` and `notosanshebrew-variablefont_wdthwght-webfont.woff`) loaded via `@font-face` in CSS.
- Combined as a single "NotoSans" font family with unicode-range declarations for automatic script selection.
- No font upload UI is present; fonts are loaded automatically on page load.
- Both SVG path generation and SVG `<text>` rendering use these webfonts for consistency and browser-agnostic output.

### 2. SVG Physical Units for Laser Cutting
- The SVG output uses `width` and `height` in **mm** (e.g., `width="1000mm" height="300mm"`).
- The SVG also sets a `viewBox` (e.g., `viewBox="0 0 1000 300"`).
- **All coordinates, font sizes, and stroke widths are in user units (px), which map 1:1 to mm** due to the viewBox and physical size.
- This ensures that 1 SVG unit = 1 mm in the real world, making the output suitable for laser cutters and compatible with Inkscape and similar vector software.

### 3. Text-to-Path Conversion
```javascript
function renderSVG()
```
Main conversion pipeline:
1. Gets text and styling parameters from UI
2. Applies bidirectional text processing using `bidi-js` to create visual order mapping
3. Calculates precise character positions using `calculateCharacterPositions()`
4. Renders either SVG paths or individual text characters using identical positioning
5. Both display modes use the same character placement for perfect alignment
6. All geometry is in user units (px), which are 1:1 with mm

#### Core Functions:
- `calculateCharacterPositions()` - Calculates x,y positions for each character based on visual order
- `renderSVGPath()` - Generates SVG path data using calculated positions
- `renderTextCharacters()` - Generates individual `<text>` elements at exact same positions

### 4. Why This Approach?
- **Physical accuracy:** Ensures the SVG output is the correct real-world size for laser cutting, CNC, and print workflows.
- **Browser-agnostic:** By using a bundled webfont and explicit units, output is consistent across browsers and platforms.
- **Inkscape/laser compatibility:** This is the same approach used by Inkscape and other vector tools, ensuring seamless import/export.
- **No font dependency:** Output SVGs work without fonts installed on the target system.

### 5. Output Formats
- **Visual:** Live SVG preview with stroke/fill in two modes:
  - **Text Characters:** Individual `<text>` elements positioned precisely
  - **SVG Path:** Vector path outlines with identical character positioning
- **Code:** Formatted SVG path data in textarea
- **Download:** Complete SVG file with XML declaration, width/height in mm, and all geometry in user units (px)

## Integration Notes

### Required Libraries
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/opentype.js/1.3.4/opentype.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/bidi-js@1.1.2/dist/bidi.min.js"></script>
<!-- Fonts are loaded via @font-face in CSS -->
```

### Webfont Setup
```css
/* Combined NotoSans font family with Latin and Hebrew support */
@font-face {
  font-family: 'NotoSans';
  src: url('fonts/notosans-variablefont_wdthwght-webfont.woff') format('woff');
  font-weight: 100 900;
  font-stretch: 62.5% 100%;
  font-style: normal;
  unicode-range: U+0000-052F, U+1E00-1FFF, U+2020-20CF, U+2100-214F, U+2190-21FF, U+FB00-FB4F;
}

@font-face {
  font-family: 'NotoSans';
  src: url('fonts/notosanshebrew-variablefont_wdthwght-webfont.woff') format('woff');
  font-weight: 100 900;
  font-stretch: 62.5% 100%;
  font-style: normal;
  unicode-range: U+0590-05FF, U+FB1D-FB4F;
}
```

### SVG Output Example
**SVG Path Mode:**
```xml
<svg width="1000mm" height="300mm" viewBox="0 0 1000 300">
  <path d="M10,36L10,36Q10,36..." fill="#333" stroke="#000" stroke-width="0.5"/>
</svg>
```

**Text Characters Mode:**
```xml
<svg width="1000mm" height="300mm" viewBox="0 0 1000 300">
  <text x="0" y="36" font-family="NotoSans" font-size="30" fill="#333" stroke="#000" stroke-width="0.5">H</text>
  <text x="18.5" y="36" font-family="NotoSans" font-size="30" fill="#333" stroke="#000" stroke-width="0.5">e</text>
  <text x="35.2" y="36" font-family="NotoSans" font-size="30" fill="#333" stroke="#000" stroke-width="0.5">l</text>
  <!-- ... individual characters at precise positions ... -->
</svg>
```
- All coordinates, font sizes, and stroke widths are in px (user units), which map 1:1 to mm.
- Both modes use identical character positioning for perfect alignment.

## Key Features
- **No font dependency:** Output SVGs work without fonts installed
- **Physical units:** 1 SVG unit = 1 mm for laser/CNC/print
- **Unicode support:** Handles any characters the font supports
- **Bidirectional:** Proper RTL/LTR text mixing using `bidi-js`
- **Real paths:** Actual bezier curves, not text elements
- **Styling options:** Fill, stroke, size, spacing, direction
- **Glyph accuracy:** Uses font metrics for proper spacing

## Common Issues and Solutions

### 1. Rectangles Instead of Text
**Cause:** Font file lacks outline data or is bitmap font  
**Solution:** Use proper TrueType/OpenType fonts with outline data (the bundled NotoSans fonts are suitable)

### 2. Missing Characters
**Cause:** Font doesn't include glyphs for those Unicode points  
**Solution:** Use fonts with appropriate Unicode coverage

### 3. CORS Errors
**Cause:** Loading fonts from external domains  
**Solution:** Host fonts locally (as in this tool)

### 4. BiDi Library Loading
**Cause:** External library blocked or unavailable  
**Solution:** Ensure `bidi-js` is loaded from a reliable CDN or bundle it locally

## Font Requirements for International Text

### Hebrew/Arabic Support
- Use webfonts with the required Unicode coverage
- The bundled NotoSans covers Latin scripts, and NotoSansHebrew covers Hebrew text
- Unicode-range declarations automatically select the appropriate font for each character

## Advanced Usage

### Bidirectional Text Handling
For robust bidirectional text support, this tool uses the full Unicode Bidirectional Algorithm via the `bidi-js` library:
- **bidi-js**: npm install bidi-js or use CDN
- See: https://github.com/robertfisk/bidi-js

### Performance Optimization
- Cache parsed fonts in memory
- Batch process multiple texts
- Use Web Workers for large texts
- Implement glyph caching

### SVG Optimization
- Combine adjacent paths with same styling
- Use path simplification algorithms
- Compress path data (relative commands)
- Remove unnecessary precision

## License Considerations
- **OpenType.js**: MIT License
- **D3.js**: ISC License
- **bidi-js**: MIT License
- **NotoSans**: Google Noto fonts are open source (SIL Open Font License)
- Generated SVG paths are derivative works of the font
- Check font licenses for commercial use

## API Reference

### Main Functions
- `renderSVG()` - Generate SVG from current settings using the bundled webfont
- `calculateCharacterPositions()` - Calculate precise x,y positions for each character
- `renderSVGPath()` - Generate SVG path data from character positions
- `renderTextCharacters()` - Generate individual text elements from character positions
- `updateCodeOutput()` - Format SVG for display
- `copySVGCode()` - Copy to clipboard
- `downloadSVG()` - Save as file

### BiDi API (bidi-js)
- `bidi.getEmbeddingLevels(text, direction)` - Get embedding levels for text
- `bidi.reorderVisually(levels, text)` - Reorder text visually for rendering
- See the [bidi-js documentation](https://github.com/robertfisk/bidi-js) for full API details

### OpenType.js Key Methods
- `opentype.parse(buffer)` - Parse font file
- `font.getPath(text, x, y, size)` - Get SVG path
- `font.charToGlyph(char)` - Get glyph object
- `path.toPathData(decimals)` - Convert to SVG string

This converter transforms text into resolution-independent vector paths suitable for logos, artistic text, laser cutting, or any application requiring text as pure geometric shapes with precise physical dimensions.