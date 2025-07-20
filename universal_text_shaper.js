import bidi from 'bidi-js';

/**
 * Universal text shaper using the actual HarfBuzz.js API
 * Based on the real hbjs.js wrapper and hb.js module
 */
class UniversalTextShaper {
    constructor() {
        this.hb = null;
        this.fonts = new Map();
        this.fallbackFont = null;
        this.isReady = false;
    }

    /**
     * Initialize HarfBuzz - must be called first
     */
    async initialize() {
        if (typeof createHarfBuzz === 'undefined') {
            throw new Error('HarfBuzz not loaded. Include hb.js before using this class.');
        }
        
        const hbModule = await createHarfBuzz();
        
        if (typeof hbjs === 'undefined') {
            throw new Error('hbjs wrapper not loaded. Include hbjs.js before using this class.');
        }
        
        this.hb = hbjs(hbModule);
        this.isReady = true;
        
        return this;
    }

    /**
     * Load a font from ArrayBuffer
     * @param {ArrayBuffer|Uint8Array} fontBuffer - Binary font data
     * @param {string} script - Script identifier for multi-font setups (optional)
     * @param {boolean} isDefault - Whether this is the default/fallback font
     */
    loadFont(fontBuffer, script = 'default', isDefault = false) {
        if (!this.isReady) {
            throw new Error('Must call initialize() first');
        }

        // Convert to Uint8Array if needed
        const fontData = fontBuffer instanceof ArrayBuffer ? 
            new Uint8Array(fontBuffer) : fontBuffer;
        
        // Store font data
        this.fonts.set(script, fontData);
        
        if (isDefault || !this.fallbackFont) {
            this.fallbackFont = fontData;
        }
        
        return this;
    }

    /**
     * Create font buffer from URL
     * @param {string} url - Font file URL
     * @returns {Promise<ArrayBuffer>}
     */
    static async createFontBuffer(url) {
        if (typeof window !== 'undefined') {
            const response = await fetch(url);
            return await response.arrayBuffer();
        } else {
            const fs = await import('fs');
            return fs.readFileSync(url);
        }
    }

    /**
     * Shape text with automatic script detection and bidi support
     * @param {string} text - Input text
     * @param {Object} options - Shaping options
     * @returns {Object} Shaped text data with SVG paths
     */
    shapeText(text, options = {}) {
        if (!this.isReady) {
            throw new Error('Must call initialize() first');
        }

        const {
            fontSize = 72,
            paragraphDirection = 'auto',
            x = 0,
            y = 0,
            lineHeight = 1.2,
            fontScript = 'default',
            features = null, // "kern,liga" format
            returnPaths = true
        } = options;

        // 1. Apply bidirectional algorithm if needed
        const processedText = this.applyBidi(text, paragraphDirection);
        
        // 2. Split into lines
        const lines = processedText.split('\n');
        
        // 3. Shape each line
        const shapedLines = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (!line) continue; // Skip empty lines
            
            const lineY = y + (i * fontSize * lineHeight);
            const shapedLine = this.shapeLine(line, {
                fontSize,
                x,
                y: lineY,
                fontScript,
                features,
                returnPaths
            });
            
            shapedLines.push(shapedLine);
        }
        
