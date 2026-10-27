<script lang="ts">
  import { onMount } from 'svelte';
  import { project } from '../state/project.svelte';

  let dragging = $state(false);
  let saved = $state<string | null>(null);
  let input: HTMLInputElement;

  onMount(async () => {
    saved = await project.hasSaved();
  });

  function pick(files: FileList | null | undefined) {
    const f = files?.[0];
    if (!f) return;
    if (f.type && !f.type.startsWith('audio/') && !/\.(mp3|wav|ogg|m4a|aac|flac|webm|opus)$/i.test(f.name)) {
      project.error = 'Ese archivo no parece un audio. Importa un MP3 (o WAV, OGG, M4A…).';
      return;
    }
    void project.loadFile(f, f.name);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragging = false;
    pick(e.dataTransfer?.files);
  }
</script>

<main class="screen">
  <div class="brand">
    <div class="logo" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
    <h1>Simple Sample</h1>
    <p>Corta tu canción, asigna los trozos a pads y tócala como en una MPC.</p>
  </div>

  <div
    class="drop"
    class:dragging
    class:busy={!!project.loading}
    role="button"
    tabindex="0"
    aria-label="Importar archivo de audio"
    ondragover={(e) => {
      e.preventDefault();
      dragging = true;
    }}
    ondragleave={() => (dragging = false)}
    ondrop={onDrop}
    onclick={() => !project.loading && input.click()}
    onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && input.click()}
  >
    {#if project.loading}
      <div class="spinner" aria-hidden="true"></div>
      <strong>{project.loading}</strong>
      <span>Esto solo tarda unos segundos.</span>
    {:else}
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
        <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
      </svg>
      <strong>Importa un MP3 para empezar</strong>
      <span class="hint-desktop">Arrastra el archivo aquí o</span>
      <span class="btn primary">Elegir archivo</span>
      <small>MP3 · WAV · OGG · M4A — todo se procesa en tu dispositivo</small>
    {/if}
  </div>

  <input
    bind:this={input}
    type="file"
    accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac"
    hidden
    onchange={(e) => pick((e.currentTarget as HTMLInputElement).files)}
  />

  {#if project.error}
    <p class="error" role="alert">{project.error}</p>
  {/if}

  {#if saved && !project.loading}
    <button class="resume panel" onclick={() => project.restore()}>
      <span class="label">Continuar proyecto</span>
      <strong>{saved}</strong>
      <span aria-hidden="true">→</span>
    </button>
  {/if}
</main>

<style>
  .screen {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 22px;
    padding: calc(24px + var(--safe-t)) 16px calc(24px + var(--safe-b));
  }
  .brand {
    text-align: center;
    max-width: 420px;
  }
  .logo {
    width: 64px;
    height: 64px;
    margin: 0 auto 14px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    padding: 10px;
    border-radius: 18px;
    background: var(--surface);
    border: 1px solid var(--line);
    box-shadow: var(--shadow);
  }
  .logo span {
    border-radius: 6px;
    background: var(--grad);
    animation: pulse 2.4s infinite ease-in-out;
  }
  .logo span:nth-child(2) {
    animation-delay: 0.3s;
    opacity: 0.6;
  }
  .logo span:nth-child(3) {
    animation-delay: 0.6s;
    opacity: 0.6;
  }
  .logo span:nth-child(4) {
    animation-delay: 0.9s;
  }
  @keyframes pulse {
    0%, 100% { filter: brightness(1); }
    50% { filter: brightness(1.5); }
  }
  h1 {
    margin: 0;
    font-size: 30px;
    letter-spacing: -0.02em;
  }
  .brand p {
    margin: 8px 0 0;
    color: var(--text-2);
    line-height: 1.5;
  }
  .drop {
    width: 100%;
    max-width: 520px;
    min-height: 260px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 28px 20px;
    text-align: center;
    border-radius: 22px;
    border: 1.5px dashed var(--line-2);
    background: rgba(22, 22, 31, 0.6);
    backdrop-filter: blur(10px);
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s, transform 0.2s;
  }
  .drop:hover,
  .drop.dragging {
    border-color: var(--accent);
    background: rgba(255, 61, 127, 0.06);
  }
  .drop.dragging {
    transform: scale(1.01);
  }
  .drop.busy {
    cursor: progress;
  }
  .drop strong {
    font-size: 17px;
  }
  .drop span:not(.btn),
  .drop small {
    color: var(--text-2);
  }
  .drop small {
    color: var(--text-3);
    margin-top: 6px;
  }
  .icon {
    width: 44px;
    height: 44px;
    color: var(--accent);
    margin-bottom: 4px;
  }
  .hint-desktop {
    display: none;
  }
  @media (hover: hover) and (pointer: fine) {
    .hint-desktop {
      display: inline;
    }
  }
  .spinner {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 3px solid var(--surface-3);
    border-top-color: var(--accent);
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .error {
    margin: 0;
    color: var(--danger);
    text-align: center;
    max-width: 520px;
  }
  .resume {
    width: 100%;
    max-width: 520px;
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 2px 12px;
    align-items: center;
    padding: 14px 18px;
    text-align: left;
    transition: border-color 0.2s;
  }
  .resume:hover {
    border-color: var(--line-2);
  }
  .resume .label {
    grid-column: 1;
  }
  .resume strong {
    grid-column: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .resume span[aria-hidden] {
    grid-column: 2;
    grid-row: 1 / 3;
    color: var(--accent);
    font-size: 20px;
  }
</style>
