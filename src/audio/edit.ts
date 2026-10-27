import { audio } from './engine';

/** A range of the original buffer, in sample frames: [start, end). */
export interface Segment {
  start: number;
  end: number;
}

const MAX_HISTORY = 100;

function len(segs: Segment[]): number {
  let n = 0;
  for (const s of segs) n += s.end - s.start;
  return n;
}

/** Returns the original-buffer segments covering timeline range [a, b). */
export function mapRange(segs: Segment[], a: number, b: number): Segment[] {
  const out: Segment[] = [];
  let pos = 0;
  for (const s of segs) {
    const l = s.end - s.start;
    const lo = Math.max(a, pos);
    const hi = Math.min(b, pos + l);
    if (hi > lo) out.push({ start: s.start + lo - pos, end: s.start + hi - pos });
    pos += l;
    if (pos >= b) break;
  }
  return out;
}

/** Timeline position of an original-buffer frame, or -1 if it was deleted. */
export function originalToTimeline(segs: Segment[], frame: number): number {
  let pos = 0;
  for (const s of segs) {
    if (frame >= s.start && frame < s.end) return pos + frame - s.start;
    pos += s.end - s.start;
  }
  return -1;
}

/** Concatenates original-buffer segments into a fresh AudioBuffer. */
export function render(src: AudioBuffer, segs: Segment[]): AudioBuffer {
  const frames = Math.max(1, len(segs));
  const buf = audio().createBuffer(src.numberOfChannels, frames, src.sampleRate);
  for (let ch = 0; ch < src.numberOfChannels; ch++) {
    const from = src.getChannelData(ch);
    const to = buf.getChannelData(ch);
    let pos = 0;
    for (const s of segs) {
      to.set(from.subarray(s.start, s.end), pos);
      pos += s.end - s.start;
    }
  }
  return buf;
}

/**
 * Non-destructive edit list over the original audio. Deletes/crops only
 * rewrite the segment list, so undo/redo are cheap snapshot swaps.
 */
export class EditList {
  segments: Segment[];
  private undoStack: Segment[][] = [];
  private redoStack: Segment[][] = [];

  constructor(frames: number, segments?: Segment[]) {
    this.segments = segments?.length ? segments : [{ start: 0, end: frames }];
  }

  get length(): number {
    return len(this.segments);
  }
  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }
  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  private commit(next: Segment[]): void {
    this.undoStack.push(this.segments);
    if (this.undoStack.length > MAX_HISTORY) this.undoStack.shift();
    this.redoStack = [];
    this.segments = next;
  }

  /** Removes timeline range [a, b). Refuses to delete everything. */
  remove(a: number, b: number): boolean {
    const total = this.length;
    if (b <= a || (a <= 0 && b >= total)) return false;
    this.commit([...mapRange(this.segments, 0, a), ...mapRange(this.segments, b, total)]);
    return true;
  }

  /** Keeps only timeline range [a, b). */
  crop(a: number, b: number): boolean {
    if (b <= a) return false;
    this.commit(mapRange(this.segments, a, b));
    return true;
  }

  undo(): boolean {
    const prev = this.undoStack.pop();
    if (!prev) return false;
    this.redoStack.push(this.segments);
    this.segments = prev;
    return true;
  }

  redo(): boolean {
    const next = this.redoStack.pop();
    if (!next) return false;
    this.undoStack.push(this.segments);
    this.segments = next;
    return true;
  }
}
