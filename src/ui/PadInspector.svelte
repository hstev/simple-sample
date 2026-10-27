<script lang="ts">
  import type { PadMode } from '../audio/voice';
  import { project } from '../state/project.svelte';

  const i = $derived(project.selectedPad);
  const pad = $derived(project.pads[i]);
  const slice = $derived(project.sliceById(pad.slice));

  const MODES: { v: PadMode; label: string }[] = [
    { v: 'oneshot', label: 'One-shot' },
    { v: 'gate', label: 'Gate' },
    { v: 'loop', label: 'Loop' },
  ];
</script>

<section class="inspector">
  <header>
    <div class="title">
      <span class="dot" style:background={slice?.color ?? 'var(--surface-3)'}></span>
      <div>
        <span class="label">Pad {project.padName(i)}</span>
        <strong>{slice?.name ?? 'Vacío'}</strong>
      </div>
    </div>
    <button class="btn icon ghost" onclick={() => project.hit(i)} disabled={!slice} aria-label="Probar pad">
      <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" /></svg>
    </button>
  </header>

  <label class="field">
    <span class="label">Sonido</span>
    <select value={pad.slice ?? ''} onchange={(e) => project.assign(i, (e.currentTarget as HTMLSelectElement).value || null)}>
      <option value="">— Sin sonido —</option>
      {#each project.slices as s (s.id)}
        <option value={s.id}>{s.name}</option>
      {/each}
    </select>
  </label>

  <div class="field">
    <span class="label">Tecla</span>
    <div class="keyrow">
      <kbd class:none={!pad.label}>{pad.label ?? '—'}</kbd>
      <button
        class="btn"
        class:on={project.learning === i}
        onclick={() => (project.learning = project.learning === i ? null : i)}
      >
        {project.learning === i ? 'Pulsa una tecla…' : 'Asignar tecla'}
      </button>
      {#if pad.key}
        <button class="btn ghost" onclick={() => project.updatePad(i, { key: null, label: null })}>Quitar</button>
      {/if}
    </div>
  </div>

  <div class="field">
    <span class="label">Modo</span>
    <div class="seg full">
      {#each MODES as m (m.v)}
        <button class:on={pad.mode === m.v} onclick={() => project.updatePad(i, { mode: m.v })}>{m.label}</button>
      {/each}
    </div>
  </div>

  <label class="field">
    <span class="label">Volumen <em class="mono">{Math.round(pad.gain * 100)}%</em></span>
    <input type="range" min="0" max="1.5" step="0.01" value={pad.gain}
      oninput={(e) => project.updatePad(i, { gain: +(e.currentTarget as HTMLInputElement).value })} />
  </label>

  <label class="field">
    <span class="label">Tono <em class="mono">{pad.pitch > 0 ? '+' : ''}{pad.pitch} st</em></span>
    <input type="range" min="-12" max="12" step="1" value={pad.pitch}
      oninput={(e) => project.updatePad(i, { pitch: +(e.currentTarget as HTMLInputElement).value })} />
  </label>

  <div class="two">
    <div class="field">
      <span class="label">Grupo choke</span>
      <div class="seg full">
        {#each [0, 1, 2, 3, 4] as c (c)}
          <button class:on={pad.choke === c} onclick={() => project.updatePad(i, { choke: c })}>{c || '—'}</button>
        {/each}
      </div>
    </div>
    <div class="field">
      <span class="label">Reversa</span>
      <button class="btn" class:on={pad.reverse} onclick={() => project.updatePad(i, { reverse: !pad.reverse })} aria-pressed={pad.reverse}>
        {pad.reverse ? 'Activada' : 'Desactivada'}
      </button>
    </div>
  </div>
</section>

<style>
  .inspector {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .title {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }
  .title strong {
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex: none;
    box-shadow: 0 0 10px currentColor;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .field .label {
    display: flex;
    justify-content: space-between;
  }
  .field em {
    font-style: normal;
    color: var(--text-2);
    text-transform: none;
    letter-spacing: 0;
  }
  .keyrow {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  kbd {
    min-width: 44px;
    height: 40px;
    display: grid;
    place-items: center;
    padding: 0 10px;
    border-radius: 10px;
    font-family: var(--mono);
    font-weight: 700;
    background: var(--bg);
    border: 1px solid var(--line-2);
    box-shadow: inset 0 -2px 0 rgba(255, 255, 255, 0.05);
  }
  kbd.none {
    color: var(--text-3);
  }
  .seg.full {
    display: flex;
  }
  .seg.full button {
    flex: 1;
    min-width: 0;
  }
  .two {
    display: grid;
    grid-template-columns: 1.4fr 1fr;
    gap: 12px;
  }
</style>
