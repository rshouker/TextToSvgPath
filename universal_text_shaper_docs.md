# Universal Text Shaper - Technical Documentation

## Overview

The `UniversalTextShaper` is a JavaScript module that provides advanced text shaping capabilities using the HarfBuzz.js library. It enables precise text rendering with support for complex scripts, bidirectional text, and automatic font shaping. The module is designed for applications requiring high-quality text rendering, such as SVG generation, laser cutting, and multi-language text processing.

## Core Architecture

### Dependencies
- **HarfBuzz.js** (`hb.js` and `hbjs.js`) - Core text shaping engine
- **bidi-js** - Bidirectional text algorithm implementation
- **WebAssembly** - HarfBuzz runs as compiled WASM for performance

### Key Components

#### 1. UniversalTextShaper Class
The main class that orchestrates text shaping operations:

```javascript
class UniversalTextShaper {
    constructor() {
        this.hb = null;           // HarfBuzz instance
        this.fonts = new Map();   // Font registry
        this.fallbackFont = null; // Default font
        this.isReady = false;     // Initialization state
    }
}
```

#### 2. Font Management System
- Supports multiple fonts for different scripts
- Automatic fallback font selection
- Font loading from ArrayBuffer or Uint8Array

#### 3. Text Processing Pipeline
1. **Bidirectional Processing** - Handles RTL/LTR text mixing
2. **Line Splitting** - Processes multi-line text
3. **HarfBuzz Shaping** - Advanced glyph positioning and substitution
4. **Path Generation** - Converts glyphs to SVG paths
5. **Coordinate Calculation** - Precise positioning for rendering

## API Reference

### Initialization

#### `async initialize()`
Initializes the HarfBuzz engine and wrapper.

**Requirements:**
- `createHarfBuzz()` function must be available (from `hb.js`)
- `hbjs` wrapper must be loaded (from `hbjs.js`)

**Returns:** Promise resolving to the shaper instance

**Example:**
```javascript
const shaper = new UniversalTextShaper();
await shaper.initialize();
```

### Font Management

#### `loadFont(fontBuffer, script, isDefault)`
Loads a font for text shaping.

**Parameters:**
- `fontBuffer` (ArrayBuffer|Uint8Array) - Binary font data
- `script` (string, optional) - Script identifier (default: 'default')
- `isDefault` (boolean, optional) - Set as fallback font (default: false)

**Returns:** The shaper instance for chaining

**Example:**
```javascript
const fontBuffer = await fetch('/fonts/NotoSans.ttf').then(r => r.arrayBuffer());
shaper.loadFont(fontBuffer, 'latin', true);
```

#### `static async createFontBuffer(url)`
Utility method to load font data from URL.

**Parameters:**
- `url` (string) - Font file URL

**Returns:** Promise resolving to ArrayBuffer

**Example:**
```javascript
const fontBuffer = await UniversalTextShaper.createFontBuffer('/fonts/Arial.ttf');
```

### Text Shaping

#### `shapeText(text, options)`
Main text shaping function with full bidirectional support.

**Parameters:**
- `text` (string) - Input text to shape
- `options` (Object) - Shaping configuration:
  - `fontSize` (number) - Font size in points (default: 72)
  - `paragraphDirection` (string) - 'ltr', 'rtl', or 'auto' (default: 'auto')
  - `x`, `y` (number) - Starting position (default: 0, 0)
  - `lineHeight` (number) - Line spacing multiplier (default: 1.2)
  - `fontScript` (string) - Font script identifier (default: 'default')
  - `features` (string|null) - OpenType features like "kern,liga" (default: null)
  - `returnPaths` (boolean) - Generate SVG paths (default: true)

**Returns:** Object with shaping results:
```javascript
{
    text: string,           // Processed text
    direction: string,      // Detected direction
    lines: Array,          // Shaped line data
    totalWidth: number,    // Total text width
    totalHeight: number,   // Total text height
    svgElements: Array,    // SVG-ready elements
    glyphs: Array         // Detailed glyph information
}
```

**Example:**
```javascript
const result = shaper.shapeText('Hello مرحبا नमस्ते', {
    fontSize: 48,
    paragraphDirection: 'auto',
    features: 'kern,liga'
});
```

### SVG Generation

#### `createSVG(shapingResult, options)`
Creates a complete SVG element with individual glyph groups.

**Parameters:**
- `shapingResult` (Object) - Result from `shapeText()`
- `options` (Object) - SVG configuration:
  - `width` (number) - SVG canvas width in user units (defaults to `shapingResult.totalWidth` - the widest line)
  - `height` (number) - SVG canvas height in user units (defaults to `shapingResult.totalHeight` - total height of all lines)
  - `viewBox` (string|null) - SVG viewBox (defaults to `"0 0 ${width} ${height}"`)
  - `fill` (string) - Fill color (default: 'black')
  - `fontSize` (number) - Font size for scaling
  - `returnBounds` (boolean) - Return bounds information along with SVG (default: false)

