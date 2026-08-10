// Generates the app's PWA icons with no external deps (raw PNG via zlib):
//   - pwa-192x192.png / pwa-512x512.png  (rounded, transparent corners — "any")
//   - pwa-maskable-512x512.png            (full-bleed — "maskable")
//   - apple-touch-icon.png (180)          (full-bleed — iOS home screen)
// A dark-navy tile with the brand-green dumbbell mark, matching the app theme.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { Buffer } from 'node:buffer';

const BG_TOP = [11, 18, 32]; // #0b1220
const BG_BOT = [15, 23, 42]; // #0f172a (theme_color)
const FG = [34, 197, 94, 255]; // brand green #22c55e

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

// Rounded-rect corner test (returns true if the pixel is OUTSIDE the rounded corner).
function outsideRounded(x, y, size, radius) {
  const r = radius;
  const near = (cx, cy) => Math.hypot(cx - x, cy - y) > r;
  if (x < r && y < r) return near(r, r);
  if (x > size - r && y < r) return near(size - r, r);
  if (x < r && y > size - r) return near(r, size - r);
  if (x > size - r && y > size - r) return near(size - r, size - r);
  return false;
}

// The dumbbell mark, drawn in a 0..1 normalized space centered in the tile.
function inDumbbell(nx, ny, scale) {
  // nx, ny in [-0.5, 0.5]; scale shrinks the mark (for maskable safe zone).
  const x = nx / scale;
  const y = ny / scale;
  const bar = Math.abs(y) < 0.05 && Math.abs(x) < 0.22;
  const collarL = Math.abs(y) < 0.11 && x > -0.28 && x < -0.2;
  const collarR = Math.abs(y) < 0.11 && x > 0.2 && x < 0.28;
  const plateL = Math.abs(y) < 0.2 && x > -0.4 && x < -0.28;
  const plateR = Math.abs(y) < 0.2 && x > 0.28 && x < 0.4;
  return bar || collarL || collarR || plateL || plateR;
}

function makePng(size, { maskable }) {
  const radius = maskable ? 0 : size * 0.22;
  const markScale = maskable ? 0.78 : 1; // keep the mark inside the safe zone
  const raw = Buffer.alloc((size * 4 + 1) * size);
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0; // filter: none
    const t = y / (size - 1);
    const bg = [
      Math.round(BG_TOP[0] + (BG_BOT[0] - BG_TOP[0]) * t),
      Math.round(BG_TOP[1] + (BG_BOT[1] - BG_TOP[1]) * t),
      Math.round(BG_TOP[2] + (BG_BOT[2] - BG_TOP[2]) * t),
    ];
    for (let x = 0; x < size; x++) {
      let px;
      if (!maskable && outsideRounded(x + 0.5, y + 0.5, size, radius)) {
        px = [0, 0, 0, 0];
      } else {
        const nx = (x + 0.5) / size - 0.5;
        const ny = (y + 0.5) / size - 0.5;
        px = inDumbbell(nx, ny, markScale) ? FG : [bg[0], bg[1], bg[2], 255];
      }
      raw[o++] = px[0];
      raw[o++] = px[1];
      raw[o++] = px[2];
      raw[o++] = px[3];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public', { recursive: true });
const outputs = [
  ['public/pwa-192x192.png', 192, { maskable: false }],
  ['public/pwa-512x512.png', 512, { maskable: false }],
  ['public/pwa-maskable-512x512.png', 512, { maskable: true }],
  ['public/apple-touch-icon.png', 180, { maskable: true }],
];
for (const [path, size, opts] of outputs) {
  writeFileSync(path, makePng(size, opts));
  console.log(`wrote ${path}`);
}
