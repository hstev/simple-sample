<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchSameOrigin } from './audio/decode';
  import { installUnlock } from './audio/engine';
  import { installKeyboard } from './input/keyboard';
  import { connectMidi, midiSupported } from './input/midi';
  import { clearTrackParam, trackParam } from './lib/url';
  import { project, type Tab } from './state/project.svelte';
  import ImportScreen from './ui/ImportScreen.svelte';
  import PadGrid from './ui/PadGrid.svelte';
  import PadInspector from './ui/PadInspector.svelte';
  import SliceList from './ui/SliceList.svelte';
  import Transport from './ui/Transport.svelte';
  import Waveform from './ui/Waveform.svelte';

  let confirmClose = $state(false);
  let midiCount = $state<number | null>(null);

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'edit', label: 'Editar', icon: 'M3 12h2l2-7 3 14 3-10 2 6 2-3h4' },
    { id: 'pads', label: 'Pads', icon: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z' },
    { id: 'slices', label: 'Slices', icon: 'M6 3v18M12 3v18M18 3v18M3 8h18' },
  ];

  onMount(() => {
    installUnlock();
    const off = installKeyboard();
    const track = trackParam();
    if (track) {
      project.loading = 'Cargando track descargado…';
      fetchSameOrigin(track)
        .then(({ name, blob }) => project.loadFile(blob, name))
        .catch((e: Error) => {
          project.loading = null;
          project.error = `${e.message} Importa el MP3 manualmente.`;
        })
        .finally(clearTrackParam);
    }
    return off;
  });

  async function midi() {
    try {
      midiCount = await connectMidi();
      project.notify(midiCount ? `MIDI: ${midiCount} dispositivo(s) conectado(s)` : 'No se encontró ningún dispositivo MIDI');
    } catch {
      project.notify('Acceso MIDI denegado');
    }
  }

  async function close() {
    if (!confirmClose) {
      confirmClose = true;
      setTimeout(() => (confirmClose = false), 3000);
      return;
    }
    confirmClose = false;
    await project.closeProject();
  }
</script>

