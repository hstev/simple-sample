import { decodeBytes } from '../audio/decode';
import { EditList, mapRange, render, type Segment } from '../audio/edit';
import { computePeaks, type PeaksLevel } from '../audio/peaks';
import { detectOnsets, equalChops, snapZero } from '../audio/slicer';
import { Deck, Sampler, type PadConfig } from '../audio/voice';
import { download, encodeWav } from '../audio/wav';
import { DEFAULT_KEYS, PAD_COLORS, PAD_COUNT, PADS_PER_BANK } from '../lib/format';
import * as storage from './storage';

export interface Slice {
  id: string;
  name: string;
  color: string;
  /** Source ranges in the original audio, so slices survive later edits. */
  segs: Segment[];
  duration: number;
}

export interface Pad extends PadConfig {
  key: string | null; // KeyboardEvent.code
  label: string | null;
}

interface Saved {
  version: 1;
  fileName: string;
  segments: Segment[];
  slices: Slice[];
  pads: Pad[];
  bank: number;
}

export type Tab = 'edit' | 'pads' | 'slices';

function defaultPads(): Pad[] {
  return Array.from({ length: PAD_COUNT }, (_, i) => ({
    slice: null,
    gain: 1,
    pitch: 0,
    mode: 'oneshot',
    choke: 0,
    reverse: false,
    key: DEFAULT_KEYS[i % PADS_PER_BANK].code,
    label: DEFAULT_KEYS[i % PADS_PER_BANK].label,
  }));
}

const uid = () => Math.random().toString(36).slice(2, 9);

class Project {
  // --- audio data (raw: never proxied, read on hot paths) ---
  original = $state.raw<AudioBuffer | null>(null);
  timeline = $state.raw<AudioBuffer | null>(null);
  peaks = $state.raw<PeaksLevel[] | null>(null);
  private edits: EditList | null = null;
  private fileBlob: Blob | null = null;

  // --- project ---
  fileName = $state('');
  slices = $state<Slice[]>([]);
  pads = $state<Pad[]>(defaultPads());
  bank = $state(0);
  segmentsVersion = $state(0); // bumps on every edit, for derived UI
  canUndo = $state(false);
  canRedo = $state(false);

  // --- UI/transport ---
  loading = $state<string | null>(null);
  error = $state<string | null>(null);
  tab = $state<Tab>('pads');
  selectedPad = $state(0);
  learning = $state<number | null>(null);
  selection = $state<{ a: number; b: number } | null>(null); // seconds
  cursor = $state(0); // seconds
  playing = $state(false);
  loop = $state(true);
  hits = $state<number[]>(Array(PAD_COUNT).fill(0)); // bump to flash a pad
  toast = $state<string | null>(null);

  readonly sampler = new Sampler();
  readonly deck = new Deck();
  private saveTimer = 0;
  private toastTimer = 0;

  constructor() {
    this.deck.onEnded = () => {
      this.playing = false;
      this.cursor = this.deck.position();
    };
  }

  get ready(): boolean {
    return this.timeline !== null;
  }
  get duration(): number {
    return this.timeline?.duration ?? 0;
  }
  editSegments(): Segment[] {
    return this.edits?.segments ?? [];
  }
  get sampleRate(): number {
    return this.original?.sampleRate ?? 44100;
  }

  // ---------------------------------------------------------------- loading

  async loadFile(file: Blob, name: string, saved?: Saved): Promise<void> {
    this.loading = 'Decodificando audio…';
    this.error = null;
    try {
      const buf = await decodeBytes(await file.arrayBuffer());
      this.reset();
      this.fileBlob = file;
      this.original = buf;
      this.fileName = name;
      this.edits = new EditList(buf.length, saved?.segments);
      if (saved) {
        this.slices = saved.slices;
        this.pads = saved.pads.length === PAD_COUNT ? saved.pads : defaultPads();
        this.bank = saved.bank;
        for (const s of saved.slices) this.sampler.set(s.id, render(buf, s.segs));
      } else {
        this.slices = [];
        this.pads = defaultPads();
        void storage.set('audio', { name, blob: file });
      }
      await this.rebuild();
      this.tab = saved?.slices.length ? 'pads' : 'edit';
      this.scheduleSave();
    } catch (e) {
      console.error(e);
      this.error = 'No se pudo leer el archivo. ¿Es un audio válido (MP3, WAV, OGG, M4A)?';
    } finally {
      this.loading = null;
    }
  }

  async restore(): Promise<boolean> {
    const audio = await storage.get<{ name: string; blob: Blob }>('audio');
    const saved = await storage.get<Saved>('project');
    if (!audio) return false;
    await this.loadFile(audio.blob, audio.name, saved);
    return this.ready;
  }

  async hasSaved(): Promise<string | null> {
    const audio = await storage.get<{ name: string }>('audio');
    return audio?.name ?? null;
  }

