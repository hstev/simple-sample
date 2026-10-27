/** `?track=tracks/song.mp3` is set by the Docker helper; relative paths only. */
export function trackParam(): string | null {
  const t = new URLSearchParams(location.search).get('track');
  if (!t || /^[a-z]+:|^\/\//i.test(t)) return null;
  return t;
}

export function clearTrackParam(): void {
  const url = new URL(location.href);
  url.searchParams.delete('track');
  history.replaceState(null, '', url);
}