{#if !project.ready}
  <ImportScreen />
{:else}
  <div class="app" data-tab={project.tab}>
    <header>
      <div class="brand">
        <div class="logo" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
        <div class="file">
          <span class="label">Proyecto</span>
          <strong title={project.fileName}>{project.fileName}</strong>
        </div>
      </div>
      <div class="actions">
        {#if midiSupported()}
          <button class="btn ghost" class:on={!!midiCount} onclick={midi} title="Conectar controlador MIDI">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9" /><circle cx="8" cy="11" r="1" fill="currentColor" /><circle cx="16" cy="11" r="1" fill="currentColor" /><circle cx="12" cy="8" r="1" fill="currentColor" /><circle cx="10" cy="15" r="1" fill="currentColor" /><circle cx="14" cy="15" r="1" fill="currentColor" /></svg>
            <span class="hide-sm">MIDI</span>
          </button>
        {/if}
        <button class="btn ghost" onclick={() => project.exportTimeline()} title="Descargar la canción editada (WAV)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16" /></svg>
          <span class="hide-sm">Exportar</span>
        </button>
        <button class="btn" class:danger={confirmClose} onclick={close}>
          {confirmClose ? '¿Seguro?' : 'Nuevo audio'}
        </button>
      </div>
    </header>

    <main class="content">
      <section class="s-wave panel" data-show="edit">
        <div class="wave-box"><Waveform /></div>
        <Transport />
      </section>

      <section class="s-pads panel" data-show="pads">
        <PadGrid />
      </section>

      <section class="s-insp panel" data-show="pads">
        <PadInspector />
      </section>

      <section class="s-slices panel" data-show="slices">
        <SliceList />
      </section>
    </main>

    <nav class="tabs" aria-label="Secciones">
      {#each TABS as t (t.id)}
        <button class:on={project.tab === t.id} onclick={() => (project.tab = t.id)} aria-current={project.tab === t.id}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={t.icon} /></svg>
          {t.label}
        </button>
      {/each}
    </nav>

    {#if project.toast}
      <div class="toast" role="status">{project.toast}</div>
    {/if}
  </div>
{/if}

<style>
  /* ---------- Mobile (default) ---------- */
  .app {
    height: 100dvh;
    display: flex;
    flex-direction: column;
    padding-left: var(--safe-l);
    padding-right: var(--safe-r);
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: calc(10px + var(--safe-t)) 16px 10px;
    border-bottom: 1px solid var(--line);
    background: rgba(11, 11, 16, 0.7);
    backdrop-filter: blur(14px);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }
  .logo {
    width: 34px;
    height: 34px;
    flex: none;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 3px;
    padding: 6px;
    border-radius: 10px;
    background: var(--surface);
    border: 1px solid var(--line);
  }
  .logo span {
    border-radius: 3px;
    background: var(--grad);
  }
  .logo span:nth-child(2),
  .logo span:nth-child(3) {
    opacity: 0.55;
  }
  .file {
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .file strong {
    font-size: 14px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .actions {
    display: flex;
    gap: 4px;
    flex: none;
  }
  .actions svg {
    width: 18px;
    height: 18px;
  }
  .actions .btn.ghost {
    padding: 0 10px;
  }
  .hide-sm {
    display: none;
  }

  .content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .panel {
    padding: 14px;
  }
  .content > section {
    display: none;
  }
  .app[data-tab='edit'] [data-show='edit'],
  .app[data-tab='pads'] [data-show='pads'],
  .app[data-tab='slices'] [data-show='slices'] {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .wave-box {
    height: clamp(200px, 42dvh, 420px);
  }

  .tabs {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    padding: 6px 12px calc(6px + var(--safe-b));
    border-top: 1px solid var(--line);
    background: rgba(11, 11, 16, 0.85);
    backdrop-filter: blur(14px);
  }
  .tabs button {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 6px 0;
    font-size: 11.5px;
    font-weight: 600;
    color: var(--text-3);
    border-radius: 12px;
    transition: color 0.15s;
  }
  .tabs button.on {
    color: var(--text);
  }
  .tabs button.on svg {
    color: var(--accent);
    filter: drop-shadow(0 0 6px rgba(255, 61, 127, 0.6));
  }
  .tabs svg {
    width: 22px;
    height: 22px;
  }

  .toast {
    position: fixed;
    left: 50%;
    bottom: calc(84px + var(--safe-b));
    transform: translateX(-50%);
    padding: 10px 16px;
    border-radius: 999px;
    background: rgba(29, 29, 41, 0.92);
    backdrop-filter: blur(10px);
    border: 1px solid var(--line-2);
    box-shadow: var(--shadow);
    font-size: 13.5px;
    font-weight: 550;
    white-space: nowrap;
    max-width: calc(100vw - 32px);
    overflow: hidden;
    text-overflow: ellipsis;
    animation: rise 0.2s ease-out;
    pointer-events: none;
    z-index: 10;
  }
  @keyframes rise {
    from { opacity: 0; transform: translate(-50%, 8px); }
  }

  @media (min-width: 520px) {
    .hide-sm {
      display: inline;
    }
  }

  /* ---------- Tablet ---------- */
  @media (min-width: 768px) {
    .tabs {
      display: none;
    }
    .toast {
      bottom: 24px;
    }
    .content {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 340px;
      grid-template-areas:
        'wave wave'
        'pads insp'
        'pads slices';
      grid-template-rows: auto auto 1fr;
      align-items: start;
      padding: 16px 20px;
      gap: 16px;
    }
    .content > section {
      display: flex !important;
      flex-direction: column;
      gap: 14px;
    }
    .s-wave { grid-area: wave; }
    .s-pads { grid-area: pads; }
    .s-insp { grid-area: insp; }
    .s-slices { grid-area: slices; }
    .wave-box {
      height: clamp(180px, 28dvh, 300px);
    }
  }

  /* ---------- Desktop ---------- */
  @media (min-width: 1200px) {
    .content {
      overflow: hidden;
      grid-template-columns: 320px minmax(0, 1fr) 320px;
      grid-template-areas:
        'slices wave insp'
        'slices pads insp';
      grid-template-rows: auto minmax(0, 1fr);
      align-items: stretch;
      padding: 20px 24px;
      gap: 20px;
    }
    .s-slices,
    .s-insp {
      overflow-y: auto;
    }
    .s-pads {
      container-type: size;
      min-height: 0;
    }
    .s-pads :global(.grid) {
      max-width: min(100cqw, calc(100cqh - 56px), 620px);
    }
    .wave-box {
      height: clamp(140px, 22dvh, 260px);
    }
  }
</style>