**Returns:** 
- If `returnBounds` is `false`: SVG string
- If `returnBounds` is `true`: Object with `svg` and `bounds` properties

**Bounds Object Structure:**
```javascript
{
    svg: string,                    // The SVG markup
    bounds: {
        // Typographic dimensions (layout-based)
        typographicWidth: number,   // Sum of glyph advances
        typographicHeight: number,  // Line height × number of lines
        
        // Visual dimensions (actual ink bounds)
        actualWidth: number,        // Visual width of rendered glyphs
        actualHeight: number,       // Visual height of rendered glyphs
        actualX: number,           // Leftmost edge of visual content
        actualY: number,           // Topmost edge of visual content
        
        // Canvas dimensions
        canvasWidth: number,        // SVG element width
        canvasHeight: number,       // SVG element height
        
        // Detailed bounds
        visualBounds: {
            left: number,           // Leftmost coordinate
            right: number,          // Rightmost coordinate
            top: number,            // Topmost coordinate
            bottom: number          // Bottommost coordinate
        }
    }
}
```

**Note:** The `width` and `height` parameters define the SVG canvas dimensions, NOT the actual text bounds. They set the SVG element's `width` and `height` attributes and are used to calculate the default viewBox. The actual text paths are positioned within this canvas based on the shaping results.

**Example:**
```javascript
const svg = shaper.createSVG(result, {
    width: 800,
    height: 200,
    fill: '#333'
});
```

#### `createCombinedPathSVG(shapingResult, options)`
Creates SVG with combined paths using transforms.

**Parameters:**
- `shapingResult` (Object) - Result from `shapeText()`
- `options` (Object) - SVG configuration:
  - `width` (number) - SVG canvas width in user units (defaults to `shapingResult.totalWidth` - the widest line)
  - `height` (number) - SVG canvas height in user units (defaults to `shapingResult.totalHeight` - total height of all lines)
  - `viewBox` (string|null) - SVG viewBox (defaults to `"0 0 ${width} ${height}"`)
  - `fill` (string) - Fill color (default: 'black')
  - `returnBounds` (boolean) - Return bounds information along with SVG (default: false)

**Returns:**
- If `returnBounds` is `false`: SVG string with transformed paths
- If `returnBounds` is `true`: Object with `svg` and `bounds` properties (same structure as `createSVG()`)

**Note:** Like `createSVG()`, the `width` and `height` define the SVG canvas size, not the text bounds. This method applies transforms to position the paths rather than using individual `<g>` elements.

### Utility Functions

#### `calculateActualBounds(shapingResult)`
Calculates the actual visual bounds of the shaped text using glyph metrics.

**Parameters:**
- `shapingResult` (Object) - Result from `shapeText()`

**Returns:** Object with bounds information:
```javascript
{
    x: number,      // Leftmost edge
    y: number,      // Topmost edge
    width: number,  // Visual width
    height: number, // Visual height
    minX: number,   // Left bound
    maxX: number,   // Right bound
    minY: number,   // Top bound
    maxY: number    // Bottom bound
}
```

#### `getShapingInfo(text, options)`
Returns detailed shaping information for debugging.

**Returns:** Object with shaping metadata:
```javascript
{
    originalText: string,
    processedText: string,
    direction: string,
    glyphCount: number,
    scripts: Array,
    totalAdvance: number,
    lineCount: number
}
```

## Convenience Functions

### `async shapeText(text, fontBuffer, options)`
Standalone function for quick text shaping.

**Parameters:**
- `text` (string) - Text to shape
- `fontBuffer` (ArrayBuffer|Uint8Array) - Font data
- `options` (Object) - Shaping options

**Returns:** Promise resolving to shaping result

### `async createTextSVG(text, fontBuffer, options)`
Creates SVG directly from text and font.

**Parameters:**
- `text` (string) - Text to render
- `fontBuffer` (ArrayBuffer|Uint8Array) - Font data
- `options` (Object) - Rendering options

**Returns:** Promise resolving to SVG string

## Technical Details

### Bidirectional Text Processing

