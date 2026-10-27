<script lang="ts">
  import { BANKS, PADS_PER_BANK } from '../lib/format';
  import { project } from '../state/project.svelte';

  // MPC layout: pad 1 bottom-left, pad 16 top-right.
  const ORDER = [12, 13, 14, 15, 8, 9, 10, 11, 4, 5, 6, 7, 0, 1, 2, 3];

  const base = $derived(project.bank * PADS_PER_BANK);
  const els: HTMLElement[] = [];
  const seen: number[] = [];
  const active = new Map<number, number>(); // pointerId → pad

  // Flash pads hit from any source (touch, keyboard, MIDI).
  $effect(() => {
    for (let s = 0; s < PADS_PER_BANK; s++) {
      const i = base + s;
      const n = project.hits[i];
      if (seen[i] !== undefined && n !== seen[i]) {
        const color = project.sliceById(project.pads[i].slice)?.color ?? '#ffffff';
        els[s]?.animate(
          [
            { boxShadow: `0 0 0 2px ${color}, 0 0 32px ${color}`, filter: 'brightness(1.6)', transform: 'scale(0.96)' },
            { boxShadow: `0 0 0 0 transparent, 0 0 0 transparent`, filter: 'brightness(1)', transform: 'scale(1)' },
          ],
          { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' },
        );
      }
      seen[i] = n;
    }
  });

  function padAt(e: PointerEvent): number {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-pad]');
    return el ? Number(el.dataset.pad) : -1;
  }

  function down(e: PointerEvent) {
    const pad = padAt(e);
    if (pad < 0) return;
    e.preventDefault();
    // Sound first; UI state afterwards.
    project.hit(pad, 1);
    active.set(e.pointerId, pad);
    if (project.learning !== null) project.learning = pad;
    project.selectedPad = pad;
  }

  function up(e: PointerEvent) {
    const pad = active.get(e.pointerId);
    if (pad === undefined) return;
    active.delete(e.pointerId);
    project.release(pad);
  }
</script>

<div class="pads">
  <div class="head">
    <div class="seg" role="tablist" aria-label="Banco de pads">
      {#each BANKS as b, i (b)}
        <button role="tab" aria-selected={project.bank === i} class:on={project.bank === i} onclick={() => (project.bank = i)}>
          {b}
        </button>
      {/each}
    </div>
    {#if project.learning !== null}
      <span class="learn">Pulsa una tecla para el pad {project.padName(project.learning)} · Esc cancela</span>
    {/if}
  </div>

  <div
    class="grid"
    role="group"
    aria-label="Pads"
    onpointerdown={down}
    onpointerup={up}
    onpointercancel={up}
    onpointerleave={up}
    oncontextmenu={(e) => e.preventDefault()}
  >
    {#each ORDER as s (s)}
      {@const i = base + s}
      {@const pad = project.pads[i]}
      {@const slice = project.sliceById(pad.slice)}
      <div
        class="pad"
        class:empty={!slice}
        class:selected={project.selectedPad === i}
        class:learning={project.learning === i}
        style:--c={slice?.color ?? 'transparent'}
        data-pad={i}
        bind:this={els[s]}
        role="button"
        tabindex="-1"
        aria-label={`Pad ${project.padName(i)}${slice ? `: ${slice.name}` : ' vacío'}`}
      >
        <span class="num">{project.padName(i)}</span>
        {#if pad.label}<kbd>{pad.label}</kbd>{/if}
        <span class="name">{slice?.name ?? ''}</span>
        <span class="flags">
          {#if pad.mode !== 'oneshot'}<i>{pad.mode === 'loop' ? 'LOOP' : 'GATE'}</i>{/if}
          {#if pad.reverse}<i>REV</i>{/if}
          {#if pad.pitch}<i>{pad.pitch > 0 ? '+' : ''}{pad.pitch}</i>{/if}
          {#if pad.choke}<i>C{pad.choke}</i>{/if}
        </span>
      </div>
    {/each}
  </div>
</div>

<style>
  .pads {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  .learn {
    font-size: 12.5px;
    color: var(--accent);
    animation: blink 1s infinite;
  }
  @keyframes blink {
    50% { opacity: 0.5; }
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: clamp(6px, 1.6vw, 12px);
    width: 100%;
    max-width: min(100%, 560px);
    margin: 0 auto;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }
  .pad {
    position: relative;
    aspect-ratio: 1;
    border-radius: clamp(10px, 2vw, 16px);
    background:
      linear-gradient(160deg, rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0) 40%),
      linear-gradient(180deg, #23232f, #181822);
    border: 1px solid var(--line-2);
    box-shadow:
      inset 0 -3px 0 rgba(0, 0, 0, 0.35),
      inset 0 0 0 1px rgba(255, 255, 255, 0.02);
    cursor: pointer;
    overflow: hidden;
    padding: clamp(5px, 1.4vw, 10px);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .pad::before {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 3px;
    background: var(--c);
    box-shadow: 0 0 12px var(--c);
  }
  .pad:not(.empty) {
    background:
      radial-gradient(120% 90% at 50% 120%, color-mix(in srgb, var(--c) 22%, transparent), transparent 70%),
      linear-gradient(160deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0) 40%),
      linear-gradient(180deg, #262633, #1a1a24);
  }
  .pad.empty {
    opacity: 0.55;
  }
  .pad.selected {
    border-color: rgba(255, 255, 255, 0.45);
  }
  .pad.learning {
    border-color: var(--accent);
    animation: blink 1s infinite;
  }
  .num {
    font-size: clamp(10px, 2.4vw, 12px);
    font-weight: 700;
    color: var(--text-3);
  }
  kbd {
    position: absolute;
    top: clamp(5px, 1.4vw, 10px);
    right: clamp(5px, 1.4vw, 10px);
    font-family: var(--mono);
    font-size: clamp(9px, 2.2vw, 11px);
    padding: 1px 5px;
    border-radius: 5px;
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid var(--line-2);
    color: var(--text-2);
  }
  .name {
    font-size: clamp(10px, 2.6vw, 13px);
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .flags {
    display: flex;
    gap: 3px;
    flex-wrap: wrap;
    min-height: 0;
  }
  .flags i {
    font-style: normal;
    font-size: 9px;
    font-weight: 700;
    padding: 0 4px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.08);
    color: var(--text-2);
  }
  @media (max-width: 380px) {
    .flags { display: none; }
  }
</style>
