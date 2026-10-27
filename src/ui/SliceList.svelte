<script lang="ts">
  import { fmtShort } from '../lib/format';
  import { project } from '../state/project.svelte';

  let sensitivity = $state(0.5);
  const target = $derived(project.selection ? 'la selección' : 'toda la canción');
</script>

<section class="slices">
  <div class="chop">
    <span class="label">Auto-chop sobre {target}</span>
    <div class="row">
      {#each [4, 8, 16] as n (n)}
        <button class="btn" onclick={() => project.chopEqual(n)}>÷ {n}</button>
      {/each}
    </div>
    <div class="row onsets">
      <button class="btn primary" onclick={() => project.chopTransients(sensitivity)}>Detectar golpes</button>
      <label>
        <span class="label">Sensibilidad</span>
        <input type="range" min="0" max="1" step="0.05" bind:value={sensitivity} />
      </label>
    </div>
    <p class="hint">Los slices nuevos se asignan a los pads del banco {'ABCD'[project.bank]}.</p>
  </div>

  <div class="listhead">
    <span class="label">Slices ({project.slices.length})</span>
    {#if project.slices.length}
      <button class="btn ghost danger small" onclick={() => project.clearSlices()}>Borrar todos</button>
    {/if}
  </div>

  {#if project.slices.length === 0}
    <p class="empty">Aún no hay slices. Selecciona un trozo y pulsa <b>Crear pad</b>, o usa el auto-chop.</p>
  {:else}
    <ul>
      {#each project.slices as s (s.id)}
        {@const onPad = project.pads[project.selectedPad].slice === s.id}
        <li style:--c={s.color}>
          <button class="play" onpointerdown={() => project.previewSlice(s.id)} aria-label={`Escuchar ${s.name}`}>
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" /></svg>
          </button>
          <input
            class="name"
            value={s.name}
            aria-label="Nombre del slice"
            onchange={(e) => {
              s.name = (e.currentTarget as HTMLInputElement).value || s.name;
              project.scheduleSave();
            }}
          />
          <span class="dur mono">{fmtShort(s.duration)}</span>
          <button
            class="btn small"
            class:on={onPad}
            onclick={() => project.assign(project.selectedPad, s.id)}
            title={`Asignar al pad ${project.padName(project.selectedPad)}`}
          >
            → {project.padName(project.selectedPad)}
          </button>
          <button class="btn icon ghost small" onclick={() => project.exportSlice(s.id)} aria-label="Descargar WAV" title="Descargar WAV">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16" /></svg>
          </button>
          <button class="btn icon ghost small danger" onclick={() => project.removeSlice(s.id)} aria-label="Eliminar slice" title="Eliminar slice">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .slices {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-height: 0;
  }
  .chop {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .onsets {
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: 14px;
  }
  .onsets label {
    display: flex;
    flex-direction: column;
  }
  .hint,
  .empty {
    margin: 0;
    font-size: 12.5px;
    color: var(--text-3);
    line-height: 1.45;
  }
  .empty b {
    color: var(--text-2);
  }
  .listhead {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .small {
    min-height: 32px;
    font-size: 12.5px;
    padding: 0 10px;
  }
  .btn.icon.small {
    width: 32px;
    padding: 0;
  }
  .btn svg {
    width: 16px;
    height: 16px;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    overflow-y: auto;
    min-height: 0;
  }
  li {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px;
    border-radius: 12px;
    background: var(--surface-2);
    border: 1px solid var(--line);
    border-left: 3px solid var(--c);
  }
  .play {
    width: 36px;
    height: 36px;
    flex: none;
    display: grid;
    place-items: center;
    border-radius: 10px;
    background: color-mix(in srgb, var(--c) 18%, transparent);
    color: var(--c);
    touch-action: manipulation;
  }
  .play svg {
    width: 16px;
    height: 16px;
  }
  .name {
    flex: 1;
    min-width: 0;
    font: inherit;
    font-size: 14px;
    font-weight: 550;
    color: var(--text);
    background: transparent;
    border: 1px solid transparent;
    border-radius: 8px;
    padding: 6px;
  }
  .name:hover,
  .name:focus {
    border-color: var(--line-2);
    outline: none;
  }
  .dur {
    font-size: 12px;
    color: var(--text-3);
  }
</style>
