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

// 3. Generate App Icon & Favicon with the EXACT QwiloPRO Logo
// Scale 320x168 logo to fit centered in 512x512
// 320 * 1.45 = 464 width, 168 * 1.45 = 243.6 height.
// Center coordinates: x = (512 - 464)/2 = 24, y = (512 - 243.6)/2 = 134.2
const iconSvg = `<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="112" fill="white"/>
  <rect x="12" y="12" width="488" height="488" rx="100" fill="#FFFFFF" stroke="#E2EBE1" stroke-width="12"/>
  <g transform="translate(24, 134) scale(1.45)">
    <path d="${qwilo.path}" fill="#243922"/>
    <path d="${pro.path}" fill="#59A352"/>
  </g>
</svg>`;

// Crisp Favicon SVG centered
const faviconSvg = `<svg width="256" height="256" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="256" height="256" rx="56" fill="white"/>
  <g transform="translate(12, 67) scale(0.725)">
    <path d="${qwilo.path}" fill="#243922"/>
    <path d="${pro.path}" fill="#59A352"/>
  </g>
</svg>`;

// Render 512x512 logo.png
const resvg512 = new Resvg(iconSvg, { fitTo: { mode: 'width', value: 512 } });
const png512 = resvg512.render().asPng();
fs.writeFileSync(path.join(__dirname, '..', 'public', 'logo.png'), png512);

// Render 192x192 logo_192.png
const resvg192 = new Resvg(iconSvg, { fitTo: { mode: 'width', value: 192 } });
const png192 = resvg192.render().asPng();
fs.writeFileSync(path.join(__dirname, '..', 'public', 'logo_192.png'), png192);

// Render 64x64 favicon.png
const resvg64 = new Resvg(faviconSvg, { fitTo: { mode: 'width', value: 64 } });
const png64 = resvg64.render().asPng();
fs.writeFileSync(path.join(__dirname, '..', 'public', 'favicon.png'), png64);
fs.writeFileSync(path.join(__dirname, '..', 'public', 'favicon.ico'), png64);

// Save to Next.js app directory icon
const appIconPath = path.join(__dirname, '..', 'src', 'app', 'icon.png');
fs.writeFileSync(appIconPath, png192);

console.log('Successfully generated all QwiloPRO exact logo favicon and icon assets!');

