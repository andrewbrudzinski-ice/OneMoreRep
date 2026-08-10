// Generates simple valid PNG app icons (no external deps) so the PWA has
// installable icons. Dark rounded-ish background with a green dumbbell bar.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { Buffer } from 'node:buffer';

const BG = [15, 23, 42, 255]; // slate-950
const FG = [34, 197, 94, 255]; // beat green

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function makePng(size) {
  const px = (x, y) => {
    // rounded corners
    const r = size * 0.22;
    const inCorner =
      (x < r && y < r && Math.hypot(r - x, r - y) > r) ||
      (x > size - r && y < r && Math.hypot(x - (size - r), r - y) > r) ||
      (x < r && y > size - r && Math.hypot(r - x, y - (size - r)) > r) ||
      (x > size - r && y > size - r && Math.hypot(x - (size - r), y - (size - r)) > r);
    if (inCorner) return [0, 0, 0, 0];

    // dumbbell: central bar + two plates
    const cy = size / 2;
    const barH = size * 0.1;
    const barY = Math.abs(y - cy) < barH / 2;
    const bar = barY && x > size * 0.3 && x < size * 0.7;
    const plateH = size * 0.28;
    const plateY = Math.abs(y - cy) < plateH / 2;
    const plateL = plateY && x > size * 0.2 && x < size * 0.3;
    const plateR = plateY && x > size * 0.7 && x < size * 0.8;
    if (bar || plateL || plateR) return FG;
    return BG;
  };

  const raw = Buffer.alloc((size * 4 + 1) * size);
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = px(x, y);
      raw[o++] = r;
      raw[o++] = g;
      raw[o++] = b;
      raw[o++] = a;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public', { recursive: true });
for (const size of [192, 512]) {
  writeFileSync(`public/pwa-${size}x${size}.png`, makePng(size));
  console.log(`wrote public/pwa-${size}x${size}.png`);
}
