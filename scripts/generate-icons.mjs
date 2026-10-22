// One-off generator for the PWA/raster icons. Run: node scripts/generate-icons.mjs
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// Pulse line in normalized icon space, matching public/icon.svg.
const POINTS = [
  [0.16, 0.52],
  [0.31, 0.52],
  [0.38, 0.36],
  [0.47, 0.68],
  [0.57, 0.42],
  [0.64, 0.52],
  [0.84, 0.52],
];
const HALF_STROKE = 0.031;
const START = [0x0e, 0x74, 0x90];
const END = [0x0d, 0x94, 0x88];

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t =
    lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function render(size) {
  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x + 0.5) / size;
      const ny = (y + 0.5) / size;
      const t = Math.min(1, (nx + ny) / 2);
      let r = START[0] + (END[0] - START[0]) * t;
      let g = START[1] + (END[1] - START[1]) * t;
      let b = START[2] + (END[2] - START[2]) * t;

      let distance = Infinity;
      for (let i = 0; i < POINTS.length - 1; i++) {
        const [ax, ay] = POINTS[i];
        const [bx, by] = POINTS[i + 1];
        distance = Math.min(distance, distanceToSegment(nx, ny, ax, ay, bx, by));
      }
      const alpha = Math.max(0, Math.min(1, HALF_STROKE + 0.5 / size - distance));
      if (alpha > 0) {
        r += (255 - r) * alpha;
        g += (255 - g) * alpha;
        b += (255 - b) * alpha;
      }

      const offset = (y * size + x) * 4;
      rgba[offset] = Math.round(r);
      rgba[offset + 1] = Math.round(g);
      rgba[offset + 2] = Math.round(b);
      rgba[offset + 3] = 255;
    }
  }
  return encodePng(size, size, rgba);
}

for (const [file, size] of [
  ["public/icon-32.png", 32],
  ["public/icon-192.png", 192],
  ["public/icon-512.png", 512],
  ["public/icon-512-maskable.png", 512],
  ["public/apple-touch-icon.png", 180],
]) {
  writeFileSync(file, render(size));
  console.log("wrote", file, size);
}
