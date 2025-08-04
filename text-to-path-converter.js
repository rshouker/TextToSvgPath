// Main logic for Text to SVG Path Converter

let font = null;
let hebrewFont = null;
let bidiProcessor = null;
let harfBuzzModule = null;
let hb = null;
let universalShaper = null;
const fontUrl = 'fonts/NotoSans-Regular.woff';
const hebrewFontUrl = 'fonts/NotoSansHebrew-Regular.woff';

// Load the fonts on page load
opentype.load(fontUrl, function(err, loadedFont) {
  if (err) {
    console.error('Latin font could not be loaded:', err);
    font = null;
  } else {
    font = loadedFont;
    console.log('Latin font loaded successfully');
  }
});

opentype.load(hebrewFontUrl, function(err, loadedFont) {
  if (err) {
    console.error('Hebrew font could not be loaded:', err);
    hebrewFont = null;
  } else {
    hebrewFont = loadedFont;
    console.log('Hebrew font loaded successfully');
    console.log('Hebrew font unitsPerEm:', loadedFont.unitsPerEm);
    console.log('Latin font unitsPerEm:', font ? font.unitsPerEm : 'not loaded yet');
  }
});

// Initialize bidi processor when page loads
window.addEventListener('load', function() {
  if (typeof bidi_js !== 'undefined') {
    bidiProcessor = bidi_js();
    console.log('Bidi processor initialized');
  } else {
    console.warn('bidi_js not available');
  }
});

// Initialize HarfBuzz when page loads
window.addEventListener('load', function() {
  // Check if HarfBuzz functions are available
  if (typeof createHarfBuzz !== 'undefined') {
    console.log('HarfBuzz createHarfBuzz function found');
    
    createHarfBuzz().then(hbmodule => {
      harfBuzzModule = hbmodule;
      console.log('HarfBuzz module loaded successfully');
      
      if (typeof hbjs !== 'undefined') {
        window.hb = hbjs(hbmodule);
        hb = window.hb;
        console.log('HarfBuzz wrapper (hbjs) initialized successfully');
        console.log('Available HarfBuzz methods:', Object.keys(hb));
      } else {
        console.warn('hbjs wrapper not available');
      }
    }).catch(error => {
      console.error('Failed to initialize HarfBuzz:', error);
    });
  } else {
    console.warn('createHarfBuzz function not available - HarfBuzz files may not be loaded');
  }
});

// Initialize UniversalTextShaper
async function initializeUniversalShaper() {
  try {
    console.log('Initializing UniversalTextShaper...');
    universalShaper = new UniversalTextShaper();
    await universalShaper.initialize();
    
    // Load both fonts
    console.log('Loading fonts for UniversalTextShaper...');
    const latinFontBuffer = await UniversalTextShaper.createFontBuffer('fonts/notosans-variablefont_wdthwght-webfont.woff');
    console.log('Latin font loaded, size:', latinFontBuffer.byteLength);
    
    const hebrewFontBuffer = await UniversalTextShaper.createFontBuffer('fonts/notosanshebrew-variablefont_wdthwght-webfont.woff');
    console.log('Hebrew font loaded, size:', hebrewFontBuffer.byteLength);
    
    universalShaper.loadFont(latinFontBuffer, 'latin', true); // Set as default
    universalShaper.loadFont(hebrewFontBuffer, 'hebrew', false);
    console.log('Both fonts loaded into UniversalTextShaper');
    
    console.log('UniversalTextShaper initialized successfully with both fonts');
  } catch (error) {
    console.error('Failed to initialize UniversalTextShaper:', error);
    universalShaper = null;
  }
}

// Listen for UniversalTextShaper ready event
window.addEventListener('universalTextShaperReady', function() {
  console.log('UniversalTextShaper module loaded, initializing...');
  // Wait a bit for HarfBuzz to also be ready
  if (hb) {
    initializeUniversalShaper();
  } else {
    // Wait for HarfBuzz to be ready first
    const checkHarfBuzz = () => {
      if (hb) {
        initializeUniversalShaper();
      } else {
        setTimeout(checkHarfBuzz, 100);
      }
    };
    checkHarfBuzz();
  }
});

