<script lang="ts">
  import { onMount } from 'svelte';
  import { originalToTimeline } from '../audio/edit';
  import { fmtTime } from '../lib/format';
  import { project } from '../state/project.svelte';

  let { compact = false }: { compact?: boolean } = $props();

  let wrap: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let overview = $state<HTMLCanvasElement>();
  let W = $state(0);
  let H = $state(0);
  let view = $state({ start: 0, end: 1 }); // visible range, seconds

  const MIN_SPAN = 0.05;
  const EDGE_PX = 16;

  // ------------------------------------------------------------ view helpers

  function clampView(start: number, span: number) {
    const d = project.duration || 1;
    span = Math.max(MIN_SPAN, Math.min(d, span));
    start = Math.max(0, Math.min(d - span, start));
    view = { start, end: start + span };
  }

  const span = () => view.end - view.start;
  const xToT = (x: number) => view.start + (x / W) * span();
  const tToX = (t: number) => ((t - view.start) / span()) * W;

  export function zoom(factor: number, anchorX = W / 2) {
    const t = xToT(anchorX);
    const s = span() * factor;
    clampView(t - (anchorX / W) * s, s);
  }

  export function fit() {
    clampView(0, project.duration);
  }

  // Reset the view when the timeline changes length (new file or edit).
  let lastDuration = 0;
  $effect(() => {
    const d = project.duration;
    if (d !== lastDuration) {
      if (lastDuration === 0 || view.end > d) clampView(0, d);
      lastDuration = d;
    }
  });

  // ------------------------------------------------------------ drawing

  let raf = 0;
  function requestDraw() {
    if (!raf) raf = requestAnimationFrame(draw);
  }

  // Slice start markers mapped onto the current (edited) timeline.
  const markers = $derived.by(() => {
    void project.segmentsVersion;
    const segs = project.editSegments();
    return project.slices
      .map((s) => ({ s, f: originalToTimeline(segs, s.segs[0]?.start ?? -1) }))
      .filter((m) => m.f >= 0)
      .map((m) => ({ t: m.f / project.sampleRate, color: m.s.color, d: m.s.duration }));
  });

  $effect(() => {
    // Redraw whenever anything visual changes.
    void [project.peaks, project.selection, project.cursor, view.start, view.end, W, H, markers];
    requestDraw();
  });

  function columnPeaks(x0: number, x1: number): [number, number] {
    const levels = project.peaks;
    const tl = project.timeline;
    if (!levels || !tl) return [0, 0];
    const sr = tl.sampleRate;
    const a = Math.max(0, Math.floor(xToT(x0) * sr));
    const b = Math.min(tl.length, Math.ceil(xToT(x1) * sr));
    if (b <= a) return [0, 0];
    const spp = b - a;
    if (spp < levels[0].spb * 2) {
      // Deep zoom: read raw samples (channel 0 is enough at this scale).
      const d = tl.getChannelData(0);
      let lo = 1,
        hi = -1;
      for (let i = a; i < b; i++) {
        const v = d[i];
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      return [lo, hi];
    }
    let lvl = levels[0];
    for (const l of levels) if (l.spb * 2 <= spp) lvl = l;
    const i0 = Math.floor(a / lvl.spb);
    const i1 = Math.min(lvl.min.length, Math.ceil(b / lvl.spb));
    let lo = 1,
      hi = -1;
    for (let i = i0; i < i1; i++) {
      if (lvl.min[i] < lo) lo = lvl.min[i];
      if (lvl.max[i] > hi) hi = lvl.max[i];
    }
    return lo > hi ? [0, 0] : [lo, hi];
  }

  function draw() {
    raf = 0;
    if (!canvas || !W || !H) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    }
    const g = canvas.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);

    const ruler = compact ? 0 : 18;
    const top = ruler;
    const h = H - ruler;
    const mid = top + h / 2;
    const sel = project.selection;

    // Ruler + grid
    if (ruler) {
      const s = span();
      const steps = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60];
      const step = steps.find((st) => (st / s) * W >= 70) ?? 60;
      g.font = '10px ui-monospace, monospace';
      g.textBaseline = 'middle';
      for (let t = Math.ceil(view.start / step) * step; t < view.end; t += step) {
        const x = Math.round(tToX(t)) + 0.5;
        g.fillStyle = 'rgba(255,255,255,0.04)';
        g.fillRect(x, top, 1, h);
        g.fillStyle = 'rgba(255,255,255,0.35)';
        g.fillRect(x, ruler - 5, 1, 5);
        g.fillText(step < 1 ? fmtTime(t) : fmtTime(t).slice(0, -3), x + 4, ruler / 2);
      }
    }

    // Selection background
    if (sel) {
      const xa = tToX(sel.a);
      const xb = tToX(sel.b);
      g.fillStyle = 'rgba(255, 61, 127, 0.12)';
      g.fillRect(xa, top, xb - xa, h);
    }

    // Center line
    g.fillStyle = 'rgba(255,255,255,0.06)';
    g.fillRect(0, mid, W, 1);

    // Waveform
    const amp = (h / 2) * 0.92;
    const bar = 1;
    const xa = sel ? tToX(sel.a) : -1;
    const xb = sel ? tToX(sel.b) : -1;
    const grad = g.createLinearGradient(0, top, 0, top + h);
    grad.addColorStop(0, '#a99bff');
    grad.addColorStop(0.5, '#7c7cff');
    grad.addColorStop(1, '#a99bff');
    const gradSel = g.createLinearGradient(0, top, 0, top + h);
    gradSel.addColorStop(0, '#ff7aa8');
    gradSel.addColorStop(0.5, '#ff3d7f');
    gradSel.addColorStop(1, '#ff7aa8');
    for (let x = 0; x < W; x += bar) {
      const [lo, hi] = columnPeaks(x, x + bar);
      const y0 = mid - hi * amp;
      const y1 = mid - lo * amp;
      g.fillStyle = x >= xa && x < xb ? gradSel : grad;
      g.fillRect(x, y0, bar, Math.max(1, y1 - y0));
    }

    // Slice markers
    for (const m of markers) {
      const x = tToX(m.t);
      if (x < -2 || x > W + 2) continue;
      g.fillStyle = m.color;
      g.globalAlpha = 0.9;
      g.fillRect(Math.round(x), top, 1.5, h);
      g.beginPath();
      g.moveTo(x, top);
      g.lineTo(x + 7, top);
      g.lineTo(x, top + 7);
      g.fill();
      g.globalAlpha = 1;
    }

    // Selection edges
    if (sel) {
      g.fillStyle = '#ff3d7f';
      for (const x of [xa, xb]) {
        g.fillRect(x - 1, top, 2, h);
        g.beginPath();
        g.roundRect(x - 5, mid - 14, 10, 28, 4);
        g.fill();
      }
    }

    // Playhead
    const pt = project.playing ? project.deck.position() : project.cursor;
    const px = tToX(pt);
    if (px >= 0 && px <= W) {
      g.fillStyle = '#fff';
      g.fillRect(Math.round(px) - 0.5, 0, 1.5, H);
      g.beginPath();
      g.moveTo(px - 5, 0);
      g.lineTo(px + 5, 0);
      g.lineTo(px, 6);
      g.fill();
    }

    drawOverview(pt);

    if (project.playing) {
      // Follow the playhead page by page.
      if (!dragging && (pt > view.end || pt < view.start)) clampView(pt - span() * 0.05, span());
      requestDraw();
    }
  }

  function drawOverview(pt: number) {
    if (!overview || compact) return;
    const ow = W;
    const oh = 28;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (overview.width !== Math.round(ow * dpr)) {
      overview.width = Math.round(ow * dpr);
      overview.height = Math.round(oh * dpr);
    }
    const g = overview.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, ow, oh);
    const levels = project.peaks;
    const d = project.duration;
    if (!levels || !d) return;
    const lvl = levels[levels.length - 1].min.length >= ow ? levels[levels.length - 1] : levels[0];
    const per = lvl.min.length / ow;
    g.fillStyle = 'rgba(169,155,255,0.45)';
    for (let x = 0; x < ow; x++) {
      let lo = 1,
        hi = -1;
      const i1 = Math.min(lvl.min.length, Math.ceil((x + 1) * per));
      for (let i = Math.floor(x * per); i < i1; i++) {
        if (lvl.min[i] < lo) lo = lvl.min[i];
        if (lvl.max[i] > hi) hi = lvl.max[i];
      }
      if (lo > hi) continue;
      g.fillRect(x, oh / 2 - hi * (oh / 2), 1, Math.max(1, (hi - lo) * (oh / 2)));
    }
    const vx = (view.start / d) * ow;
    const vw = Math.max(6, ((view.end - view.start) / d) * ow);
    g.fillStyle = 'rgba(255,255,255,0.08)';
    g.fillRect(vx, 0, vw, oh);
    g.strokeStyle = 'rgba(255,255,255,0.5)';
    g.lineWidth = 1;
    g.strokeRect(vx + 0.5, 0.5, vw - 1, oh - 1);
    g.fillStyle = '#fff';
    g.fillRect((pt / d) * ow, 0, 1, oh);
  }

  $effect(() => {
    if (project.playing) requestDraw();
  });

  // ------------------------------------------------------------ interaction

  type Mode =
    | { kind: 'select'; x0: number; t0: number; moved: boolean }
    | { kind: 'edge'; fixed: number }
    | { kind: 'pinch'; d0: number; span0: number; tMid: number }
    | null;

  const pointers = new Map<number, { x: number; y: number }>();
  let mode: Mode = null;
  let dragging = false;

  function localX(e: PointerEvent) {
    const r = canvas.getBoundingClientRect();
    return e.clientX - r.left;
  }

  function pinchInfo() {
    const [p, q] = [...pointers.values()];
    return { d: Math.max(10, Math.abs(p.x - q.x)), mid: (p.x + q.x) / 2 };
  }

  function onDown(e: PointerEvent) {
    canvas.setPointerCapture(e.pointerId);
    const x = localX(e);
    pointers.set(e.pointerId, { x, y: e.clientY });
    dragging = true;

    if (pointers.size === 2) {
      const { d, mid } = pinchInfo();
      // Second finger: abandon a fresh selection, switch to pinch.
      if (mode?.kind === 'select' && !mode.moved) project.selection = null;
      mode = { kind: 'pinch', d0: d, span0: span(), tMid: xToT(mid) };
      return;
    }
    if (pointers.size > 2) return;

    const sel = project.selection;
    if (sel) {
      const xa = tToX(sel.a);
      const xb = tToX(sel.b);
      if (Math.abs(x - xa) <= EDGE_PX) return void (mode = { kind: 'edge', fixed: sel.b });
      if (Math.abs(x - xb) <= EDGE_PX) return void (mode = { kind: 'edge', fixed: sel.a });
    }
    mode = { kind: 'select', x0: x, t0: xToT(x), moved: false };
  }

  function onMove(e: PointerEvent) {
    if (!pointers.has(e.pointerId)) return;
    const x = localX(e);
    pointers.set(e.pointerId, { x, y: e.clientY });
    if (!mode) return;
    const d = project.duration;
    const t = Math.max(0, Math.min(d, xToT(x)));

    if (mode.kind === 'pinch' && pointers.size === 2) {
      const { d: dist, mid } = pinchInfo();
      const s = mode.span0 * (mode.d0 / dist);
      const clamped = Math.max(MIN_SPAN, Math.min(d, s));
      clampView(mode.tMid - (mid / W) * clamped, clamped);
    } else if (mode.kind === 'select') {
      if (!mode.moved && Math.abs(x - mode.x0) < 5) return;
      mode.moved = true;
      project.selection = { a: Math.min(mode.t0, t), b: Math.max(mode.t0, t) };
    } else if (mode.kind === 'edge') {
      project.selection = { a: Math.min(mode.fixed, t), b: Math.max(mode.fixed, t) };
    }
  }

  function onUp(e: PointerEvent) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (mode?.kind === 'select' && !mode.moved && pointers.size === 0) {
      // Tap: move the cursor, drop the selection.
      project.selection = null;
      project.seek(mode.t0);
    }
    const sel = project.selection;
    if (sel && sel.b - sel.a < 0.01) project.selection = null;
    if (pointers.size === 0) {
      mode = null;
      dragging = false;
    } else if (mode?.kind === 'pinch') {
      mode = null; // lifting one finger of a pinch ends it
    }
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const x = e.clientX - canvas.getBoundingClientRect().left;
    if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      const dx = e.shiftKey ? e.deltaY : e.deltaX;
      clampView(view.start + (dx / W) * span(), span());
    } else {
      zoom(Math.exp(e.deltaY * 0.002), x);
    }
  }

  let ovDrag = false;
  function overviewTo(e: PointerEvent) {
    const r = overview!.getBoundingClientRect();
    const t = ((e.clientX - r.left) / r.width) * project.duration;
    clampView(t - span() / 2, span());
  }

  onMount(() => {
    const ro = new ResizeObserver(([entry]) => {
      W = Math.floor(entry.contentRect.width);
      H = Math.floor(entry.contentRect.height);
    });
    ro.observe(wrap);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  });
