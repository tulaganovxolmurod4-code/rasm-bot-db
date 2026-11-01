import jpeg from "jpeg-js";

export function dhashFromJpeg(bytes) {
  const { width: W, height: H, data } = jpeg.decode(bytes, {
    useTArray: true,
    formatAsRGBA: false,
  });
  const cols = 9, rows = 8;
  const small = new Array(rows * cols);

  for (let r = 0; r < rows; r++) {
    const y0 = Math.floor((r * H) / rows);
    let y1 = Math.floor(((r + 1) * H) / rows);
    if (y1 <= y0) y1 = y0 + 1;
    for (let c = 0; c < cols; c++) {
      const x0 = Math.floor((c * W) / cols);
      let x1 = Math.floor(((c + 1) * W) / cols);
      if (x1 <= x0) x1 = x0 + 1;
      let sum = 0, n = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * W + x) * 3;
          sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          n++;
        }
      }
      small[r * cols + c] = sum / n;
    }
  }

  let hi = 0, lo = 0, k = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < 8; c++) {
      const bit = small[r * cols + c] > small[r * cols + c + 1] ? 1 : 0;
      if (k < 32) hi = ((hi << 1) | bit) >>> 0;
      else lo = ((lo << 1) | bit) >>> 0;
      k++;
    }
  }
  return hi.toString(16).padStart(8, "0") + lo.toString(16).padStart(8, "0");
}

function popcount(n) {
  n = n - ((n >>> 1) & 0x55555555);
  n = (n & 0x33333333) + ((n >>> 2) & 0x33333333);
  return (((n + (n >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

export function hamming(a, b) {
  const ah = parseInt(a.slice(0, 8), 16), al = parseInt(a.slice(8), 16);
  const bh = parseInt(b.slice(0, 8), 16), bl = parseInt(b.slice(8), 16);
  return popcount((ah ^ bh) >>> 0) + popcount((al ^ bl) >>> 0);
}