function getSettings() {
  return {
    text: document.getElementById('text-input').value,
    fontSize: parseFloat(document.getElementById('font-size').value),
    fillColor: document.getElementById('fill-color').value,
    strokeColor: document.getElementById('stroke-color').value,
    strokeWidth: parseFloat(document.getElementById('stroke-width').value),
    letterSpacing: parseFloat(document.getElementById('letter-spacing').value),
    direction: document.getElementById('text-direction').value,
    displayMode: document.getElementById('display-mode').value
  };
}

function clearPreview() {
  document.getElementById('svg-preview-area').innerHTML = '';
}

function calculateCharacterPositions(text, visualOrder, fontSize, letterSpacing) {
  const positions = [];
  const y = fontSize * 1.2; // y baseline
  let currentX = 0;
  
  for (let i = 0; i < visualOrder.length; i++) {
    const charIndex = visualOrder[i];
    const char = text[charIndex];
    const glyph = font.charToGlyph(char);
    const glyphWidth = glyph.advanceWidth * (fontSize / font.unitsPerEm);
    
    positions.push({
      char: char,
      x: currentX,
      y: y,
      width: glyphWidth,
      visualIndex: i,
      originalIndex: charIndex,
      glyph: glyph
    });
    
    currentX += glyphWidth + letterSpacing;
  }
  
  return positions;
}

function renderSVGPath(positions, settings) {
  let pathData = '';
  
  for (const pos of positions) {
    const glyphPath = pos.glyph.getPath(pos.x, pos.y, settings.fontSize);
    pathData += glyphPath.toPathData(3) + ' ';
  }
  
  return `<path d="${pathData.trim()}" fill="${settings.fillColor}" stroke="${settings.strokeColor}" stroke-width="${settings.strokeWidth}"/>`;
}

function renderTextCharacters(positions, settings) {
  let textElements = '';
  
  for (const pos of positions) {
    textElements += `<text x="${pos.x}" y="${pos.y}" font-family="NotoSans" font-size="${settings.fontSize}" fill="${settings.fillColor}" stroke="${settings.strokeColor}" stroke-width="${settings.strokeWidth}">${pos.char}</text>`;
  }
  
  return textElements;
}

function renderEntireText(settings) {
  const direction = settings.direction === 'rtl' ? 'rtl' : 'ltr';
  
  return `<text x="50%" y="${settings.fontSize * 1.2}" font-family="NotoSans" font-size="${settings.fontSize}" fill="${settings.fillColor}" stroke="${settings.strokeColor}" stroke-width="${settings.strokeWidth}" direction="${direction}" text-anchor="middle" style="direction: ${direction};">${settings.text}</text>`;
}