</script>

<div class="wave" class:compact>
  <div class="area" bind:this={wrap}>
    <canvas
      bind:this={canvas}
      onpointerdown={onDown}
      onpointermove={onMove}
      onpointerup={onUp}
      onpointercancel={onUp}
      aria-label="Forma de onda: arrastra para seleccionar, pellizca para hacer zoom"
    ></canvas>
    {#if !project.peaks}
      <div class="loading">Analizando…</div>
    {/if}
    {#if !compact}
      <div class="zoom">
        <button class="btn icon ghost" onclick={() => zoom(0.5)} aria-label="Acercar">+</button>
        <button class="btn icon ghost" onclick={() => zoom(2)} aria-label="Alejar">−</button>
        <button class="btn icon ghost" onclick={fit} aria-label="Ver todo">⤢</button>
      </div>
    {/if}
  </div>
  {#if !compact}
    <canvas
      class="overview"
      bind:this={overview}
      onpointerdown={(e) => {
        ovDrag = true;
        overview!.setPointerCapture(e.pointerId);
        overviewTo(e);
      }}
      onpointermove={(e) => ovDrag && overviewTo(e)}
      onpointerup={() => (ovDrag = false)}
      onpointercancel={() => (ovDrag = false)}
      aria-label="Vista general: arrastra para desplazarte"
    ></canvas>
  {/if}
</div>

<style>
  .wave {
    display: flex;
    flex-direction: column;
    gap: 8px;
    height: 100%;
    min-height: 0;
  }
  .area {
    position: relative;
    flex: 1;
    min-height: 0;
    border-radius: var(--radius-sm);
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid var(--line);
    overflow: hidden;
  }
  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    touch-action: none;
    cursor: crosshair;
    display: block;
  }
  .overview {
    position: static;
    height: 28px;
    flex: none;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid var(--line);
    cursor: grab;
  }
  .loading {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    color: var(--text-3);
    font-size: 13px;
    pointer-events: none;
  }
  .zoom {
    position: absolute;
    right: 6px;
    bottom: 6px;
    display: flex;
    gap: 2px;
    padding: 2px;
    border-radius: 12px;
    background: rgba(11, 11, 16, 0.75);
    backdrop-filter: blur(8px);
    border: 1px solid var(--line);
  }
  .zoom .btn {
    min-height: 32px;
    width: 32px;
    font-size: 16px;
  }
</style>
