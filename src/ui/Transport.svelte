<script lang="ts">
  import { fmtShort, fmtTime } from '../lib/format';
  import { project } from '../state/project.svelte';

  const sel = $derived(project.selection);
</script>

<div class="transport">
  <div class="row">
    <button class="btn primary play" onclick={() => project.togglePlay()} aria-label={project.playing ? 'Pausar' : 'Reproducir'}>
      {#if project.playing}
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
      {:else}
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" /></svg>
      {/if}
    </button>
    <button class="btn icon" class:on={project.loop} onclick={() => (project.loop = !project.loop)} aria-pressed={project.loop} title="Repetir selección" aria-label="Repetir selección">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M17 2l4 4-4 4" /><path d="M3 11V9a3 3 0 0 1 3-3h15" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v2a3 3 0 0 1-3 3H3" /></svg>
    </button>

    <div class="time mono">
      <strong>{fmtTime(project.cursor)}</strong>
      <span>/ {fmtTime(project.duration)}</span>
      {#if sel}<em>sel {fmtShort(sel.b - sel.a)}</em>{/if}
    </div>

    <div class="history">
      <button class="btn icon ghost" disabled={!project.canUndo} onclick={() => project.undo()} title="Deshacer (Ctrl+Z)" aria-label="Deshacer">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>
      </button>
      <button class="btn icon ghost" disabled={!project.canRedo} onclick={() => project.redo()} title="Rehacer (Ctrl+Shift+Z)" aria-label="Rehacer">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m15 14 5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" /></svg>
      </button>
    </div>
  </div>

  <div class="tools">
    <button class="btn" disabled={!sel} onclick={() => project.sliceFromSelection()}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><path d="M17.5 14v7M14 17.5h7" /></svg>
      Crear pad
    </button>
    <button class="btn" disabled={!sel} onclick={() => project.cropSelection()} title="Quedarse solo con la selección">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 2v14a2 2 0 0 0 2 2h14" /><path d="M18 22V8a2 2 0 0 0-2-2H2" /></svg>
      Recortar
    </button>
    <button class="btn danger" disabled={!sel} onclick={() => project.deleteSelection()} title="Eliminar selección (Supr)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12" /></svg>
      Eliminar
    </button>
  </div>
  {#if !sel}
    <p class="hint">Arrastra sobre la onda para seleccionar un trozo. Pellizca o usa la rueda para hacer zoom.</p>
  {/if}
</div>

<style>
  .transport {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .play {
    width: 48px;
    height: 48px;
    padding: 0;
    border-radius: 50%;
  }
  .play svg {
    width: 22px;
    height: 22px;
  }
  .btn svg {
    width: 18px;
    height: 18px;
    flex: none;
  }
  .time {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 2px 6px;
    font-size: 13px;
    color: var(--text-3);
  }
  .time strong {
    color: var(--text);
    font-size: 17px;
    font-weight: 600;
  }
  .time em {
    font-style: normal;
    color: var(--accent);
  }
  .history {
    display: flex;
  }
  .tools {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .tools .btn {
    padding: 0 8px;
    font-size: 13px;
  }
  .hint {
    margin: 0;
    font-size: 12.5px;
    color: var(--text-3);
    line-height: 1.4;
  }
</style>
