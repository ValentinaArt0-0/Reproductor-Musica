import { useEffect } from "react";
import type { Song } from "../types";

interface MediaSessionActions {
  play: () => void;
  pause: () => void;
  next: () => void;
  previous: () => void;
}

/**
 * Small polish: browser tab title, plus the system media controls (keyboard media keys,
 * lock screen, headphones) through the Media Session API where the browser supports it.
 */
export function useMediaSession(song: Song | null, isPlaying: boolean, actions: MediaSessionActions) {
  const { play, pause, next, previous } = actions;

  useEffect(() => {
    document.title = song
      ? `${isPlaying ? "▶ " : ""}${song.title} · Sosiego`
      : "Sosiego · Reproductor de música";
  }, [song, isPlaying]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = song
      ? new MediaMetadata({
          title: song.title,
          artist: song.artist,
          album: "Sosiego",
          artwork: song.coverUrl ? [{ src: new URL(song.coverUrl, window.location.href).href }] : [],
        })
      : null;
  }, [song]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }, [isPlaying]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const session = navigator.mediaSession;
    session.setActionHandler("play", play);
    session.setActionHandler("pause", pause);
    session.setActionHandler("nexttrack", next);
    session.setActionHandler("previoustrack", previous);
    return () => {
      session.setActionHandler("play", null);
      session.setActionHandler("pause", null);
      session.setActionHandler("nexttrack", null);
      session.setActionHandler("previoustrack", null);
    };
  }, [play, pause, next, previous]);
}