  async closeProject(): Promise<void> {
    this.reset();
    this.original = null;
    this.timeline = null;
    this.peaks = null;
    this.fileName = '';
    this.slices = [];
    this.pads = defaultPads();
    await storage.del('audio');
    await storage.del('project');
  }

  private reset(): void {
    this.deck.stop();
    this.sampler.clear();
    this.playing = false;
    this.selection = null;
    this.cursor = 0;
    this.learning = null;
  }

  private async rebuild(): Promise<void> {
    if (!this.original || !this.edits) return;
    this.timeline = render(this.original, this.edits.segments);
    this.canUndo = this.edits.canUndo;
    this.canRedo = this.edits.canRedo;
    this.segmentsVersion++;
    this.cursor = Math.min(this.cursor, this.duration);
    this.peaks = await computePeaks(this.timeline);
  }

  // ---------------------------------------------------------------- saving

  scheduleSave(): void {
    clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      if (!this.edits) return;
      const data: Saved = {
        version: 1,
        fileName: this.fileName,
        segments: $state.snapshot(this.edits.segments),
        slices: $state.snapshot(this.slices),
        pads: $state.snapshot(this.pads),
        bank: this.bank,
      };
      void storage.set('project', data);
    }, 400);
  }

  notify(msg: string): void {
    this.toast = msg;
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (this.toast = null), 1800);
  }

  // ---------------------------------------------------------------- editing

  private frames(sec: number): number {
    return Math.round(sec * this.sampleRate);
  }

  private async applyEdit(fn: (e: EditList) => boolean, msg: string): Promise<void> {
    if (!this.edits) return;
    this.stop();
    if (!fn(this.edits)) return;
    this.selection = null;
    await this.rebuild();
    this.scheduleSave();
    this.notify(msg);
  }

  deleteSelection(): Promise<void> {
    const s = this.selection;
    if (!s) return Promise.resolve();
    this.cursor = s.a;
    return this.applyEdit((e) => e.remove(this.frames(s.a), this.frames(s.b)), 'Fragmento eliminado');
  }

  cropSelection(): Promise<void> {
    const s = this.selection;
    if (!s) return Promise.resolve();
    this.cursor = 0;
    return this.applyEdit((e) => e.crop(this.frames(s.a), this.frames(s.b)), 'Recortado a la selección');
  }

  undo(): Promise<void> {
    return this.applyEdit((e) => e.undo(), 'Deshecho');
  }
  redo(): Promise<void> {
    return this.applyEdit((e) => e.redo(), 'Rehecho');
  }

  // ---------------------------------------------------------------- transport

  togglePlay(): void {
    if (this.playing) return this.stop();
    if (!this.timeline) return;
    const s = this.selection;
    const loop = s && this.loop ? ([s.a, s.b] as [number, number]) : null;
    const from = s && (this.cursor < s.a || this.cursor >= s.b) ? s.a : this.cursor;
    this.deck.play(this.timeline, from >= this.duration - 0.01 ? 0 : from, loop);
    this.playing = true;
  }

  stop(): void {
    if (!this.playing) return;
    this.deck.stop();
    this.cursor = this.deck.position();
    this.playing = false;
  }

  seek(sec: number): void {
    const wasPlaying = this.playing;
    this.stop();
    this.cursor = Math.max(0, Math.min(sec, this.duration));
    this.deck.seek(this.cursor);
    if (wasPlaying) this.togglePlay();
  }

  // ---------------------------------------------------------------- slices

  private addSlice(a: number, b: number, name?: string): Slice | null {
    if (!this.original || !this.edits || !this.timeline || b - a < 64) return null;
    const segs = mapRange(this.edits.segments, a, b);
    const slice: Slice = {
      id: uid(),
      name: name ?? `Slice ${this.slices.length + 1}`,
      color: PAD_COLORS[this.slices.length % PAD_COLORS.length],
      segs,
      duration: (b - a) / this.sampleRate,
    };
    this.sampler.set(slice.id, render(this.original, segs));
    this.slices.push(slice);
    return slice;
  }

  /** Range to work on: the selection, or the whole timeline. */
  private workRange(): [number, number] {
    const s = this.selection;
    return s ? [this.frames(s.a), this.frames(s.b)] : [0, this.timeline?.length ?? 0];
  }

  sliceFromSelection(): void {
    if (!this.selection || !this.timeline) return;
    const [a, b] = this.workRange();
    const slice = this.addSlice(snapZero(this.timeline, a), snapZero(this.timeline, b));
    if (!slice) return;
    // Assign to the selected pad if it is empty, else to the next free pad.
    const target = this.pads[this.selectedPad].slice ? this.nextFreePad() : this.selectedPad;
    if (target >= 0) this.assign(target, slice.id);
    this.scheduleSave();
    this.notify(target >= 0 ? `Slice → pad ${this.padName(target)}` : 'Slice creado');
  }

  chop(bounds: number[], label: string): void {
    if (!this.timeline || bounds.length < 2) return;
    const tl = this.timeline;
    const snapped = bounds.map((f, i) => (i === 0 || i === bounds.length - 1 ? f : snapZero(tl, f)));
    const base = this.slices.length;
    const created: Slice[] = [];
    for (let i = 0; i < snapped.length - 1; i++) {
      const s = this.addSlice(snapped[i], snapped[i + 1], `${label} ${base + i + 1}`);
      if (s) created.push(s);
    }
    // Fill the current bank starting at pad 1 with the new slices.
    const start = this.bank * PADS_PER_BANK;
    created.slice(0, PADS_PER_BANK).forEach((s, i) => this.assign(start + i, s.id));
    this.scheduleSave();
    this.notify(`${created.length} slices creados en banco ${'ABCD'[this.bank]}`);
  }

  chopEqual(n: number): void {
    const [a, b] = this.workRange();
    this.chop(equalChops(a, b, n), 'Chop');
  }

  chopTransients(sensitivity: number): void {
    if (!this.timeline) return;
    const [a, b] = this.workRange();
    this.chop(detectOnsets(this.timeline, a, b, sensitivity, PADS_PER_BANK), 'Hit');
  }

  removeSlice(id: string): void {
    this.slices = this.slices.filter((s) => s.id !== id);
    this.sampler.delete(id);
    for (const p of this.pads) if (p.slice === id) p.slice = null;
    this.scheduleSave();
  }

  clearSlices(): void {
    for (const s of this.slices) this.sampler.delete(s.id);
    this.slices = [];
    for (const p of this.pads) p.slice = null;
    this.scheduleSave();
  }

  previewSlice(id: string): void {
    // Uses a scratch pad index outside the 64 real pads.
    this.sampler.trigger(PAD_COUNT, { slice: id, gain: 1, pitch: 0, mode: 'oneshot', choke: 0, reverse: false });
  }

  exportSlice(id: string): void {
    const s = this.slices.find((x) => x.id === id);
    const buf = this.sampler.get(id);
    if (s && buf) download(encodeWav(buf), `${s.name}.wav`);
  }

  exportTimeline(): void {
    if (!this.timeline) return;
    const base = this.fileName.replace(/\.[^.]+$/, '') || 'track';
    download(encodeWav(this.timeline), `${base}-editado.wav`);
  }

  sliceById(id: string | null): Slice | undefined {
    return id ? this.slices.find((s) => s.id === id) : undefined;
  }

  // ---------------------------------------------------------------- pads

  padName(i: number): string {
    return `${'ABCD'[Math.floor(i / PADS_PER_BANK)]}${(i % PADS_PER_BANK) + 1}`;
  }

  private nextFreePad(): number {
    const start = this.bank * PADS_PER_BANK;
    for (let i = 0; i < PAD_COUNT; i++) {
      const p = (start + i) % PAD_COUNT;
      if (!this.pads[p].slice) return p;
    }
    return -1;
  }

  assign(pad: number, sliceId: string | null): void {
    this.pads[pad].slice = sliceId;
    this.scheduleSave();
  }

  /** Hot path: start the sound first, then touch reactive UI state. */
  hit(pad: number, velocity = 1): void {
    const cfg = this.pads[pad];
    this.sampler.trigger(pad, cfg, velocity);
    this.hits[pad]++;
  }

  release(pad: number): void {
    this.sampler.release(pad, this.pads[pad]);
  }

  /** Pad for a key: the current bank wins, then any other bank. */
  padForKey(code: string): number {
    const start = this.bank * PADS_PER_BANK;
    for (let i = start; i < start + PADS_PER_BANK; i++) if (this.pads[i].key === code) return i;
    for (let i = 0; i < PAD_COUNT; i++) if (this.pads[i].key === code) return i;
    return -1;
  }

  bindKey(pad: number, code: string, label: string): void {
    // A key drives a single pad per bank; free it elsewhere in the same bank.
    const bank = Math.floor(pad / PADS_PER_BANK);
    for (let i = bank * PADS_PER_BANK; i < (bank + 1) * PADS_PER_BANK; i++) {
      if (i !== pad && this.pads[i].key === code) {
        this.pads[i].key = null;
        this.pads[i].label = null;
      }
    }
    this.pads[pad].key = code;
    this.pads[pad].label = label;
    this.learning = null;
    this.scheduleSave();
    this.notify(`Tecla ${label} → pad ${this.padName(pad)}`);
  }

  updatePad(pad: number, patch: Partial<Pad>): void {
    Object.assign(this.pads[pad], patch);
    this.scheduleSave();
  }
}

export const project = new Project();
