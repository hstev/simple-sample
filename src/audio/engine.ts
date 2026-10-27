// Single shared AudioContext tuned for low latency. Everything audible routes
// through `master` → limiter so stacked pads never clip the output.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function build(): AudioContext {
  ctx = new AudioContext({ latencyHint: 'interactive' });
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -3;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.08;
  master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(limiter).connect(ctx.destination);
  return ctx;
}

export function audio(): AudioContext {
  return ctx ?? build();
}

export function out(): GainNode {
  audio();
  return master!;
}

export function setMasterVolume(v: number): void {
  out().gain.setTargetAtTime(v, audio().currentTime, 0.01);
}

/** iOS/Safari only start audio inside a user gesture: resume on the first one. */
export function installUnlock(): void {
  const resume = () => {
    const c = audio();
    if (c.state !== 'running') void c.resume();
    // Play one silent sample: required by older iOS to fully unlock output.
    const src = c.createBufferSource();
    src.buffer = c.createBuffer(1, 1, c.sampleRate);
    src.connect(c.destination);
    src.start();
  };
  const opts = { capture: true, passive: true } as const;
  for (const ev of ['pointerdown', 'keydown', 'touchend']) {
    window.addEventListener(ev, resume, opts);
  }
}