async function renderHarfBuzzSVGPath(settings) {
  console.log('renderHarfBuzzSVGPath called with:', settings);
  if (!universalShaper) {
    console.log('UniversalTextShaper not initialized');
    return `<text x="50%" y="50%" font-family="NotoSans" font-size="${settings.fontSize}" fill="#999" text-anchor="middle" style="font-style: italic;">UniversalTextShaper not initialized</text>`;
  }
  
  try {
    // Check if text is empty
    if (!settings.text || settings.text.trim() === '') {
      console.log('Text is empty, returning placeholder');
      return `<text x="50%" y="50%" font-family="NotoSans" font-size="${settings.fontSize}" fill="#999" text-anchor="middle" style="font-style: italic;">Enter text to see HarfBuzz output</text>`;
    }
    
    // Determine paragraph direction
    let paragraphDirection = 'auto';
    if (settings.direction === 'ltr') {
      paragraphDirection = 'ltr';
    } else if (settings.direction === 'rtl') {
      paragraphDirection = 'rtl';
    }
    
    // Detect script based on text content
    const hasHebrew = /[\u0590-\u05FF]/.test(settings.text);
    const fontScript = hasHebrew ? 'hebrew' : 'latin';
    
    // Use hybrid approach: Bidirectional processing + correct font selection
    console.log('Using hybrid approach with bidirectional text and font selection');
    
    // Get visual order from the main processing (it's already calculated above)
    const textProcessingResult = processTextForBidi(settings.text, settings.direction);
    
    // Create paths using visual order and appropriate fonts
    const x = 10;
    const y = settings.fontSize * 0.8;
    let currentX = x;
    const glyphElements = [];
    
    for (let i = 0; i < textProcessingResult.visualOrder.length; i++) {
      const charIndex = textProcessingResult.visualOrder[i];
      const char = settings.text[charIndex];
      
      // Choose the right font based on character
      let currentFont = font; // Default to Latin font (OpenType.js)
      const isHebrew = /[\u0590-\u05FF]/.test(char);
      
      if (isHebrew) {
        if (hebrewFont) {
          currentFont = hebrewFont;
        } else {
          console.log(`Skipping Hebrew character '${char}' - Hebrew font not loaded yet`);
          // Use a placeholder advance width
          currentX += settings.fontSize * 0.6; // Approximate Hebrew character width
          continue;
        }
      }
      
      const glyph = currentFont.charToGlyph(char);
      
      const glyphPath = glyph.getPath(currentX, y, settings.fontSize);
      const pathData = glyphPath.toPathData(3);
      
      if (pathData && pathData.trim() !== '') {
        glyphElements.push(`<path d="${pathData}" fill="${settings.fillColor}" stroke="${settings.strokeColor}" stroke-width="${settings.strokeWidth}"/>`);
      }
      
      const advance = glyph.advanceWidth * (settings.fontSize / currentFont.unitsPerEm);
      currentX += advance;
    }
    
    console.log('Generated', glyphElements.length, 'glyph paths using visual order');
    return glyphElements.join('\n    ');
    
  } catch (error) {
    console.error('HarfBuzz rendering error:', error);
    return `<text x="50%" y="50%" font-family="NotoSans" font-size="${settings.fontSize}" fill="#f44" text-anchor="middle" style="font-style: italic;">HarfBuzz Error: ${error.message}</text>`;
  }
}

// Helper function to process text for bidirectional rendering
function processTextForBidi(text, direction) {
  if (!bidiProcessor) {
    return { visualOrder: Array.from({length: text.length}, (_, i) => i), visualText: text };
  }
  
  try {
    const embeddingLevels = bidiProcessor.getEmbeddingLevels(text, direction);
    const reorderSegments = bidiProcessor.getReorderSegments(text, embeddingLevels);
    
    // Create visual order mapping
    let visualOrder = Array.from({length: text.length}, (_, i) => i);
    reorderSegments.forEach(([start, end]) => {
      const segment = visualOrder.slice(start, end + 1).reverse();
      visualOrder.splice(start, end - start + 1, ...segment);
    });
    
    // Create visual text
    const visualText = visualOrder.map(i => text[i]).join('');
    
    return { visualOrder, visualText };
  } catch (error) {
    console.error('Error processing bidirectional text:', error);
    return { visualOrder: Array.from({length: text.length}, (_, i) => i), visualText: text };
  }
}

