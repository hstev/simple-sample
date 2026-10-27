import type { PeaksLevel, PeaksResponse } from './peaks.worker';
import PeaksWorker from './peaks.worker?worker';

export type { PeaksLevel };

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, (l: PeaksLevel[]) => void>();

export function computePeaks(buf: AudioBuffer): Promise<PeaksLevel[]> {
  if (!worker) {
    worker = new PeaksWorker();
    worker.onmessage = (e: MessageEvent<PeaksResponse>) => {
      pending.get(e.data.id)?.(e.data.levels);
      pending.delete(e.data.id);
    };
  }
  const id = ++seq;
  // Copies: the AudioBuffer must keep its own sample data.
  const channels = Array.from({ length: Math.min(2, buf.numberOfChannels) }, (_, i) =>
    buf.getChannelData(i).slice(),
  );
  return new Promise((resolve) => {
    pending.set(id, resolve);
    worker!.postMessage({ id, channels }, channels.map((c) => c.buffer));
  });
}
