import { PAD_COUNT } from '../lib/format';
import { project } from '../state/project.svelte';

// Pad A1 = note 36 (C1), the usual default on pad controllers.
const BASE_NOTE = 36;

export function midiSupported(): boolean {
  return typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;
}

/** Connects every MIDI input; returns the number of devices found. */
export async function connectMidi(): Promise<number> {
  const access = await navigator.requestMIDIAccess();
  const bind = () => {
    for (const input of access.inputs.values()) input.onmidimessage = onMessage;
  };
  bind();
  access.onstatechange = bind;
  return access.inputs.size;
}

function onMessage(e: MIDIMessageEvent): void {
  const d = e.data;
  if (!d || d.length < 3) return;
  const cmd = d[0] & 0xf0;
  const pad = d[1] - BASE_NOTE;
  if (pad < 0 || pad >= PAD_COUNT) return;
  if (cmd === 0x90 && d[2] > 0) project.hit(pad, d[2] / 127);
  else if (cmd === 0x80 || (cmd === 0x90 && d[2] === 0)) project.release(pad);
}
