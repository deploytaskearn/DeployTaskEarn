/**
 * TaskEarn Logo Generator
 * Generates all SVG + PNG logo assets and saves to /uploads
 * Run: node scripts/generate-logos.js
 */

const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '../uploads');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

// ─── DESIGN TOKENS ────────────────────────────────────────────
const GREEN  = '#00C875';
const GREEN2 = '#009E5C';
const WHITE  = '#FFFFFF';
const DARK   = '#0A0F0D';
const INK    = '#0E1C15';

// ─── SVG DEFINITIONS ──────────────────────────────────────────

// Just the square icon (transparent background)
const MARK_SVG = `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${GREEN}"/>
      <stop offset="100%" stop-color="${GREEN2}"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="22" fill="url(#g)"/>
  <!-- Checkmark -->
  <path d="M25 51 L40 66 L75 33" stroke="${WHITE}" stroke-width="9.5"
        stroke-linecap="round" stroke-linejoin="round"/>
  <!-- Small coin dot -->
  <circle cx="75" cy="28" r="6" fill="${WHITE}" opacity="0.9"/>
</svg>`;

// Green tile (explicit green background, for use on any background)
const TILE_SVG = `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${GREEN}"/>
      <stop offset="100%" stop-color="${GREEN2}"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="22" fill="url(#g)"/>
  <path d="M25 51 L40 66 L75 33" stroke="${WHITE}" stroke-width="9.5"
        stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="75" cy="28" r="6" fill="${WHITE}" opacity="0.9"/>
</svg>`;

// Full logo — dark bg variant (white text)
const LOGO_DARK_SVG = `<svg viewBox="0 0 320 80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${GREEN}"/>
      <stop offset="100%" stop-color="${GREEN2}"/>
    </linearGradient>
  </defs>
  <!-- Icon tile -->
  <rect x="0" y="8" width="64" height="64" rx="14" fill="url(#g)"/>
  <path d="M16 40 L28 52 L48 30" stroke="${WHITE}" stroke-width="6.5"
        stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="47" cy="27" r="4" fill="${WHITE}" opacity="0.9"/>
  <!-- Wordmark -->
  <text x="80" y="54"
        font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"
        font-weight="700" font-size="34" letter-spacing="-0.5"
        fill="${WHITE}">Task</text>
  <text x="163" y="54"
        font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"
        font-weight="700" font-size="34" letter-spacing="-0.5"
        fill="${GREEN}">Earn</text>
</svg>`;

// Full logo — light bg variant (dark text)
const LOGO_LIGHT_SVG = `<svg viewBox="0 0 320 80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${GREEN}"/>
      <stop offset="100%" stop-color="${GREEN2}"/>
    </linearGradient>
  </defs>
  <rect x="0" y="8" width="64" height="64" rx="14" fill="url(#g)"/>
  <path d="M16 40 L28 52 L48 30" stroke="${WHITE}" stroke-width="6.5"
        stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="47" cy="27" r="4" fill="${WHITE}" opacity="0.9"/>
  <text x="80" y="54"
        font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"
        font-weight="700" font-size="34" letter-spacing="-0.5"
        fill="${INK}">Task</text>
  <text x="163" y="54"
        font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"
        font-weight="700" font-size="34" letter-spacing="-0.5"
        fill="${GREEN}">Earn</text>
</svg>`;

// ─── HELPERS ──────────────────────────────────────────────────

function svgToPng(svgStr, size) {
  const resvg = new Resvg(svgStr, { fitTo: { mode: 'width', value: size } });
  return resvg.render().asPng();
}

function save(filename, content, encoding = 'utf8') {
  const dest = path.join(OUT, filename);
  fs.writeFileSync(dest, content, encoding);
  console.log(`  ✓  ${filename}`);
}

// ─── GENERATE ─────────────────────────────────────────────────

console.log('\nTaskEarn Logo Generator\n─────────────────────');
console.log('Output →', OUT);
console.log('');

// SVG files
console.log('SVG assets:');
save('taskearn-logo-dark.svg',  LOGO_DARK_SVG);
save('taskearn-logo-light.svg', LOGO_LIGHT_SVG);
save('taskearn-mark.svg',       MARK_SVG);
save('taskearn-icon-tile.svg',  TILE_SVG);

// Mark PNGs (square icon)
console.log('\nMark PNGs:');
save('taskearn-mark-512.png', svgToPng(TILE_SVG, 512), 'binary');
save('taskearn-mark-128.png', svgToPng(TILE_SVG, 128), 'binary');

// Favicon PNGs
console.log('\nFavicon PNGs:');
for (const size of [16, 32, 48, 96, 180, 512]) {
  save(`favicon-${size}.png`, svgToPng(TILE_SVG, size), 'binary');
}

console.log('\n✅ All done! Files saved to /uploads\n');
