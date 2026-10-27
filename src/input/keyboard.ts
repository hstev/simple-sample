import { project } from '../state/project.svelte';

const held = new Map<string, number>(); // code → pad, to release the same pad

function typing(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) && (t as HTMLInputElement).type !== 'range';
}

function keyLabel(e: KeyboardEvent): string {
  if (e.key === ' ') return 'Space';
  return e.key.length === 1 ? e.key.toUpperCase() : e.key;
}

function onKeyDown(e: KeyboardEvent): void {
  if (!project.ready || typing(e)) return;
  const mod = e.ctrlKey || e.metaKey;

  // Learn mode: the next plain key gets bound to the pad being configured.
  if (project.learning !== null) {
    e.preventDefault();
    if (e.code === 'Escape') project.learning = null;
    else if (!mod && !['Space', 'Delete', 'Backspace', 'Tab'].includes(e.code)) {
      project.bindKey(project.learning, e.code, keyLabel(e));
    }
    return;
  }

  if (mod) {
    if (e.code === 'KeyZ') {
      e.preventDefault();
      void (e.shiftKey ? project.redo() : project.undo());
    } else if (e.code === 'KeyY') {
      e.preventDefault();
      void project.redo();
    }
    return;
  }

  const pad = project.padForKey(e.code);
  if (pad >= 0) {
    e.preventDefault();
    if (e.repeat) return;
    project.hit(pad);
    held.set(e.code, pad);
    return;
  }

  switch (e.code) {
    case 'Space':
      e.preventDefault();
      project.togglePlay();
      break;
    case 'Delete':
    case 'Backspace':
      if (project.selection) {
        e.preventDefault();
        void project.deleteSelection();
      }
      break;
    case 'Escape':
      project.selection = null;
      break;
    case 'ArrowLeft':
    case 'ArrowRight':
    case 'ArrowUp':
    case 'ArrowDown': {
      // Arrow keys switch bank (left/right) like an MPC bank button.
      if (e.code === 'ArrowLeft' || e.code === 'ArrowDown') project.bank = (project.bank + 3) % 4;
      else project.bank = (project.bank + 1) % 4;
      e.preventDefault();
      break;
    }
  }
}

function onKeyUp(e: KeyboardEvent): void {
  const pad = held.get(e.code);
  if (pad === undefined) return;
  held.delete(e.code);
  project.release(pad);
}

export function installKeyboard(): () => void {
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  const blur = () => {
    for (const pad of held.values()) project.release(pad);
    held.clear();
  };
  window.addEventListener('blur', blur);
  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', blur);
  };
}
