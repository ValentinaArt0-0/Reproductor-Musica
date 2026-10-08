/** 83 -> "1:23" */
export function formatTime(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/** 4320 -> "1 h 12 min", 1080 -> "18 min" */
export function formatTotalDuration(totalSeconds: number): string {
  const totalMinutes = Math.round(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  return `${hours} h ${minutes} min`;
}

export function formatSongCount(count: number): string {
  return count === 1 ? "1 canción" : `${count} canciones`;
}
