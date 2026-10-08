import type { Song } from "../types";

/** Which playback engine can play a song. */
export type PlaybackEngineKind = "audio" | "youtube";

/** URL for locally hosted audio or an allowlisted web audio file. */
export function audioSourceUrl(song: Song | null): string | null {
  if (!song?.uri) return null;
  if (song.source === "local") return song.uri;
  if (song.source === "web") {
    const youtubeId = getYouTubeId(song);
    if (youtubeId) return `https://www.youtube.com/watch?v=${youtubeId}`;
    if (song.uri.startsWith("https://")) return `/api/stream?url=${encodeURIComponent(song.uri)}`;
  }
  return null;
}

/** Supports both legacy `youtube:<videoId>` entries and YouTube watch URLs. */
export function getYouTubeId(song: Song | null): string | null {
  if (!song || song.source !== "web" || !song.uri) return null;
  if (song.uri.startsWith("youtube:")) {
    const id = song.uri.slice("youtube:".length);
    return /^[\w-]{11}$/.test(id) ? id : null;
  }
  try {
    const url = new URL(song.uri);
    if (url.protocol !== "https:") return null;
    if (url.hostname === "youtu.be") {
      const id = url.pathname.slice(1);
      return /^[\w-]{11}$/.test(id) ? id : null;
    }
    if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)) {
      const id = url.searchParams.get("v");
      return url.pathname === "/watch" && id && /^[\w-]{11}$/.test(id) ? id : null;
    }
  } catch {
    return null;
  }
  return null;
}

export function playbackEngineOf(song: Song | null): PlaybackEngineKind | null {
  if (getYouTubeId(song)) return "youtube";
if (audioSourceUrl(song)) return "audio";
  return null; // e.g. demo-catalogue songs ("mock:" references): they have no audio
}

export const isPlayable = (song: Song | null): boolean => playbackEngineOf(song) !== null;