        // 4. Combine results
        return this.combineLines(shapedLines, processedText, paragraphDirection);
    }

    /**
     * Apply bidirectional text algorithm
     */
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

    /**
     * Shape a single line using HarfBuzz
     */
    shapeLine(text, options) {
        const { fontSize, x, y, fontScript, features, returnPaths } = options;
        
        // Get font data
        const fontData = this.fonts.get(fontScript) || this.fallbackFont;
        if (!fontData) {
            throw new Error(`No font loaded for script: ${fontScript}`);
        }

        // Create HarfBuzz objects
        const blob = this.hb.createBlob(fontData);
        const face = this.hb.createFace(blob, 0);
        const font = this.hb.createFont(face);
        
        // Set font scale (convert fontSize to font units)
        const scale = fontSize / face.upem * 1000; // Approximate scaling
        font.setScale(scale, scale);
        
        // Create buffer and add text
        const buffer = this.hb.createBuffer();
        buffer.addText(text);
        
        // Let HarfBuzz auto-detect script, language, and direction
        buffer.guessSegmentProperties();
        
        // Shape the text
        this.hb.shape(font, buffer, features);
        
        // Get shaped results
        const shapedGlyphs = buffer.json();
        
        // Generate paths if requested
        const glyphs = shapedGlyphs.map(glyph => {
            const result = {
                glyphId: glyph.g,
                cluster: glyph.cl,
                advanceX: glyph.ax,
                advanceY: glyph.ay,
                offsetX: glyph.dx,
                offsetY: glyph.dy,
                flags: glyph.flags
            };
            
            if (returnPaths) {
                result.path = font.glyphToPath(glyph.g);
                result.pathJson = font.glyphToJson(glyph.g);
            }
            
            return result;
        });
        
        // Calculate total advance width
        const totalWidth = shapedGlyphs.reduce((sum, glyph) => sum + glyph.ax, 0);
        
        // Cleanup HarfBuzz objects
        buffer.destroy();
        font.destroy();
        face.destroy();
        blob.destroy();
        
        return {
            text,
            glyphs,
            width: totalWidth * fontSize / 1000, // Convert back to actual units
            height: fontSize,
            x,
            y
        };
    }

    /**
     * Combine shaped lines into final result
     */
    combineLines(shapedLines, processedText, direction) {
        if (shapedLines.length === 0) {
            return {
                text: processedText,
                direction,
                lines: [],
                totalWidth: 0,
                totalHeight: 0,
                svgElements: [],
                glyphs: []
            };
        }

        const totalWidth = Math.max(...shapedLines.map(line => line.width));
        const totalHeight = shapedLines.length * shapedLines[0].height;
        
        // Create SVG elements with transforms instead of path manipulation
        const svgElements = [];
        const allGlyphs = [];
        
        shapedLines.forEach(line => {
            let currentX = line.x;
            
            line.glyphs.forEach(glyph => {
                if (glyph.path) {
                    // Calculate final position
                    const finalX = currentX + glyph.offsetX;
                    const finalY = line.y - glyph.offsetY; // Flip Y coordinate
                    
                    // Create SVG group with transform instead of modifying path
                    svgElements.push({
                        path: glyph.path,
                        transform: `translate(${finalX}, ${finalY})`,
                        x: finalX,
                        y: finalY
                    });
                }
                
                // Add positioned glyph info
                allGlyphs.push({
                    ...glyph,
                    absoluteX: currentX + glyph.offsetX,
                    absoluteY: line.y - glyph.offsetY
                });
                
                currentX += glyph.advanceX;
            });
        });
        
        return {
            text: processedText,
            direction,
            lines: shapedLines,
            totalWidth,
            totalHeight,
            svgElements,
            glyphs: allGlyphs
        };
    }

    /**
     * Create a complete SVG element
     */
    createSVG(shapingResult, options = {}) {
        const {
            width = shapingResult.totalWidth,
            height = shapingResult.totalHeight,
            viewBox = null,
            fill = 'black',
            fontSize = 72
        } = options;

        const actualViewBox = viewBox || `0 0 ${width} ${height}`;
        
        // Create SVG with individual <g> elements for each glyph
        const glyphElements = shapingResult.svgElements.map(element => 
            `<g transform="${element.transform}"><path d="${element.path}" fill="${fill}"/></g>`
        ).join('\n    ');
        
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${actualViewBox}">
    ${glyphElements}
</svg>`;
    }

    /**
     * Create a single combined path SVG (alternative method)
     */
    createCombinedPathSVG(shapingResult, options = {}) {
        const {
            width = shapingResult.totalWidth,
            height = shapingResult.totalHeight,
            viewBox = null,
            fill = 'black'
        } = options;

        const actualViewBox = viewBox || `0 0 ${width} ${height}`;
        
        // Combine all paths into groups with transforms
        const combinedElements = shapingResult.svgElements.map(element => {
            return this.applyTransformToPath(element.path, element.x, element.y);
        }).join('\n    ');
        
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${actualViewBox}">
    ${combinedElements}
</svg>`;
    }

    /**
     * Apply transform to path using SVG transform instead of coordinate manipulation
     */
    applyTransformToPath(path, dx, dy) {
        // Instead of manipulating coordinates, wrap path in a group with transform
        return `<g transform="translate(${dx}, ${dy})"><path d="${path}"/></g>`;
    }

    /**
     * Get detailed shaping information for debugging
     */
    getShapingInfo(text, options = {}) {
        const result = this.shapeText(text, { ...options, returnPaths: false });
        
        return {
            originalText: text,
            processedText: result.text,
            direction: result.direction,
            glyphCount: result.glyphs.length,
            scripts: [...new Set(result.glyphs.map(g => 'auto-detected'))], // HarfBuzz handles this
            totalAdvance: result.totalWidth,
            lineCount: result.lines.length
        };
    }
}

// Convenience functions for simple use cases

/**
 * Simple text shaping function
 * @param {string} text - Text to shape
 * @param {ArrayBuffer|Uint8Array} fontBuffer - Font data
 * @param {Object} options - Shaping options
 * @returns {Promise<Object>} Shaping result
 */
async function shapeText(text, fontBuffer, options = {}) {
    const shaper = new UniversalTextShaper();
    await shaper.initialize();
    shaper.loadFont(fontBuffer, 'default', true);
    return shaper.shapeText(text, options);
}

/**
 * Create SVG from text
 * @param {string} text - Text to render
 * @param {ArrayBuffer|Uint8Array} fontBuffer - Font data  
 * @param {Object} options - Rendering options
 * @returns {Promise<string>} SVG string
 */
async function createTextSVG(text, fontBuffer, options = {}) {
    const shapingResult = await shapeText(text, fontBuffer, options);
    const shaper = new UniversalTextShaper();
    return shaper.createSVG(shapingResult, options);
}

// Usage examples
async function examples() {
    // Example 1: Basic usage
    const shaper = new UniversalTextShaper();
    await shaper.initialize();
    
    const fontBuffer = await UniversalTextShaper.createFontBuffer('/fonts/NotoSans-Regular.ttf');
    shaper.loadFont(fontBuffer, 'default', true);
    
    const result = shaper.shapeText('Hello مرحبا नमस्ते', {
        fontSize: 48,
        paragraphDirection: 'auto'
    });
    
    console.log('Shaped glyphs:', result.glyphs.length);
    console.log('Text direction:', result.direction);
    
    // Example 2: Multi-script with different fonts
    const arabicFont = await UniversalTextShaper.createFontBuffer('/fonts/NotoSansArabic-Regular.ttf');
    shaper.loadFont(arabicFont, 'arabic');
    
    // Example 3: Create SVG
    const svg = shaper.createSVG(result, {
        width: 800,
        height: 200,
        fill: '#333'
    });
    document.body.innerHTML = svg;
    
    // Example 4: Simple function
    const quickResult = await shapeText('Quick test', fontBuffer, {
        fontSize: 24,
        paragraphDirection: 'ltr'
    });
    
    return quickResult;
}

export { 
    UniversalTextShaper, 
    shapeText, 
    createTextSVG,
    examples 
};