const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');
const opentype = require('opentype.js');

const fontBuffer = fs.readFileSync(path.join(__dirname, 'nunito_900.ttf'));
const font = opentype.parse(fontBuffer.buffer.slice(fontBuffer.byteOffset, fontBuffer.byteOffset + fontBuffer.byteLength));

function renderText(text, startX, baselineY, fontSize) {
  let x = startX;
  let combinedPath = '';
  for (let i = 0; i < text.length; i++) {
    const glyph = font.charToGlyph(text[i]);
    if (i > 0) {
      const prevGlyph = font.charToGlyph(text[i - 1]);
      const kern = font.getKerningValue(prevGlyph, glyph) || 0;
      x += kern * (fontSize / font.unitsPerEm);
    }
    const p = glyph.getPath(x, baselineY, fontSize);
    combinedPath += (combinedPath ? ' ' : '') + p.toPathData(2);
    x += glyph.advanceWidth * (fontSize / font.unitsPerEm);
  }
  return { path: combinedPath, endX: x };
}

// 1. Generate Qwilo + PRO logo SVGs
// Qwilo main text: fontSize 105, startX 8, baselineY 138 (top of letters ~60, bottom of Q tail ~160)
const qwilo = renderText('Qwilo', 8, 138, 105);

// PRO superscript text: fontSize 48, baselineY 45 (top of PRO ~10, bottom of PRO ~45.5)
// This creates a clean 14px vertical gap above Qwilo's 'i' dot and 'l' ascender (top at 60)
const proWidth = 104.7;
const proStartX = Math.round(qwilo.endX - proWidth - 2);
const pro = renderText('PRO', proStartX, 45, 48);

const width = 320;
const height = 168;

const svgLight = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
<g clip-path="url(#clip0_q_light)">
<path d="${qwilo.path}" fill="#243922"/>
<path d="${pro.path}" fill="#59A352"/>
</g>
<defs>
<clipPath id="clip0_q_light">
<rect width="${width}" height="${height}" fill="white"/>
</clipPath>
</defs>
</svg>
`;

const svgDark = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
<g clip-path="url(#clip0_q_dark)">
<path d="${qwilo.path}" fill="#FFFFFF"/>
<path d="${pro.path}" fill="#70B56A"/>
</g>
<defs>
<clipPath id="clip0_q_dark">
<rect width="${width}" height="${height}" fill="white"/>
</clipPath>
</defs>
</svg>
`;

// Save SVGs to both src/assets and public/assets
fs.writeFileSync(path.join(__dirname, '..', 'src', 'assets', 'logo.svg'), svgLight);
fs.writeFileSync(path.join(__dirname, '..', 'public', 'assets', 'logo.svg'), svgLight);
fs.writeFileSync(path.join(__dirname, '..', 'src', 'assets', 'LogoDark.svg'), svgDark);
fs.writeFileSync(path.join(__dirname, '..', 'public', 'assets', 'LogoDark.svg'), svgDark);

// 2. Render logo_dark.png
const resvgDark = new Resvg(svgDark, { fitTo: { mode: 'height', value: 80 } });
const pngDark = resvgDark.render().asPng();
fs.writeFileSync(path.join(__dirname, '..', 'src', 'assets', 'logo_dark.png'), pngDark);

// 3. Generate App Icon (Q icon for favicon and app logo)
// Get glyph 'Q' centered in 512x512
const glyphQ = font.charToGlyph('Q');
const qPath = glyphQ.getPath(110, 375, 420).toPathData(2);

// Icon SVG with white rounded rect background, bold dark Q, and green accent dot
const iconSvg = `<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="112" fill="white"/>
  <rect x="16" y="16" width="480" height="480" rx="96" fill="#F4F8F3" stroke="#DCE7DB" stroke-width="12"/>
  <path d="${qPath}" fill="#243922"/>
  <circle cx="390" cy="130" r="36" fill="#59A352"/>
</svg>`;

// Render 512x512 logo.png
const resvg512 = new Resvg(iconSvg, { fitTo: { mode: 'width', value: 512 } });
fs.writeFileSync(path.join(__dirname, '..', 'public', 'logo.png'), resvg512.render().asPng());

// Render 192x192 logo_192.png
const resvg192 = new Resvg(iconSvg, { fitTo: { mode: 'width', value: 192 } });
fs.writeFileSync(path.join(__dirname, '..', 'public', 'logo_192.png'), resvg192.render().asPng());

// Render 32x32 favicon.png
const resvg32 = new Resvg(iconSvg, { fitTo: { mode: 'width', value: 32 } });
fs.writeFileSync(path.join(__dirname, '..', 'public', 'favicon.png'), resvg32.render().asPng());

console.log('Successfully generated all QwiloPRO SVG and PNG assets with non-overlapping PRO placement!');
