export function fmtTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}

export function fmtShort(sec: number): string {
  return sec < 10 ? `${sec.toFixed(2)}s` : `${sec.toFixed(1)}s`;
}

export const PAD_COLORS = [
  '#ff3d7f', '#ff7a3d', '#ffc23d', '#b8ff3d',
  '#3dffa2', '#3de4ff', '#3d8bff', '#7c5cff',
  '#c95cff', '#ff5ce1', '#ff5c7a', '#5cffd6',
];

export const BANKS = ['A', 'B', 'C', 'D'] as const;
export const PADS_PER_BANK = 16;
export const PAD_COUNT = BANKS.length * PADS_PER_BANK;

/** Default keyboard layout, MPC-style: bottom-left pad is pad 1. */
export const DEFAULT_KEYS: { code: string; label: string }[] = [
  ['KeyZ', 'Z'], ['KeyX', 'X'], ['KeyC', 'C'], ['KeyV', 'V'],
  ['KeyA', 'A'], ['KeyS', 'S'], ['KeyD', 'D'], ['KeyF', 'F'],
  ['KeyQ', 'Q'], ['KeyW', 'W'], ['KeyE', 'E'], ['KeyR', 'R'],
  ['Digit1', '1'], ['Digit2', '2'], ['Digit3', '3'], ['Digit4', '4'],
].map(([code, label]) => ({ code, label }));
