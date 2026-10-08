const KEY = "sosiego:activePlaylistId";

/** Remembers which playlist was open (storage can be blocked, so every access is guarded). */
export function loadActivePlaylistId(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveActivePlaylistId(id: string): void {
  try {
    window.localStorage.setItem(KEY, id);
  } catch {
    // ignore: remembering the playlist is a convenience only
  }
}
