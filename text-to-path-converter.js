// Main logic for Text to SVG Path Converter

let font = null;
let bidiProcessor = null;
let harfBuzzModule = null;
let hb = null;
const fontUrl = 'arial-webfont.woff';

// Load the font on page load
opentype.load(fontUrl, function(err, loadedFont) {
  if (err) {
    console.error('Font could not be loaded:', err);
    font = null;
  } else {
    font = loadedFont;
    console.log('Font loaded successfully');
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
    textElements += `<text x="${pos.x}" y="${pos.y}" font-family="ArialWeb" font-size="${settings.fontSize}" fill="${settings.fillColor}" stroke="${settings.strokeColor}" stroke-width="${settings.strokeWidth}">${pos.char}</text>`;
  }
  
  return textElements;
}

function renderEntireText(settings) {
  const direction = settings.direction === 'rtl' ? 'rtl' : 'ltr';
  
  return `<text x="50%" y="${settings.fontSize * 1.2}" font-family="ArialWeb" font-size="${settings.fontSize}" fill="${settings.fillColor}" stroke="${settings.strokeColor}" stroke-width="${settings.strokeWidth}" direction="${direction}" text-anchor="middle" style="direction: ${direction};">${settings.text}</text>`;
}

function renderHarfBuzzSVGPath(settings) {
  // Placeholder for HarfBuzz SVG Path rendering
  // This will be implemented later
  return `<text x="50%" y="50%" font-family="ArialWeb" font-size="${settings.fontSize}" fill="#999" text-anchor="middle" style="font-style: italic;">HarfBuzz SVG Path (Not implemented yet)</text>`;
}

function renderSVG() {
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
  
  // Calculate SVG dimensions
  let totalWidth, maxHeight;
  
  if (settings.displayMode === 'entire') {
    // For entire text mode, estimate width based on text length
    totalWidth = Math.max(settings.text.length * settings.fontSize * 0.6, 200);
    maxHeight = settings.fontSize * 1.5;
  } else if (settings.displayMode === 'harfbuzz') {
    // For HarfBuzz placeholder, use fixed dimensions
    totalWidth = 400;
    maxHeight = 100;
  } else {
    // For character-based modes, use position-based calculation
    totalWidth = Math.max(positions.length > 0 ? positions[positions.length - 1].x + positions[positions.length - 1].width : 1, 1);
    maxHeight = settings.fontSize * 1.5;
  }

  // Generate SVG content based on display mode
  let svgContent = '';
  if (settings.displayMode === 'svg') {
    svgContent = renderSVGPath(positions, settings);
  } else if (settings.displayMode === 'harfbuzz') {
    svgContent = renderHarfBuzzSVGPath(settings);
  } else if (settings.displayMode === 'entire') {
    svgContent = renderEntireText(settings);
  } else {
    svgContent = renderTextCharacters(positions, settings);
  }
  
  const svg = `
    <svg width="${totalWidth}mm" height="${maxHeight}mm" viewBox="0 0 ${totalWidth} ${maxHeight}" xmlns="http://www.w3.org/2000/svg">
      ${svgContent}
    </svg>
  `;
  document.getElementById('svg-preview-area').innerHTML = svg;
}

document.getElementById('render-btn').addEventListener('click', renderSVG); 