/* Minimal dependency-free QR Code generator (byte mode, error-correction level M, versions 1-15).
   Usage: const qr = QR.encode("https://example.com"); qr.size, qr.get(x,y) -> true if dark. */
const QR = (() => {
  // Medium error correction: index = version (1..15)
  const ECC_PER_BLOCK = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24];
  const NUM_BLOCKS    = [-1,  1,  1,  1,  2,  2,  4,  4,  4,  5,  5,  5,  8,  9,  9, 10];
  const MAX_VER = 15;

  const bit = (x, i) => ((x >>> i) & 1) !== 0;

  function rawModules(ver) {
    let r = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      const n = Math.floor(ver / 7) + 2;
      r -= (25 * n - 10) * n - 55;
      if (ver >= 7) r -= 36;
    }
    return r;
  }
  const dataCodewords = ver => Math.floor(rawModules(ver) / 8) - ECC_PER_BLOCK[ver] * NUM_BLOCKS[ver];

  function gfMul(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; }
    return z;
  }
  function rsDivisor(deg) {
    const res = new Array(deg).fill(0); res[deg - 1] = 1;
    let root = 1;
    for (let i = 0; i < deg; i++) {
      for (let j = 0; j < res.length; j++) { res[j] = gfMul(res[j], root); if (j + 1 < res.length) res[j] ^= res[j + 1]; }
      root = gfMul(root, 2);
    }
    return res;
  }
  function rsRemainder(data, div) {
    const res = div.map(() => 0);
    for (const b of data) {
      const f = b ^ res.shift(); res.push(0);
      div.forEach((c, i) => { res[i] ^= gfMul(c, f); });
    }
    return res;
  }

  function utf8(str) { return Array.from(new TextEncoder().encode(str)); }

  function makeCodewords(bytes, ver) {
    const bits = [];
    const push = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    push(0x4, 4); push(bytes.length, ver < 10 ? 8 : 16);
    bytes.forEach(b => push(b, 8));
    const cap = dataCodewords(ver) * 8;
    push(0, Math.min(4, cap - bits.length));
    push(0, (8 - bits.length % 8) % 8);
    for (let pad = 0xEC; bits.length < cap; pad ^= 0xEC ^ 0x11) push(pad, 8);
    const data = new Array(bits.length / 8).fill(0);
    bits.forEach((b, i) => { data[i >>> 3] |= b << (7 - (i & 7)); });

    // split into blocks, add ECC, interleave
    const nb = NUM_BLOCKS[ver], eccLen = ECC_PER_BLOCK[ver];
    const raw = Math.floor(rawModules(ver) / 8);
    const nShort = nb - raw % nb, shortLen = Math.floor(raw / nb);
    const div = rsDivisor(eccLen), blocks = [];
    for (let i = 0, k = 0; i < nb; i++) {
      const dat = data.slice(k, k + shortLen - eccLen + (i < nShort ? 0 : 1)); k += dat.length;
      const ecc = rsRemainder(dat, div);
      if (i < nShort) dat.push(0);
      blocks.push(dat.concat(ecc));
    }
    const out = [];
    for (let i = 0; i < blocks[0].length; i++)
      blocks.forEach((blk, j) => { if (i !== shortLen - eccLen || j >= nShort) out.push(blk[i]); });
    return out;
  }

  function alignPositions(ver) {
    if (ver === 1) return [];
    const n = Math.floor(ver / 7) + 2;
    const step = Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
    const res = [6];
    for (let pos = ver * 4 + 10; res.length < n; pos -= step) res.splice(1, 0, pos);
    return res;
  }

  function build(codewords, ver) {
    const size = ver * 4 + 17;
    const mod = Array.from({ length: size }, () => new Array(size).fill(false));
    const fn  = Array.from({ length: size }, () => new Array(size).fill(false));
    const setFn = (x, y, dark) => { mod[y][x] = dark; fn[y][x] = true; };

    for (let i = 0; i < size; i++) { setFn(6, i, i % 2 === 0); setFn(i, 6, i % 2 === 0); }
    const finder = (cx, cy) => {
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy;
        if (x >= 0 && x < size && y >= 0 && y < size) setFn(x, y, d !== 2 && d !== 4);
      }
    };
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    const ap = alignPositions(ver);
    ap.forEach((cx, i) => ap.forEach((cy, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === ap.length - 1) || (i === ap.length - 1 && j === 0)) return;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++)
        setFn(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }));

    const formatBits = mask => {
      const data = (0 << 3) | mask;              // level M = 0b00
      let rem = data;
      for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      const bits = ((data << 10) | rem) ^ 0x5412;
      for (let i = 0; i <= 5; i++) setFn(8, i, bit(bits, i));
      setFn(8, 7, bit(bits, 6)); setFn(8, 8, bit(bits, 7)); setFn(7, 8, bit(bits, 8));
      for (let i = 9; i < 15; i++) setFn(14 - i, 8, bit(bits, i));
      for (let i = 0; i < 8; i++) setFn(size - 1 - i, 8, bit(bits, i));
      for (let i = 8; i < 15; i++) setFn(8, size - 15 + i, bit(bits, i));
      setFn(8, size - 8, true);
    };
    formatBits(0);
    if (ver >= 7) {
      let rem = ver;
      for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
      const bits = (ver << 12) | rem;
      for (let i = 0; i < 18; i++) {
        const a = size - 11 + i % 3, b = Math.floor(i / 3);
        setFn(a, b, bit(bits, i)); setFn(b, a, bit(bits, i));
      }
    }

    // place data
    let k = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let v = 0; v < size; v++) for (let j = 0; j < 2; j++) {
        const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - v : v;
        if (!fn[y][x] && k < codewords.length * 8) { mod[y][x] = bit(codewords[k >>> 3], 7 - (k & 7)); k++; }
      }
    }

    const masks = [
      (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => x * y % 2 + x * y % 3 === 0,
      (x, y) => (x * y % 2 + x * y % 3) % 2 === 0, (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0
    ];
    const applyMask = m => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && masks[m](x, y)) mod[y][x] = !mod[y][x]; };

    const penalty = () => {
      let p = 0, dark = 0;
      const line = get => {   // runs + finder-like pattern along one line
        let run = 1, s = "";
        for (let i = 0; i < size; i++) {
          const c = get(i); s += c ? "1" : "0";
          if (i > 0 && c === get(i - 1)) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1;
        }
        for (const pat of ["10111010000", "00001011101"]) {
          let idx = -1; while ((idx = s.indexOf(pat, idx + 1)) !== -1) p += 40;
        }
      };
      for (let y = 0; y < size; y++) line(i => mod[y][i]);
      for (let x = 0; x < size; x++) line(i => mod[i][x]);
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        if (mod[y][x]) dark++;
        if (x + 1 < size && y + 1 < size && mod[y][x] === mod[y][x + 1] && mod[y][x] === mod[y + 1][x] && mod[y][x] === mod[y + 1][x + 1]) p += 3;
      }
      const total = size * size;
      p += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
      return p;
    };

    let best = 0, bestP = Infinity;
    for (let m = 0; m < 8; m++) {
      formatBits(m); applyMask(m);
      const p = penalty();
      if (p < bestP) { bestP = p; best = m; }
      applyMask(m);
    }
    formatBits(best); applyMask(best);
    return { size, mod };
  }

  function encode(text) {
    const bytes = utf8(text);
    let ver = 1;
    while (ver <= MAX_VER && (4 + (ver < 10 ? 8 : 16) + bytes.length * 8) > dataCodewords(ver) * 8) ver++;
    if (ver > MAX_VER) throw new Error("URL is too long for this QR generator (max ~410 characters).");
    const { size, mod } = build(makeCodewords(bytes, ver), ver);
    return { version: ver, size, get: (x, y) => mod[y][x] };
  }

  /* ---- renderers ---- */
  function toSVG(qr, { margin = 4, dark = "#000", light = "#fff" } = {}) {
    const n = qr.size + margin * 2;
    let d = "";
    for (let y = 0; y < qr.size; y++) for (let x = 0; x < qr.size; x++)
      if (qr.get(x, y)) d += `M${x + margin},${y + margin}h1v1h-1z`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges">` +
           `<rect width="${n}" height="${n}" fill="${light}"/><path d="${d}" fill="${dark}"/></svg>`;
  }
  function toCanvas(qr, px, { margin = 4, dark = "#000", light = "#fff" } = {}) {
    const n = qr.size + margin * 2, scale = Math.max(1, Math.floor(px / n));
    const c = document.createElement("canvas"); c.width = c.height = n * scale;
    const g = c.getContext("2d"); g.fillStyle = light; g.fillRect(0, 0, c.width, c.height); g.fillStyle = dark;
    for (let y = 0; y < qr.size; y++) for (let x = 0; x < qr.size; x++)
      if (qr.get(x, y)) g.fillRect((x + margin) * scale, (y + margin) * scale, scale, scale);
    return c;
  }
  return { encode, toSVG, toCanvas };
})();
if (typeof module !== "undefined") module.exports = QR;
