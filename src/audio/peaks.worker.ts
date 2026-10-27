// Builds a min/max mipmap of the mono mixdown so the waveform can be drawn
// at any zoom without touching raw samples on the main thread.

export interface PeaksRequest {
  id: number;
  channels: Float32Array[];
}
export interface PeaksLevel {
  spb: number; // samples per bin
  min: Float32Array;
  max: Float32Array;
}
export interface PeaksResponse {
  id: number;
  levels: PeaksLevel[];
}

const BASE = 64;

self.onmessage = (e: MessageEvent<PeaksRequest>) => {
  const { id, channels } = e.data;
  const n = channels[0].length;
  const bins = Math.ceil(n / BASE);
  const min = new Float32Array(bins);
  const max = new Float32Array(bins);
  const inv = 1 / channels.length;
  for (let b = 0; b < bins; b++) {
    let lo = 1;
    let hi = -1;
    const end = Math.min(n, (b + 1) * BASE);
    for (let i = b * BASE; i < end; i++) {
      let v = 0;
      for (const ch of channels) v += ch[i];
      v *= inv;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    min[b] = lo;
    max[b] = hi;
  }
  const levels: PeaksLevel[] = [{ spb: BASE, min, max }];
  while (levels[levels.length - 1].min.length > 512) {
    const prev = levels[levels.length - 1];
    const len = Math.ceil(prev.min.length / 2);
    const mn = new Float32Array(len);
    const mx = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const j = i * 2;
      const k = Math.min(j + 1, prev.min.length - 1);
      mn[i] = Math.min(prev.min[j], prev.min[k]);
      mx[i] = Math.max(prev.max[j], prev.max[k]);
    }
    levels.push({ spb: prev.spb * 2, min: mn, max: mx });
  }
  const transfer = levels.flatMap((l) => [l.min.buffer, l.max.buffer]);
  (self as unknown as Worker).postMessage({ id, levels } satisfies PeaksResponse, transfer);
};
