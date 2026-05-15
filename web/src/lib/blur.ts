export function laplacianVariance(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
): number {
  const roiX = Math.floor(w * 0.1);
  const roiY = Math.floor(h * 0.1);
  const roiW = Math.floor(w * 0.8);
  const roiH = Math.floor(h * 0.8);
  const d = ctx.getImageData(roiX, roiY, roiW, roiH).data;
  const stride = roiW * 4;
  const step = 4;
  let sum = 0;
  let sumSq = 0;
  let n = 0;

  for (let y = 1; y < roiH - 1; y += step) {
    for (let x = 1; x < roiW - 1; x += step) {
      const i = y * stride + x * 4;
      const luma = (v: number) =>
        0.299 * d[v] + 0.587 * d[v + 1] + 0.114 * d[v + 2];
      const c = luma(i);
      const t = luma(i - stride);
      const b = luma(i + stride);
      const l = luma(i - 4);
      const r = luma(i + 4);
      const lap = -4 * c + t + b + l + r;
      sum += lap;
      sumSq += lap * lap;
      n++;
    }
  }

  if (!n) return 0;
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

export function meanLuma(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
): number {
  const d = ctx.getImageData(0, 0, w, h).data;
  const step = 8;
  let sum = 0;
  let n = 0;

  for (let i = 0; i < d.length; i += 4 * step) {
    sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    n++;
  }

  return n > 0 ? sum / n : 0;
}
