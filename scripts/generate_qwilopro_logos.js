const fs = require('fs');
const path = require('path');
const opentype = require('opentype.js');

const fontBuffer = fs.readFileSync(path.join(__dirname, '..', 'nunito_900.ttf'));
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

// Render "Qwilo" with main font size 105, baseline 115, startX 6.9
const qwilo = renderText('Qwilo', 6.9, 115, 105);

// Render "PRO" with font size 51.5, baseline 55.5, right-aligned with Qwilo
const proStartX = qwilo.endX - 113.5;
const pro = renderText('PRO', proStartX, 55.5, 51.5);

const width = Math.ceil(pro.endX + 5);
const height = 137;

const svgLight = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
<g clip-path="url(#clip0_5_79)">
<path d="${qwilo.path}" fill="#343434"/>
<path d="${pro.path}" fill="#59A352"/>
</g>
<defs>
<clipPath id="clip0_5_79">
<rect width="${width}" height="${height}" fill="white"/>
</clipPath>
</defs>
</svg>
`;

const svgDark = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
<g clip-path="url(#clip0_9_5)">
<path d="${qwilo.path}" fill="white"/>
<path d="${pro.path}" fill="#59A352"/>
</g>
<defs>
<clipPath id="clip0_9_5">
<rect width="${width}" height="${height}" fill="white"/>
</clipPath>
</defs>
</svg>
`;

const targets = [
  path.join(__dirname, '..', 'src', 'assets', 'logo.svg'),
  path.join(__dirname, '..', 'public', 'assets', 'logo.svg'),
];

const darkTargets = [
  path.join(__dirname, '..', 'src', 'assets', 'LogoDark.svg'),
  path.join(__dirname, '..', 'public', 'assets', 'LogoDark.svg'),
];

targets.forEach((t) => fs.writeFileSync(t, svgLight));
darkTargets.forEach((t) => fs.writeFileSync(t, svgDark));

console.log('Successfully generated QwiloPRO logos!');
console.log('Dimensions:', width, 'x', height);
console.log('Saved to src/assets and public/assets.');
