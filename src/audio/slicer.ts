/** Splits [a, b) into n equal parts; returns n+1 boundaries. */
export function equalChops(a: number, b: number, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i <= n; i++) out.push(Math.round(a + ((b - a) * i) / n));
  return out;
}

/**
 * Energy-based onset detection over [a, b). `sensitivity` in 0..1; higher
 * finds more hits. Returns boundaries (including a and b) usable as chops.
 */
export function detectOnsets(
  buf: AudioBuffer,
  a: number,
  b: number,
  sensitivity: number,
  maxHits = 64,
): number[] {
  const hop = 512;
  const chans = Array.from({ length: buf.numberOfChannels }, (_, i) => buf.getChannelData(i));
  const frames = Math.floor((b - a) / hop);
  if (frames < 4) return [a, b];

  // Spectral-flux-like novelty on the RMS envelope (log domain).
  const env = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    const s0 = a + f * hop;
    for (const ch of chans) {
      for (let i = 0; i < hop; i++) {
        const v = ch[s0 + i];
        sum += v * v;
      }
    }
    env[f] = Math.log10(1e-9 + sum / (hop * chans.length));
  }
  const nov = new Float32Array(frames);
  for (let f = 1; f < frames; f++) nov[f] = Math.max(0, env[f] - env[f - 1]);

  const win = 16;
  const k = 0.4 + (1 - sensitivity) * 2.2; // threshold multiplier
  const minGap = Math.round((0.07 * buf.sampleRate) / hop); // 70ms
  const hits: { f: number; v: number }[] = [];
  let last = -minGap;
  for (let f = 1; f < frames - 1; f++) {
    let mean = 0;
    let n = 0;
    for (let j = Math.max(0, f - win); j < Math.min(frames, f + win); j++) {
      mean += nov[j];
      n++;
    }
    mean /= n;
    const v = nov[f];
    if (v > nov[f - 1] && v >= nov[f + 1] && v > mean * k + 0.05 && f - last >= minGap) {
      hits.push({ f, v });
      last = f;
    }
  }
  const top = hits
    .sort((x, y) => y.v - x.v)
    .slice(0, maxHits)
    .map((h) => a + h.f * hop)
    .sort((x, y) => x - y);
  const bounds = [a, ...top.filter((p) => p - a > hop * 2 && b - p > hop * 2), b];
  return bounds;
}

/** Snaps a frame to the nearest zero crossing (±256 frames) to avoid clicks. */
export function snapZero(buf: AudioBuffer, frame: number): number {
  const d = buf.getChannelData(0);
  const r = 256;
  let best = frame;
  let bestV = Infinity;
  for (let i = Math.max(1, frame - r); i < Math.min(d.length, frame + r); i++) {
    if ((d[i - 1] <= 0 && d[i] > 0) || (d[i - 1] >= 0 && d[i] < 0)) {
      const dist = Math.abs(i - frame);
      if (dist < bestV) {
        bestV = dist;
        best = i;
      }
    }
  }
  return best;
}
