const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Minimal PNG writer (RGBA, 8-bit)
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  const crc = crc32(Buffer.concat([typeBuf, data]));
  crcBuf.writeUInt32BE(crc, 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function writePngRGBA(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Add filter byte 0 per scanline
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }

  const idat = zlib.deflateSync(raw, { level: 9 });
  const png = Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return png;
}

function clamp01(x) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function blend(dst, idx, r, g, b, a) {
  const da = dst[idx + 3] / 255;
  const sa = a;
  const oa = sa + da * (1 - sa);
  if (oa <= 0) return;
  const dr = dst[idx] / 255;
  const dg = dst[idx + 1] / 255;
  const db = dst[idx + 2] / 255;
  const or = (r * sa + dr * da * (1 - sa)) / oa;
  const og = (g * sa + dg * da * (1 - sa)) / oa;
  const ob = (b * sa + db * da * (1 - sa)) / oa;
  dst[idx] = Math.round(or * 255);
  dst[idx + 1] = Math.round(og * 255);
  dst[idx + 2] = Math.round(ob * 255);
  dst[idx + 3] = Math.round(oa * 255);
}

function fillRoundedRect(img, w, h, x0, y0, x1, y1, radius, color) {
  const [r, g, b, a] = color;
  const rr = radius;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      // distance to nearest corner center if in corner region
      let alpha = 1;
      const cx = x < x0 + rr ? x0 + rr : x >= x1 - rr ? x1 - rr - 1 : null;
      const cy = y < y0 + rr ? y0 + rr : y >= y1 - rr ? y1 - rr - 1 : null;
      if (cx !== null && cy !== null) {
        const dx = x - cx;
        const dy = y - cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        alpha = d <= rr ? 1 : 0;
      }
      if (alpha <= 0) continue;
      const idx = (y * w + x) * 4;
      blend(img, idx, r, g, b, a * alpha);
    }
  }
}

function fillCircle(img, w, h, cx, cy, radius, color) {
  const [r, g, b, a] = color;
  const r2 = radius * radius;
  const x0 = Math.max(0, Math.floor(cx - radius - 1));
  const x1 = Math.min(w, Math.ceil(cx + radius + 2));
  const y0 = Math.max(0, Math.floor(cy - radius - 1));
  const y1 = Math.min(h, Math.ceil(cy + radius + 2));
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 <= r2) {
        const idx = (y * w + x) * 4;
        blend(img, idx, r, g, b, a);
      }
    }
  }
}

function strokeLine(img, w, h, x0, y0, x1, y1, thickness, color) {
  const [r, g, b, a] = color;
  const minX = Math.max(0, Math.floor(Math.min(x0, x1) - thickness - 2));
  const maxX = Math.min(w - 1, Math.ceil(Math.max(x0, x1) + thickness + 2));
  const minY = Math.max(0, Math.floor(Math.min(y0, y1) - thickness - 2));
  const maxY = Math.min(h - 1, Math.ceil(Math.max(y0, y1) + thickness + 2));
  const vx = x1 - x0;
  const vy = y1 - y0;
  const len2 = vx * vx + vy * vy;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let t = 0;
      if (len2 > 0) {
        t = ((px - x0) * vx + (py - y0) * vy) / len2;
        t = Math.max(0, Math.min(1, t));
      }
      const lx = x0 + t * vx;
      const ly = y0 + t * vy;
      const dx = px - lx;
      const dy = py - ly;
      const d = Math.sqrt(dx * dx + dy * dy);
      const edge = thickness / 2;
      if (d <= edge) {
        const idx = (y * w + x) * 4;
        blend(img, idx, r, g, b, a);
      }
    }
  }
}

function main() {
  const projectRoot = path.join(__dirname, '..');
  const outPngPath = path.join(projectRoot, 'public', 'icon.png');
  const w = 256;
  const h = 256;
  const img = Buffer.alloc(w * h * 4);
  // Transparent base
  for (let i = 0; i < img.length; i += 4) {
    img[i] = 0;
    img[i + 1] = 0;
    img[i + 2] = 0;
    img[i + 3] = 0;
  }

  // Colors (0..1)
  const blue = [0x3b / 255, 0x82 / 255, 0xf6 / 255, 1];
  const white = [1, 1, 1, 0.95];
  const dark = [0x1e / 255, 0x29 / 255, 0x3b / 255, 1];
  const gray = [0x94 / 255, 0xa3 / 255, 0xb8 / 255, 1];

  // Background rounded square
  fillRoundedRect(img, w, h, 0, 0, w, h, 54, blue);

  // Clock face
  fillCircle(img, w, h, 128, 140, 78, white);

  // Center dot
  fillCircle(img, w, h, 128, 140, 5, dark);

  // Hands
  strokeLine(img, w, h, 128, 140, 104, 98, 10, dark); // hour ~10
  strokeLine(img, w, h, 128, 140, 166, 110, 7, dark); // minute ~2

  // Markers (12/3/6/9)
  fillCircle(img, w, h, 128, 70, 5, gray);
  fillCircle(img, w, h, 198, 140, 5, gray);
  fillCircle(img, w, h, 128, 210, 5, gray);
  fillCircle(img, w, h, 58, 140, 5, gray);

  // Small bell top
  fillCircle(img, w, h, 105, 55, 14, [1, 1, 1, 0.9]);
  fillCircle(img, w, h, 151, 55, 14, [1, 1, 1, 0.9]);
  strokeLine(img, w, h, 105, 41, 151, 41, 6, [1, 1, 1, 0.9]);

  const png = writePngRGBA(w, h, img);
  fs.writeFileSync(outPngPath, png);
  console.log(`[gen-icon] Wrote ${outPngPath}`);
}

main();

