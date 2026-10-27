import { audio, out } from './engine';

export type PadMode = 'oneshot' | 'gate' | 'loop';

export interface PadConfig {
  slice: string | null;
  gain: number; // 0..1.5
  pitch: number; // semitones
  mode: PadMode;
  choke: number; // 0 = none
  reverse: boolean;
}

interface Voice {
  src: AudioBufferSourceNode;
  amp: GainNode;
  pad: number;
  choke: number;
}

const ATTACK = 0.0015; // s: just enough to kill the start click
const RELEASE = 0.012; // s: time constant for note-off / choke

function reversed(buf: AudioBuffer): AudioBuffer {
  const r = audio().createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const s = buf.getChannelData(c);
    const d = r.getChannelData(c);
    for (let i = 0, n = s.length; i < n; i++) d[i] = s[n - 1 - i];
  }
  return r;
}

/**
 * Polyphonic one-shot sampler. Buffers are pre-rendered (and pre-reversed
 * lazily, once) so a trigger only allocates two nodes and calls start().
 */
export class Sampler {
  private buffers = new Map<string, { fwd: AudioBuffer; rev?: AudioBuffer }>();
  private voices = new Map<number, Voice>();

  set(id: string, buf: AudioBuffer): void {
    this.buffers.set(id, { fwd: buf });
  }
  delete(id: string): void {
    this.buffers.delete(id);
  }
  clear(): void {
    this.stopAll();
    this.buffers.clear();
  }
  get(id: string): AudioBuffer | undefined {
    return this.buffers.get(id)?.fwd;
  }

  trigger(pad: number, cfg: PadConfig, velocity = 1): boolean {
    if (!cfg.slice) return false;
    const entry = this.buffers.get(cfg.slice);
    if (!entry) return false;
    const ctx = audio();
    const t = ctx.currentTime;

    const buf = cfg.reverse ? (entry.rev ??= reversed(entry.fwd)) : entry.fwd;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = 2 ** (cfg.pitch / 12);
    src.loop = cfg.mode === 'loop';
    const amp = ctx.createGain();
    const level = cfg.gain * velocity;
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(level, t + ATTACK);
    src.connect(amp).connect(out());
    src.start(t);

    // Retrigger cuts the previous voice of the same pad (MPC "mono" feel);
    // choke groups cut every voice in the same group.
    const prev = this.voices.get(pad);
    if (prev) this.kill(prev, t);
    if (cfg.choke) {
      for (const v of this.voices.values()) if (v.choke === cfg.choke && v.pad !== pad) this.kill(v, t);
    }
    const voice: Voice = { src, amp, pad, choke: cfg.choke };
    this.voices.set(pad, voice);
    src.onended = () => {
      if (this.voices.get(pad) === voice) this.voices.delete(pad);
      amp.disconnect();
    };
    return true;
  }

  /** Note-off: only gate/loop pads stop on release. */
  release(pad: number, cfg: PadConfig): void {
    if (cfg.mode === 'oneshot') return;
    const v = this.voices.get(pad);
    if (v) this.kill(v, audio().currentTime);
  }

  stopAll(): void {
    const t = audio().currentTime;
    for (const v of this.voices.values()) this.kill(v, t);
  }

  private kill(v: Voice, t: number): void {
    v.amp.gain.cancelScheduledValues(t);
    v.amp.gain.setValueAtTime(v.amp.gain.value, t);
    v.amp.gain.setTargetAtTime(0, t, RELEASE);
    try {
      v.src.stop(t + RELEASE * 6);
    } catch {
      /* already stopped */
    }
    if (this.voices.get(v.pad) === v) this.voices.delete(v.pad);
  }
}

/** Plays the edited timeline: from a position, optionally looping a range. */
export class Deck {
  private src: AudioBufferSourceNode | null = null;
  private amp: GainNode | null = null;
  private startedAt = 0;
  private offset = 0;
  private loop: [number, number] | null = null;
  private dur = 0;
  onEnded: (() => void) | null = null;

  get playing(): boolean {
    return this.src !== null;
  }

  play(buf: AudioBuffer, from: number, loop: [number, number] | null): void {
    this.stop();
    const ctx = audio();
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const amp = ctx.createGain();
    const t = ctx.currentTime;
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(1, t + 0.003);
    if (loop && loop[1] - loop[0] > 0.01) {
      src.loop = true;
      src.loopStart = loop[0];
      src.loopEnd = loop[1];
      if (from < loop[0] || from >= loop[1]) from = loop[0];
      this.loop = loop;
    } else {
      this.loop = null;
    }
    src.connect(amp).connect(out());
    src.start(t, from);
    src.onended = () => {
      if (this.src === src) {
        this.src = null;
        this.onEnded?.();
      }
    };
    this.src = src;
    this.amp = amp;
    this.startedAt = t;
    this.offset = from;
    this.dur = buf.duration;
  }

  /** Current playhead in seconds. */
  position(): number {
    if (!this.src) return this.offset;
    const p = this.offset + (audio().currentTime - this.startedAt);
    if (this.loop && p >= this.loop[1]) {
      const [a, b] = this.loop;
      return a + ((p - a) % (b - a));
    }
    return Math.min(p, this.dur);
  }

  seek(sec: number): void {
    this.offset = sec;
  }

  stop(): void {
    if (!this.src) return;
    this.offset = this.position();
    const t = audio().currentTime;
    const { src, amp } = this;
    amp!.gain.setTargetAtTime(0, t, 0.005);
    src.stop(t + 0.03);
    this.src = null;
    this.amp = null;
  }
}