The module uses the `bidi-js` library to implement the Unicode Bidirectional Algorithm (UAX#9):

```javascript
applyBidi(text, paragraphDirection) {
    if (paragraphDirection === 'ltr') {
        return text;
    } else if (paragraphDirection === 'rtl') {
        const result = bidi(text, { dir: 'rtl' });
        return result.str;
    } else {
        // Auto-detect
        const result = bidi(text, { dir: 'auto' });
        return result.str;
    }
}
```

### HarfBuzz Integration

The module creates and manages HarfBuzz objects for each shaping operation:

1. **Blob** - Wraps font data
2. **Face** - Font face with metrics
3. **Font** - Scaled font instance
4. **Buffer** - Text buffer for shaping

```javascript
const blob = this.hb.createBlob(fontData);
const face = this.hb.createFace(blob, 0);
const font = this.hb.createFont(face);
const buffer = this.hb.createBuffer();
```

### Coordinate System

The module uses a coordinate system where:
- Origin is at top-left
- Y-axis is flipped (positive Y goes down)
- All measurements are in user units (typically pixels)
- Font scaling is applied automatically

### SVG Dimensions and Canvas

When creating SVG output, it's important to understand the relationship between different dimension parameters:

#### Canvas Dimensions (`width` and `height`)
- Define the SVG element's `width` and `height` attributes
- Set the physical/display size of the SVG canvas
- Default to `shapingResult.totalWidth` and `shapingResult.totalHeight`
- Do NOT represent the actual bounds of the text paths

#### Text Dimensions (`totalWidth` and `totalHeight`)
- `totalWidth`: Width of the widest line in the shaped text
- `totalHeight`: Combined height of all lines (line count × font size × line height)
- Calculated automatically during text shaping
- Represent the actual space occupied by the text

#### ViewBox Coordinate System
- Defaults to `"0 0 ${width} ${height}"`
- Maps the coordinate system to the canvas dimensions
- Text paths use absolute coordinates within this coordinate system

**Example:**
```javascript
// Text might occupy 300×100 units
const result = shaper.shapeText('Hello\nWorld', { fontSize: 48 });
console.log(result.totalWidth);  // e.g., 120 (width of "Hello")
console.log(result.totalHeight); // e.g., 115 (2 lines × 48px × 1.2 line height)

// But you can create a larger canvas
const svg = shaper.createSVG(result, {
    width: 500,   // Canvas width (larger than text)
    height: 300   // Canvas height (larger than text)
});
// Text will be positioned at its calculated coordinates within the 500×300 canvas
```

### Understanding Different Width Measurements

The module provides three different types of width measurements, each serving different purposes:

#### 1. Typographic Width (`totalWidth` / `typographicWidth`)
- **Definition**: Sum of all glyph advance widths
- **Purpose**: Text layout and cursor positioning
- **Use case**: Determining where to place the next character or line
- **Example**: For italic text, this might be smaller than the visual width

#### 2. Visual/Actual Width (`actualWidth`)
- **Definition**: Actual ink bounds of the rendered glyphs
- **Purpose**: Visual bounding box, collision detection
- **Use case**: Creating tight-fitting containers, overlays, or visual effects
- **Example**: For italic text, this includes the slanted portions that extend beyond the advance width

#### 3. Canvas Width (`canvasWidth`)
- **Definition**: SVG element dimensions
- **Purpose**: Display size and viewport
- **Use case**: Setting the size of the SVG container
- **Example**: Can be larger than text to provide padding or smaller to crop

**Practical Example:**
```javascript
const result = shaper.shapeText('Italic Text', { 
    fontSize: 48,
    features: 'slnt' // Enable slant/italic
});

const output = shaper.createSVG(result, { returnBounds: true });

console.log('Typographic width:', output.bounds.typographicWidth); // e.g., 180
console.log('Actual visual width:', output.bounds.actualWidth);    // e.g., 195 (extends beyond)
console.log('Canvas width:', output.bounds.canvasWidth);           // e.g., 200 (what you set)
```

### Memory Management

HarfBuzz objects are properly destroyed after use to prevent memory leaks:

```javascript
buffer.destroy();
font.destroy();
face.destroy();
blob.destroy();
```

## Usage Examples

### Basic Text Shaping

```javascript
// Initialize
const shaper = new UniversalTextShaper();
await shaper.initialize();

// Load font
const fontBuffer = await UniversalTextShaper.createFontBuffer('/fonts/NotoSans.ttf');
shaper.loadFont(fontBuffer, 'default', true);

// Shape text
const result = shaper.shapeText('Hello World', {
    fontSize: 48,
    paragraphDirection: 'ltr'
});

console.log('Text width:', result.totalWidth);
console.log('Glyph count:', result.glyphs.length);
```

### Multi-Script Text

```javascript
// Load multiple fonts
const latinFont = await UniversalTextShaper.createFontBuffer('/fonts/NotoSans.ttf');
const arabicFont = await UniversalTextShaper.createFontBuffer('/fonts/NotoSansArabic.ttf');

shaper.loadFont(latinFont, 'latin', true);
shaper.loadFont(arabicFont, 'arabic');

// Shape mixed-script text
const result = shaper.shapeText('Hello مرحبا', {
    fontSize: 36,
    paragraphDirection: 'auto'
});
```

### SVG Generation

```javascript
// Create SVG with individual glyphs
const svg = shaper.createSVG(result, {
    width: 600,
    height: 100,
    fill: '#2c3e50'
});

// Insert into DOM
document.getElementById('output').innerHTML = svg;
```

### Getting Actual Text Bounds

```javascript
// Get SVG with bounds information
const result = shaper.shapeText('Hello World', {
    fontSize: 48,
    paragraphDirection: 'ltr'
});

const output = shaper.createSVG(result, {
    returnBounds: true
});

console.log('SVG markup:', output.svg);
console.log('Typographic width:', output.bounds.typographicWidth);
console.log('Actual visual width:', output.bounds.actualWidth);
console.log('Visual bounds:', output.bounds.visualBounds);

// Create a tight-fitting SVG based on actual bounds
const tightSvg = shaper.createSVG(result, {
    width: output.bounds.actualWidth + 20,  // Add padding
    height: output.bounds.actualHeight + 20,
    returnBounds: false
});
```

### Calculating Bounds Only

```javascript
// Just get bounds without generating SVG
const bounds = shaper.calculateActualBounds(result);
console.log('Text occupies:', bounds.width, 'x', bounds.height);
console.log('From', bounds.minX, 'to', bounds.maxX, 'horizontally');
console.log('From', bounds.minY, 'to', bounds.maxY, 'vertically');
```

### Advanced Features

```javascript
// Use OpenType features
const result = shaper.shapeText('fi fl', {
    fontSize: 72,
    features: 'liga,kern', // Ligatures and kerning
    paragraphDirection: 'ltr'
});

// Debug shaping information
const info = shaper.getShapingInfo('Test text', {
    fontSize: 24
});
console.log('Shaping info:', info);
```

## Error Handling

The module throws descriptive errors for common issues:

- **Initialization errors**: Missing HarfBuzz dependencies
- **Font errors**: Invalid font data or missing fonts
- **Shaping errors**: Invalid text or configuration

```javascript
try {
    await shaper.initialize();
    const result = shaper.shapeText(text, options);
} catch (error) {
    console.error('Shaping error:', error.message);
}
```

## Performance Considerations

### Optimization Tips

1. **Reuse shaper instances** - Initialize once, use multiple times
2. **Cache font data** - Load fonts once and reuse
3. **Batch operations** - Process multiple texts together
4. **Use Web Workers** - For large text processing

### Memory Usage

- HarfBuzz objects are automatically cleaned up
- Font data is stored as Uint8Array for efficiency
- Large texts may require chunking for optimal performance

## Browser Compatibility

### Requirements

- **ES6 Modules** - Uses import/export syntax
- **WebAssembly** - HarfBuzz runs as WASM
- **Fetch API** - For font loading
- **Modern JavaScript** - Classes, async/await, etc.

### Supported Browsers

- Chrome 67+
- Firefox 60+
- Safari 11.1+
- Edge 79+

## Integration with Existing Projects

### Module Import

```javascript
import { UniversalTextShaper, shapeText, createTextSVG } from './universal_text_shaper.js';
```

### Global Usage

```javascript
// If using as global script
const shaper = new window.UniversalTextShaper();
```

### Webpack/Bundler Integration

The module is designed to work with modern bundlers and can be imported directly into build systems.

## Troubleshooting

### Common Issues

1. **"HarfBuzz not loaded"** - Ensure `hb.js` and `hbjs.js` are loaded before initialization
2. **"No font loaded"** - Load fonts before shaping text
3. **CORS errors** - Host fonts locally or configure CORS headers
4. **Memory issues** - Ensure proper cleanup of HarfBuzz objects

### Debug Mode

Use `getShapingInfo()` to debug shaping issues:

```javascript
const info = shaper.getShapingInfo(text, options);
console.log('Direction:', info.direction);
console.log('Glyph count:', info.glyphCount);
console.log('Scripts:', info.scripts);
```

## License and Dependencies

- **HarfBuzz.js** - MIT License
- **bidi-js** - MIT License
- **UniversalTextShaper** - Check your project's license requirements

## Future Enhancements

Potential improvements for future versions:

1. **Web Worker support** - Offload shaping to background threads
2. **Font subsetting** - Optimize font data for specific text
3. **Advanced OpenType features** - More feature support
4. **Performance profiling** - Built-in performance monitoring
5. **Plugin system** - Extensible shaping pipeline

---

This documentation covers the complete API and usage of the Universal Text Shaper module. For specific implementation details, refer to the source code comments and examples. 