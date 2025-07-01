# Text to SVG Path Converter - Technical Documentation

## Overview
This is a web-based tool that converts text into SVG paths using actual font outlines. It supports bidirectional text (RTL/LTR), custom fonts (now via bundled webfont), and various styling options. The generated paths are true vector outlines, not text elements, making them font-independent and suitable for precision applications like laser cutting.

## Core Technologies
- **OpenType.js** (v1.3.4) - Parses font files and extracts glyph outlines as bezier curves
- **D3.js** (v7.8.5) - Handles SVG DOM manipulation and calculations
- **SimpleBiDi** - Custom lightweight bidirectional text algorithm (included inline)
- **Webfont Integration** - Uses a bundled WOFF font (ArialWeb) for both SVG path and text rendering

## Key Components

### 1. Webfont Loading System
- The app now uses a bundled webfont (`arial-webfont.woff`) loaded via `@font-face` in CSS.
- No font upload UI is present; the font is loaded automatically on page load.
- Both SVG path generation and SVG `<text>` rendering use this webfont for consistency and browser-agnostic output.

### 2. SVG Physical Units for Laser Cutting
- The SVG output uses `width` and `height` in **mm** (e.g., `width="1000mm" height="300mm"`).
- The SVG also sets a `viewBox` (e.g., `viewBox="0 0 1000 300"`).
- **All coordinates, font sizes, and stroke widths are in user units (px), which map 1:1 to mm** due to the viewBox and physical size.
- This ensures that 1 SVG unit = 1 mm in the real world, making the output suitable for laser cutters and compatible with Inkscape and similar vector software.

### 3. Text-to-Path Conversion
```javascript
function updatePath()
```
Main conversion pipeline:
1. Gets text and styling parameters from UI
2. Applies bidirectional text processing
3. Generates SVG paths character by character using OpenType.js and the webfont
4. Combines into single path element
5. Renders both as SVG path and as SVG `<text>` for visual comparison (using the same font and coordinates)
6. All geometry is in user units (px), which are 1:1 with mm

### 4. Why This Approach?
- **Physical accuracy:** Ensures the SVG output is the correct real-world size for laser cutting, CNC, and print workflows.
- **Browser-agnostic:** By using a bundled webfont and explicit units, output is consistent across browsers and platforms.
- **Inkscape/laser compatibility:** This is the same approach used by Inkscape and other vector tools, ensuring seamless import/export.
- **No font dependency:** Output SVGs work without fonts installed on the target system.

### 5. Output Formats
- **Visual:** Live SVG preview with stroke/fill
- **Code:** Formatted SVG path data in textarea
- **Download:** Complete SVG file with XML declaration, width/height in mm, and all geometry in user units (px)

## Integration Notes

### Required Libraries
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/opentype.js/1.3.4/opentype.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js"></script>
<link rel="stylesheet" href="arial-webfont.woff">
```

### Webfont Setup
```css
@font-face {
  font-family: 'ArialWeb';
  src: url('arial-webfont.woff') format('woff');
  font-weight: normal;
  font-style: normal;
}
```

### SVG Output Example
```xml
<svg width="1000mm" height="300mm" viewBox="0 0 1000 300">
  <path d="..." fill="#333" stroke="#000" stroke-width="0.5"/>
  <text x="..." y="..." font-family="ArialWeb" font-size="30" ...>Hello</text>
</svg>
```
- All coordinates, font sizes, and stroke widths are in px (user units), which map 1:1 to mm.

## Key Features
- **No font dependency:** Output SVGs work without fonts installed
- **Physical units:** 1 SVG unit = 1 mm for laser/CNC/print
- **Unicode support:** Handles any characters the font supports
- **Bidirectional:** Proper RTL/LTR text mixing
- **Real paths:** Actual bezier curves, not text elements
- **Styling options:** Fill, stroke, size, spacing, direction
- **Glyph accuracy:** Uses font metrics for proper spacing

## Common Issues and Solutions

### 1. Rectangles Instead of Text
**Cause:** Font file lacks outline data or is bitmap font  
**Solution:** Use proper TrueType/OpenType fonts with outline data (the bundled ArialWeb is suitable)

### 2. Missing Characters
**Cause:** Font doesn't include glyphs for those Unicode points  
**Solution:** Use fonts with appropriate Unicode coverage

### 3. CORS Errors
**Cause:** Loading fonts from external domains  
**Solution:** Host fonts locally (as in this tool)

### 4. BiDi Library Loading
**Cause:** External library blocked or unavailable  
**Solution:** Falls back to SimpleBiDi implementation

## Font Requirements for International Text

### Hebrew/Arabic Support
- Use a webfont with the required Unicode coverage
- The bundled ArialWeb covers basic Latin and some international scripts

## Advanced Usage

### Custom BiDi Implementation
For production use, consider integrating the full Unicode Bidirectional Algorithm:
- **bidi-js**: npm install bidi-js
- **unicode-bidirectional**: Full UAX#9 implementation

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
- **ArialWeb**: Ensure you have the right to distribute/use the font for your application
- Generated SVG paths are derivative works of the font
- Check font licenses for commercial use

## API Reference

### Main Functions
- `updatePath()` - Generate SVG from current settings using the bundled webfont
- `updateCodeOutput()` - Format SVG for display
- `copySVGCode()` - Copy to clipboard
- `downloadSVG()` - Save as file

### SimpleBiDi API
- `SimpleBiDi.isRTL(char)` - Check if character is RTL
- `SimpleBiDi.process(text, direction)` - Process bidirectional text

### OpenType.js Key Methods
- `opentype.parse(buffer)` - Parse font file
- `font.getPath(text, x, y, size)` - Get SVG path
- `font.charToGlyph(char)` - Get glyph object
- `path.toPathData(decimals)` - Convert to SVG string

This converter transforms text into resolution-independent vector paths suitable for logos, artistic text, laser cutting, or any application requiring text as pure geometric shapes with precise physical dimensions.