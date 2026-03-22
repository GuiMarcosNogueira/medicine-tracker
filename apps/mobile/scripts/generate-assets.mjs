/**
 * Gera os assets PNG do MedStock a partir do icon.svg.
 *
 * Uso:
 *   cd apps/mobile && node scripts/generate-assets.mjs
 *
 * Requer: pnpm add -D sharp --filter mobile
 */

import sharp from 'sharp';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = join(__dirname, '..', 'assets');

const svg = readFileSync(join(assetsDir, 'icon.svg'));

// icon.png — 1024×1024 (iOS, web)
await sharp(svg).resize(1024, 1024).png().toFile(join(assetsDir, 'icon.png'));
console.log('✓ icon.png');

// adaptive-icon.png — 1024×1024 (Android foreground)
await sharp(svg).resize(1024, 1024).png().toFile(join(assetsDir, 'adaptive-icon.png'));
console.log('✓ adaptive-icon.png');

// favicon.png — 64×64
await sharp(svg).resize(64, 64).png().toFile(join(assetsDir, 'favicon.png'));
console.log('✓ favicon.png');

// splash.png — logo 320×320 centrado em 1284×2778 com fundo teal800 (#0F524F)
const logo = await sharp(svg).resize(320, 320).toBuffer();
await sharp({
  create: { width: 1284, height: 2778, channels: 4, background: { r: 15, g: 82, b: 79, alpha: 1 } },
})
  .composite([{ input: logo, gravity: 'center' }])
  .png()
  .toFile(join(assetsDir, 'splash.png'));
console.log('✓ splash.png');

console.log('\n✓ Todos os assets gerados em apps/mobile/assets/');
