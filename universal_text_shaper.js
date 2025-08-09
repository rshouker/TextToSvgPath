// bidi-js is loaded globally via script tag

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
        }
        
        // Use global bidi_js if available
        if (typeof bidi_js !== 'undefined') {
            try {
                const bidiProcessor = bidi_js();
                const direction = paragraphDirection === 'rtl' ? 'rtl' : 'auto';
                
                // Get embedding levels and reorder segments
                const embeddingLevels = bidiProcessor.getEmbeddingLevels(text, direction);
                const reorderSegments = bidiProcessor.getReorderSegments(text, embeddingLevels);
                
                // Create visual order mapping
                let visualOrder = Array.from({length: text.length}, (_, i) => i);
                reorderSegments.forEach(([start, end]) => {
                    const segment = visualOrder.slice(start, end + 1).reverse();
                    visualOrder.splice(start, end - start + 1, ...segment);
                });
                
                // Create visual text
                return visualOrder.map(i => text[i]).join('');
            } catch (error) {
                console.warn('Bidi processing failed:', error);
                return text;
            }
        } else {
            console.warn('bidi_js not available, returning original text');
            return text;
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
        console.log(`Creating HarfBuzz objects with font data size: ${fontData.byteLength}`);
        const blob = this.hb.createBlob(fontData);
        console.log('Blob created:', blob);
        const face = this.hb.createFace(blob, 0);
        console.log('Face created, upem:', face.upem);
        const font = this.hb.createFont(face);
        console.log('Font created, available methods:', Object.getOwnPropertyNames(font));
        
        // Set font scale properly (use face.upem for HarfBuzz, fontSize is applied later)
        const scale = face.upem; // Use units per em for HarfBuzz
        font.setScale(scale, scale);
        console.log('Font scale set to face.upem:', scale, 'fontSize will be applied later:', fontSize);
        
        // Test if font has basic glyphs (temporarily disabled while debugging API)
        /*
        try {
            const testPath = font.glyphToPath(0); // Test .notdef glyph
            console.log('Glyph 0 (.notdef) path:', testPath);
            
            // Try to find glyph for 'h' character (unicode 104)
            for (let glyphId = 1; glyphId <= 100; glyphId++) {
                const testGlyphPath = font.glyphToPath(glyphId);
                if (testGlyphPath && testGlyphPath.length > 0) {
                    console.log(`Found non-empty glyph at ID ${glyphId}: ${testGlyphPath.substring(0, 50)}...`);
                    break;
                }
            }
        } catch (error) {
            console.error('Error testing glyph paths:', error);
        }
        */
        
        // Create buffer and add text
        const buffer = this.hb.createBuffer();
        console.log('Adding text to buffer:', text);
        buffer.addText(text);
        
        // Set buffer properties explicitly
        buffer.setDirection(4); // HB_DIRECTION_LTR = 4
        buffer.setScript(1214406446); // HB_SCRIPT_LATIN = 'Latn' as 4-byte tag
        buffer.setLanguage('en'); // English
        
        // Also try auto-detection as fallback
        buffer.guessSegmentProperties();
        console.log('Buffer properties set and guessed, available methods:', Object.getOwnPropertyNames(buffer));
        
        // Shape the text
        console.log('Shaping text with features:', features);
        this.hb.shape(font, buffer, features);
        
        // Get shaped results
        const shapedGlyphs = buffer.json();
        console.log('Raw shaped glyphs:', shapedGlyphs);
        
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
                console.log(`Attempting to get path for glyph ${glyph.g}`);
                try {
                    result.path = font.glyphToPath(glyph.g);
                    result.pathJson = font.glyphToJson(glyph.g);
                    console.log(`Glyph ${glyph.g}: path="${result.path}", pathJson:`, result.pathJson);
                    
                    // If glyph 0 (missing glyph), let's try to debug what's available
                    if (glyph.g === 0) {
                        console.log('Glyph 0 detected - this is the missing glyph (.notdef)');
                        // Try to get glyph name to see what character this should be
                        try {
                            const glyphName = font.glyphName(glyph.g);
                            console.log(`Glyph name for ${glyph.g}:`, glyphName);
                        } catch (e) {
                            console.log('Cannot get glyph name');
                        }
                    }
                } catch (error) {
                    console.error(`Error getting path for glyph ${glyph.g}:`, error);
                    result.path = '';
                    result.pathJson = [];
                }
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
            width: totalWidth * fontSize / face.upem, // Convert to actual units
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
            console.log(`Processing line: x=${line.x}, y=${line.y}, glyphs:`, line.glyphs.length);
            
            line.glyphs.forEach(glyph => {
                console.log(`Processing glyph: id=${glyph.glyphId}, hasPath=${!!glyph.path}, path="${glyph.path}"`);
                if (glyph.path) {
                    // Calculate final position
                    const finalX = currentX + glyph.offsetX;
                    const finalY = line.y - glyph.offsetY; // Flip Y coordinate
                    
                    console.log(`Adding SVG element at (${finalX}, ${finalY})`);
                    
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
        
        console.log(`Total SVG elements created: ${svgElements.length}`);
        
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
     * Calculate actual visual bounds from glyph metrics
     */
    calculateActualBounds(shapingResult) {
        if (!shapingResult.glyphs || shapingResult.glyphs.length === 0) {
            return {
                x: 0, y: 0, width: 0, height: 0,
                minX: 0, maxX: 0, minY: 0, maxY: 0
            };
        }

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        
        // For each line, we need to recalculate with font metrics
        shapingResult.lines.forEach(line => {
            let currentX = line.x;
            
            line.glyphs.forEach(glyph => {
                // Use pathJson to get glyph bounds if available
                if (glyph.pathJson && glyph.pathJson.xMin !== undefined) {
                    const glyphMinX = currentX + glyph.offsetX + glyph.pathJson.xMin;
                    const glyphMaxX = currentX + glyph.offsetX + glyph.pathJson.xMax;
                    const glyphMinY = line.y - glyph.offsetY - glyph.pathJson.yMax; // Flip Y
                    const glyphMaxY = line.y - glyph.offsetY - glyph.pathJson.yMin; // Flip Y
                    
                    minX = Math.min(minX, glyphMinX);
                    maxX = Math.max(maxX, glyphMaxX);
                    minY = Math.min(minY, glyphMinY);
                    maxY = Math.max(maxY, glyphMaxY);
                } else {
                    // Fallback: use advance width and font size estimates
                    const glyphX = currentX + glyph.offsetX;
                    const glyphY = line.y - glyph.offsetY;
                    
                    minX = Math.min(minX, glyphX);
                    maxX = Math.max(maxX, glyphX + glyph.advanceX);
                    minY = Math.min(minY, glyphY - line.height * 0.8); // Estimate ascent
                    maxY = Math.max(maxY, glyphY + line.height * 0.2); // Estimate descent
                }
                
                currentX += glyph.advanceX;
            });
        });
        
        // Handle edge case where no valid bounds were found
        if (minX === Infinity) {
            return {
                x: 0, y: 0, width: shapingResult.totalWidth, height: shapingResult.totalHeight,
                minX: 0, maxX: shapingResult.totalWidth, minY: 0, maxY: shapingResult.totalHeight
            };
        }
        
        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
            minX, maxX, minY, maxY
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
            fontSize = 72,
            returnBounds = false
        } = options;

        const actualViewBox = viewBox || `0 0 ${width} ${height}`;
        
        // Create SVG with individual <g> elements for each glyph
        const glyphElements = shapingResult.svgElements.map(element => 
            `<g transform="${element.transform}"><path d="${element.path}" fill="${fill}"/></g>`
        ).join('\n    ');
        
        const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${actualViewBox}">
    ${glyphElements}
</svg>`;

        if (returnBounds) {
            const actualBounds = this.calculateActualBounds(shapingResult);
            
            return {
                svg: svgString,
                bounds: {
                    // Typographic dimensions (layout-based)
                    typographicWidth: shapingResult.totalWidth,
                    typographicHeight: shapingResult.totalHeight,
                    
                    // Visual dimensions (ink-based)
                    actualWidth: actualBounds.width,
                    actualHeight: actualBounds.height,
                    actualX: actualBounds.x,
                    actualY: actualBounds.y,
                    
                    // Canvas dimensions
                    canvasWidth: width,
                    canvasHeight: height,
                    
                    // Detailed bounds
                    visualBounds: {
                        left: actualBounds.minX,
                        right: actualBounds.maxX,
                        top: actualBounds.minY,
                        bottom: actualBounds.maxY
                    }
                }
            };
        }
        
        return svgString;
    }

    /**
     * Create a single combined path SVG (alternative method)
     */
    createCombinedPathSVG(shapingResult, options = {}) {
        const {
            width = shapingResult.totalWidth,
            height = shapingResult.totalHeight,
            viewBox = null,
            fill = 'black',
            returnBounds = false
        } = options;

        const actualViewBox = viewBox || `0 0 ${width} ${height}`;
        
        // Combine all paths into groups with transforms
        const combinedElements = shapingResult.svgElements.map(element => {
            return this.applyTransformToPath(element.path, element.x, element.y);
        }).join('\n    ');
        
        const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${actualViewBox}">
    ${combinedElements}
</svg>`;

        if (returnBounds) {
            const actualBounds = this.calculateActualBounds(shapingResult);
            
            return {
                svg: svgString,
                bounds: {
                    // Typographic dimensions (layout-based)
                    typographicWidth: shapingResult.totalWidth,
                    typographicHeight: shapingResult.totalHeight,
                    
                    // Visual dimensions (ink-based)
                    actualWidth: actualBounds.width,
                    actualHeight: actualBounds.height,
                    actualX: actualBounds.x,
                    actualY: actualBounds.y,
                    
                    // Canvas dimensions
                    canvasWidth: width,
                    canvasHeight: height,
                    
                    // Detailed bounds
                    visualBounds: {
                        left: actualBounds.minX,
                        right: actualBounds.maxX,
                        top: actualBounds.minY,
                        bottom: actualBounds.maxY
                    }
                }
            };
        }
        
        return svgString;
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
    
    const primaryUrl = (typeof window !== 'undefined' && window.AppFonts && window.AppFonts.primaryUrl) ? window.AppFonts.primaryUrl : null;
    if (!primaryUrl) {
        throw new Error('No primary font URL configured in window.AppFonts.primaryUrl');
    }
    const fontBuffer = await UniversalTextShaper.createFontBuffer(primaryUrl);
    shaper.loadFont(fontBuffer, 'default', true);
    
    const result = shaper.shapeText('Hello مرحبا नमस्ते', {
        fontSize: 48,
        paragraphDirection: 'auto'
    });
    
    console.log('Shaped glyphs:', result.glyphs.length);
    console.log('Text direction:', result.direction);
    
    // Example 2: Multi-script with different fonts
    // Optional example font for other scripts can be configured similarly if available
    // const arabicFont = await UniversalTextShaper.createFontBuffer('/fonts/YourArabicFont.woff');
    // shaper.loadFont(arabicFont, 'arabic');
    
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

// Export for ES6 modules
export { 
    UniversalTextShaper, 
    shapeText, 
    createTextSVG,
    examples 
};