async function renderSVG() {
  if (!font) {
    clearPreview();
    document.getElementById('svg-preview-area').textContent = 'Font not loaded.';
    return;
  }
  
  if (!bidiProcessor) {
    clearPreview();
    document.getElementById('svg-preview-area').textContent = 'Bidi library not available. Please ensure lib/bidi.min.js is loaded.';
    return;
  }
  
  const settings = getSettings();
  if (!settings.text) {
    clearPreview();
    return;
  }

  // Process text for bidirectional rendering
  let visualText;
  let visualOrder = null; // Array of indices for visual order
  
  try {
    // Get embedding levels and reorder segments
    const embeddingLevels = bidiProcessor.getEmbeddingLevels(settings.text, settings.direction);
    const reorderSegments = bidiProcessor.getReorderSegments(settings.text, embeddingLevels);
    
    console.log('Original text:', settings.text);
    console.log('Direction:', settings.direction);
    console.log('Embedding levels:', embeddingLevels);
    console.log('Reorder segments:', reorderSegments);
    
    // Create visual order mapping
    visualOrder = Array.from({length: settings.text.length}, (_, i) => i);
    reorderSegments.forEach(([start, end]) => {
      const segment = visualOrder.slice(start, end + 1).reverse();
      visualOrder.splice(start, end - start + 1, ...segment);
    });
    
    console.log('Visual order:', visualOrder);
    
    // Create visual text for text element rendering
    visualText = visualOrder.map(i => settings.text[i]).join('');
    
    console.log('Visual text:', visualText);
  } catch (error) {
    clearPreview();
    document.getElementById('svg-preview-area').textContent = 'Error processing bidirectional text: ' + error.message;
    return;
  }

  // Calculate character positions (only for modes that need individual positioning)
  let positions = [];
  if (settings.displayMode === 'svg' || settings.displayMode === 'text') {
    positions = calculateCharacterPositions(settings.text, visualOrder, settings.fontSize, settings.letterSpacing);
  }
  
  // Generate SVG content based on display mode
  let svgContent = '';
  let totalWidth, maxHeight;
  
  if (settings.displayMode === 'harfbuzz') {
    // Handle HarfBuzz rendering separately due to async nature
    try {
      if (!universalShaper) {
        svgContent = `<text x="50%" y="50%" font-family="NotoSans" font-size="${settings.fontSize}" fill="#999" text-anchor="middle" style="font-style: italic;">UniversalTextShaper not ready</text>`;
        totalWidth = 400;
        maxHeight = 100;
      } else {
        // Detect script and get proper dimensions from UniversalTextShaper
        const hasHebrew = /[\u0590-\u05FF]/.test(settings.text);
        const fontScript = hasHebrew ? 'hebrew' : 'latin';
        
        const shapingResult = universalShaper.shapeText(settings.text, {
          fontSize: settings.fontSize,
          paragraphDirection: settings.direction === 'rtl' ? 'rtl' : (settings.direction === 'ltr' ? 'ltr' : 'auto'),
          x: 0,
          y: 0,
          lineHeight: 1.2,
          fontScript: fontScript,
          features: 'kern,liga',
          returnPaths: true
        });
        
        totalWidth = Math.max(shapingResult.totalWidth + 20, 100); // Add padding
        maxHeight = Math.max(shapingResult.totalHeight + 20, settings.fontSize * 1.5);
        
        console.log('Calling renderHarfBuzzSVGPath with settings:', settings);
        svgContent = await renderHarfBuzzSVGPath(settings);
        console.log('HarfBuzz SVG content:', svgContent);
      }
    } catch (error) {
      console.error('HarfBuzz error:', error);
      svgContent = `<text x="50%" y="50%" font-family="NotoSans" font-size="${settings.fontSize}" fill="#f44" text-anchor="middle" style="font-style: italic;">Error: ${error.message}</text>`;
      totalWidth = 400;
      maxHeight = 100;
    }
  } else {
    // Handle other display modes
    if (settings.displayMode === 'entire') {
      // For entire text mode, estimate width based on text length
      totalWidth = Math.max(settings.text.length * settings.fontSize * 0.6, 200);
      maxHeight = settings.fontSize * 1.5;
    } else {
      // For character-based modes, use position-based calculation
      totalWidth = Math.max(positions.length > 0 ? positions[positions.length - 1].x + positions[positions.length - 1].width : 1, 1);
      maxHeight = settings.fontSize * 1.5;
    }
    
    if (settings.displayMode === 'svg') {
      svgContent = renderSVGPath(positions, settings);
    } else if (settings.displayMode === 'entire') {
      svgContent = renderEntireText(settings);
    } else {
      svgContent = renderTextCharacters(positions, settings);
    }
  }
  
  const svg = `
    <svg width="${totalWidth}mm" height="${maxHeight}mm" viewBox="0 0 ${totalWidth} ${maxHeight}" xmlns="http://www.w3.org/2000/svg">
      ${svgContent}
    </svg>
  `;
  document.getElementById('svg-preview-area').innerHTML = svg;
}

document.getElementById('render-btn').addEventListener('click', async () => {
  await renderSVG();
}); 