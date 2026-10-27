import { audio } from './engine';

export async function decodeBytes(bytes: ArrayBuffer): Promise<AudioBuffer> {
  // decodeAudioData detaches its input; keep the caller's copy intact.
  return audio().decodeAudioData(bytes.slice(0));
}

/** Loads an audio file from the same origin only (Docker helper ?track=…). */
export async function fetchSameOrigin(path: string): Promise<{ name: string; blob: Blob }> {
  const url = new URL(path, location.href);
  if (url.origin !== location.origin) throw new Error('Solo se permiten archivos del mismo origen.');
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`No se pudo cargar el track (${res.status}).`);
  const name = decodeURIComponent(url.pathname.split('/').pop() || 'track.mp3');
  return { name, blob: await res.blob() };
}
