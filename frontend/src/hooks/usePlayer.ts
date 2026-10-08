import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { OnProgressProps } from "react-player/base";
import ReactPlayer from "react-player";
import { loadActivePlaylistId, saveActivePlaylistId } from "../lib/activePlaylist";
import * as api from "../lib/api";
import { messageOf } from "../lib/errors";
import { audioSourceUrl, playbackEngineOf, type PlaybackEngineKind } from "../lib/song";
import type {
  InsertPosition,
  PlaybackState,
  PlaylistDetail,
  PlaylistSummary,
  SearchResult,
} from "../types";

const RESTART_THRESHOLD_SECONDS = 3;
const NOTICE_DURATION_MS = 4000;
const UNPLAYABLE_MESSAGE = "Esta canción no tiene audio reproducible (catálogo de demostración).";

export type LoadStatus = "loading" | "ready" | "error";

export interface Notice {
  id: number;
  kind: "info" | "error";
  text: string;
}

const isMp3 = (file: File): boolean =>
  file.name.toLowerCase().endsWith(".mp3") || file.type === "audio/mpeg";

const withCurrent = (
  playlist: PlaylistDetail | null,
  state: PlaybackState,
): PlaylistDetail | null =>
  playlist ? { ...playlist, currentSongId: state.currentSong?.id ?? null } : playlist;

/**
 * Connects the UI with the backend's current doubly linked-list node and uses ReactPlayer to
 * play local media and audio streams, including YouTube audio proxied by the backend.
 */
export function usePlayer() {
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [playlist, setPlaylist] = useState<PlaylistDetail | null>(null);
  const [isPlaying, setIsPlayingState] = useState(false);
  const [position, setPosition] = useState(0);
  const [mediaDuration, setMediaDuration] = useState(0);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // ---- Refs: latest values for async callbacks (avoids stale closures) -----------------
  const playlistRef = useRef<PlaylistDetail | null>(null);
  const playlistsRef = useRef<PlaylistSummary[]>([]);
  const isPlayingRef = useRef(false);
  const currentSongRef = useRef<ReturnType<typeof findCurrent>>(null);
  const activeEngineRef = useRef<PlaybackEngineKind | null>(null);
  /** "When the next song loads, start playing it." Consumed by the source effect. */
  const wantsPlayRef = useRef(false);
  const loadedSongIdRef = useRef<string | null>(null);
  const noticeCounterRef = useRef(0);
  const uploadingRef = useRef(false);
  const shufflingRef = useRef(false);
  const audioGraphRef = useRef<{
    context: AudioContext;
    analyser: AnalyserNode;
    source: MediaElementAudioSourceNode;
    mediaElement: HTMLMediaElement;
  } | null>(null);
  const advanceRef = useRef<(fromEnded: boolean) => Promise<void>>(async () => {});
  const playerRef = useRef<ReactPlayer>(null);

  const setPlaying = useCallback((value: boolean) => {
    isPlayingRef.current = value;
    setIsPlayingState(value);
  }, []);

  const currentSong = useMemo(() => findCurrent(playlist), [playlist]);
  const engine = playbackEngineOf(currentSong);

  useEffect(() => {
    playlistRef.current = playlist;
    playlistsRef.current = playlists;
    currentSongRef.current = currentSong;
  }, [playlist, playlists, currentSong]);

  // ---- Notices ------------------------------------------------------------------------------
  const notify = useCallback((kind: Notice["kind"], text: string) => {
    noticeCounterRef.current += 1;
    setNotice({ id: noticeCounterRef.current, kind, text });
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(
      () => setNotice((current) => (current?.id === notice.id ? null : current)),
      NOTICE_DURATION_MS,
    );
    return () => clearTimeout(timer);
  }, [notice]);

  // ---- Initial load ----------------------------------------------------------------------------
  const load = useCallback(async () => {
    setStatus("loading");
    setLoadError(null);
    try {
      const initial = await api.loadInitialState(loadActivePlaylistId());
      setPlaylists(initial.playlists);
      setPlaylist(initial.playlist);
      saveActivePlaylistId(initial.playlist.id);
      setStatus("ready");
    } catch (error) {
      setLoadError(messageOf(error));
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const retry = useCallback(() => {
    api.resetBootstrap();
    void load();
  }, [load]);

  // ---- Engine-agnostic primitives ----------------------------------------------------------------
  const readPosition = useCallback(
    () => playerRef.current?.getCurrentTime() ?? 0,
    [],
  );

  const startPlayback = useCallback(() => {
    setPlaying(true);
  }, [setPlaying]);

  const pausePlayback = useCallback(() => {
    setPlaying(false);
  }, [setPlaying]);

  /** Stops (pause + rewind): used when the end of the list is reached or a list is closed. */
  const stopPlayback = useCallback(() => {
    pausePlayback();
    playerRef.current?.seekTo(0, "seconds");
    setPosition(0);
    setPlaying(false);
  }, [pausePlayback, setPlaying]);

  /** Manual seek (slider forward/backward): moves the playhead of the ACTIVE engine. */
  const seek = useCallback(
    (seconds: number) => {
      const song = currentSongRef.current;
      const mediaDuration = playerRef.current?.getDuration() ?? 0;
      const max = mediaDuration > 0 ? mediaDuration : (song?.durationSeconds ?? 0);
      const target = Math.min(Math.max(seconds, 0), max);
      playerRef.current?.seekTo(target, "seconds");
      setPosition(target);
    },
    [],
  );

  const toggle = useCallback(() => {
    const song = currentSongRef.current;
    if (!song) return;
    if (playbackEngineOf(song) === null) {
      notify("info", UNPLAYABLE_MESSAGE);
      return;
    }
    if (isPlayingRef.current) pausePlayback();
    else startPlayback();
  }, [notify, pausePlayback, startPlayback]);

  const play = useCallback(() => {
    if (playbackEngineOf(currentSongRef.current) === null) return;
    if (!isPlayingRef.current) startPlayback();
  }, [startPlayback]);

  const pause = useCallback(() => {
    if (isPlayingRef.current) pausePlayback();
  }, [pausePlayback]);

  /**
   * Audio analysis for Zen mode (YouTube audio cannot be analysed). The graph is built lazily
   * inside a click so the browser lets it run.
   */
  const getAnalyser = useCallback((): AnalyserNode | null => {
    const existing = audioGraphRef.current;
    if (existing) {
      const mediaElement = playerRef.current?.getInternalPlayer();
      if (
        mediaElement instanceof HTMLMediaElement &&
        mediaElement !== existing.mediaElement
      ) {
        const source = existing.context.createMediaElementSource(mediaElement);
        source.connect(existing.analyser);
        existing.source.disconnect();
        existing.source = source;
        existing.mediaElement = mediaElement;
      }
      void existing.context.resume();
      return existing.analyser;
    }
    try {
      const AudioContextClass =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return null;
      const context = new AudioContextClass();
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.82;
      const mediaElement = playerRef.current?.getInternalPlayer();
      if (!(mediaElement instanceof HTMLMediaElement)) {
        void context.close();
        return null;
      }
      const source = context.createMediaElementSource(mediaElement);
      source.connect(analyser);
      analyser.connect(context.destination);
      void context.resume();
      audioGraphRef.current = { context, analyser, source, mediaElement };
      return analyser;
    } catch {
      return null;
    }
  }, []);

  // ---- Navigation (the server owns the linked list) ------------------------------------------------
  /**
   * Moves to the next node. When `currentNode.next` is null the server answers `reachedEnd`
   * and playback STOPS instead of looping.
   */
  const advance = useCallback(
    async (fromEnded: boolean) => {
      const current = playlistRef.current;
      if (!current) return;
      const wasPlaying = fromEnded || isPlayingRef.current;
      try {
        const state = await api.nextSong(current.id);
        if (state.reachedEnd) {
          stopPlayback();
          notify("info", "Llegaste al final de la lista. La reproducción se detuvo.");
          return;
        }
        wantsPlayRef.current = wasPlaying;
        setPlaylist((previous) => withCurrent(previous, state));
      } catch (error) {
        notify("error", messageOf(error));
      }
    },
    [notify, stopPlayback],
  );

  useEffect(() => {
    advanceRef.current = advance;
  }, [advance]);

  const next = useCallback(() => advance(false), [advance]);

  const previous = useCallback(async () => {
    const current = playlistRef.current;
    const song = currentSongRef.current;
    if (!current || !song) return;

    // Like most players: after a few seconds, "previous" restarts the song.
    if (readPosition() > RESTART_THRESHOLD_SECONDS) {
      seek(0);
      return;
    }
    const wasPlaying = isPlayingRef.current;
    try {
      const state = await api.previousSong(current.id);
      if (!state.currentSong || state.currentSong.id === song.id) {
        seek(0); // already at the head of the list
        return;
      }
      wantsPlayRef.current = wasPlaying;
      setPlaylist((prev) => withCurrent(prev, state));
    } catch (error) {
      notify("error", messageOf(error));
    }
  }, [notify, readPosition, seek]);

  const select = useCallback(
    async (songId: string) => {
      const current = playlistRef.current;
      if (!current) return;
      if (songId === current.currentSongId) {
        toggle();
        return;
      }
      try {
        const state = await api.setCurrentSong(current.id, songId);
        wantsPlayRef.current = true;
        setPlaylist((prev) => withCurrent(prev, state));
      } catch (error) {
        notify("error", messageOf(error));
      }
    },
    [notify, toggle],
  );

  // ---- Song editing -------------------------------------------------------------------------------------
  const remove = useCallback(
    async (songId: string) => {
      const current = playlistRef.current;
      if (!current) return;
      const wasCurrent = current.currentSongId === songId;
      const wasPlaying = isPlayingRef.current;
      try {
        const { playlist: updated } = await api.removeSong(current.id, songId);
        if (wasCurrent) wantsPlayRef.current = wasPlaying;
        setPlaylist(updated);
      } catch (error) {
        notify("error", messageOf(error));
      }
    },
    [notify],
  );

  /** Drag & drop: the backend unlinks the node and re-inserts it at `toIndex`. */
  const move = useCallback(
    async (songId: string, toIndex: number): Promise<boolean> => {
      const current = playlistRef.current;
      if (!current) return false;
      try {
        setPlaylist((await api.moveSong(current.id, songId, toIndex)).playlist);
        return true;
      } catch (error) {
        notify("error", messageOf(error));
        return false;
      }
    },
    [notify],
  );

  const upload = useCallback(
    async (files: File[], where: InsertPosition) => {
      const current = playlistRef.current;
      if (!current || files.length === 0) return;
      if (uploadingRef.current) {
        notify("info", "Espera a que termine la subida actual.");
        return;
      }

      // Validate here so a wrong file never costs a round trip.
      const valid = files.filter(isMp3);
      if (valid.length === 0) {
        notify("error", "Solo se aceptan archivos MP3.");
        return;
      }
      const skipped = files.length - valid.length;

      uploadingRef.current = true;
      setIsUploading(true);
      setUploadProgress(0);
      try {
        const result = await api.uploadFiles(current.id, valid, where, setUploadProgress);
        // The user may have switched lists while the files were uploading.
        if (result.playlist && playlistRef.current?.id === result.playlist.id) {
          setPlaylist(result.playlist);
        }

        const added = result.tracks.length;
        const problems: string[] = [];
        if (result.rejected.length > 0) {
          const extra = result.rejected.length > 1 ? ` (y ${result.rejected.length - 1} más)` : "";
          problems.push(`${result.rejected[0].message}${extra}`);
        }
        if (skipped > 0) {
          problems.push(skipped === 1 ? "1 archivo no era MP3." : `${skipped} archivos no eran MP3.`);
        }
        if (problems.length > 0) {
          notify("error", `Se agregaron ${added}. ${problems.join(" ")}`);
        } else {
          notify("info", added === 1 ? "Se agregó 1 canción." : `Se agregaron ${added} canciones.`);
        }
      } catch (error) {
        notify("error", messageOf(error));
      } finally {
        uploadingRef.current = false;
        setIsUploading(false);
        setUploadProgress(null);
      }
    },
    [notify],
  );

  /** Adds a web search result to the playlist (start or end). Resolves to true on success. */
  const addFromSearch = useCallback(
    async (result: SearchResult, where: InsertPosition): Promise<boolean> => {
      const current = playlistRef.current;
      if (!current) return false;
      try {
        const { playlist: updated } = await api.addSong(
          current.id,
          {
            title: result.title,
            artist: result.artist,
            durationSeconds: result.durationSeconds,
            source: "web",
            uri: result.uri,
            coverUrl: result.thumbnailUrl,
          },
          where,
        );
        setPlaylist(updated);
        return true;
      } catch (error) {
        notify("error", messageOf(error));
        return false;
      }
    },
    [notify],
  );

  // ---- Smart Shuffle --------------------------------------------------------------------------------------
  /**
   * Toggles the backend's Smart Shuffle: it re-links the nodes (the current song stays at the
   * head, so playback is never interrupted) or restores the original order.
   */
  const toggleShuffle = useCallback(async () => {
    const current = playlistRef.current;
    if (!current || shufflingRef.current) return;
    if (current.songs.length < 2) {
      notify("info", "Agrega al menos 2 canciones para mezclar.");
      return;
    }
    shufflingRef.current = true;
    try {
      const { playlist: updated } = current.isShuffled
        ? await api.restorePlaylistOrder(current.id)
        : await api.shufflePlaylist(current.id);
      setPlaylist(updated);
      notify("info", updated.isShuffled ? "Smart Shuffle activado." : "Orden original restaurado.");
    } catch (error) {
      notify("error", messageOf(error));
    } finally {
      shufflingRef.current = false;
    }
  }, [notify]);

  // ---- Playlist management ------------------------------------------------------------------------------------
  /** Stops whatever is playing: used whenever the open playlist changes. */
  const resetPlayback = useCallback(() => {
    stopPlayback();
    wantsPlayRef.current = false;
  }, [stopPlayback]);

  const openPlaylist = useCallback(
    (detail: PlaylistDetail) => {
      resetPlayback();
      setPlaylist(detail);
      saveActivePlaylistId(detail.id);
    },
    [resetPlayback],
  );

  const switchPlaylist = useCallback(
    async (id: string) => {
      if (id === playlistRef.current?.id) return;
      try {
        openPlaylist((await api.getPlaylist(id)).playlist);
      } catch (error) {
        notify("error", messageOf(error));
      }
    },
    [notify, openPlaylist],
  );

  /** Resolves to null on success, or the message to show in the dialog. */
  const createPlaylist = useCallback(
    async (name: string): Promise<string | null> => {
      try {
        const { playlist: created } = await api.createPlaylist(name);
        setPlaylists((previous) => [...previous, api.toSummary(created)]);
        openPlaylist(created);
        notify("info", `Lista “${created.name}” creada.`);
        return null;
      } catch (error) {
        return messageOf(error);
      }
    },
    [notify, openPlaylist],
  );

  /** Resolves to null on success, or the message to show in the dialog. */
  const deletePlaylist = useCallback(
    async (id: string): Promise<string | null> => {
      try {
        await api.deletePlaylist(id);
        const remaining = playlistsRef.current.filter((p) => p.id !== id);
        setPlaylists(remaining);

        if (id === playlistRef.current?.id) {
          // The open list was deleted: open another one, or a fresh default if none is left.
          let next: PlaylistDetail;
          if (remaining.length > 0) {
            next = (await api.getPlaylist(remaining[0].id)).playlist;
          } else {
            next = (await api.createPlaylist(api.DEFAULT_PLAYLIST_NAME)).playlist;
            setPlaylists([api.toSummary(next)]);
          }
          openPlaylist(next);
        }
        notify("info", "Lista eliminada.");
        return null;
      } catch (error) {
        return messageOf(error);
      }
    },
    [notify, openPlaylist],
  );

  const onProgress = useCallback((progress: OnProgressProps) => {
    if (activeEngineRef.current !== null) setPosition(progress.playedSeconds);
  }, []);

  const onDuration = useCallback((seconds: number) => {
    if (activeEngineRef.current !== null && Number.isFinite(seconds)) setMediaDuration(seconds);
  }, []);

  const onPlay = useCallback(() => {
    if (activeEngineRef.current !== null) setPlaying(true);
  }, [setPlaying]);

  const onPause = useCallback(() => {
    if (activeEngineRef.current !== null) setPlaying(false);
  }, [setPlaying]);

  const onEnded = useCallback(() => {
    if (activeEngineRef.current !== null) {
      setPlaying(false);
      void advanceRef.current(true);
    }
  }, [setPlaying]);

  const onError = useCallback(
  (error?: unknown) => {
    if (activeEngineRef.current === null) return;
    console.error("[player] error", {
      error,
      engine: activeEngineRef.current,
      url: audioSourceUrl(currentSongRef.current),
    });
    setPlaying(false);

    // Códigos de YouTube: 100 = no existe, 101/150 = incrustación bloqueada
    const blocked = error === 100 || error === 101 || error === 150;
    notify(
      "error",
      blocked
        ? "Este video no permite reproducirse fuera de YouTube. Prueba con otra versión."
        : "No se pudo reproducir esta canción. Comprueba que el audio esté disponible.",
    );
  },
  [notify, setPlaying],
);

  // ---- Keep ReactPlayer in sync with the playlist's current node ---------------------------------------------
  const currentId = currentSong?.id ?? null;
  const playerUrl = audioSourceUrl(currentSong);
  const currentSource = currentSong?.source;

  useEffect(() => {
    if (engine === null || !playerUrl) {
      if (loadedSongIdRef.current !== null) {
        loadedSongIdRef.current = null;
        setPlaying(false);
      }
      activeEngineRef.current = null;
      wantsPlayRef.current = false;
      setPlaying(false);
      setPosition(0);
      setMediaDuration(0);
      if (currentSource === "web") notify("info", UNPLAYABLE_MESSAGE);
      return;
    }

    if (loadedSongIdRef.current === currentId) return;
    loadedSongIdRef.current = currentId;
    activeEngineRef.current = engine;
    setPosition(0);
    setMediaDuration(0);
    const autoplay = wantsPlayRef.current;
    wantsPlayRef.current = false;
    setPlaying(autoplay);
  }, [currentId, currentSource, engine, notify, playerUrl, setPlaying]);

  // ---- Derived values ----------------------------------------------------------------------------------------------------------
  const duration = mediaDuration > 0 ? mediaDuration : (currentSong?.durationSeconds ?? 0);

  /** Sidebar list: counts come from the open playlist, which is always the freshest source. */
  const playlistSummaries = useMemo(
    () =>
      playlists.map((summary) =>
        playlist && summary.id === playlist.id ? api.toSummary(playlist) : summary,
      ),
    [playlists, playlist],
  );

  return {
    status,
    loadError,
    retry,
    playlist,
    playlists: playlistSummaries,
    songs: playlist?.songs ?? [],
    currentSong,
    engine,
    isPlaying,
    isShuffled: playlist?.isShuffled ?? false,
    position,
    duration,
    canPlay: engine !== null,
    notice,
    isUploading,
    uploadProgress,
    playerRef,
    playerUrl,
    onProgress,
    onDuration,
    onPlay,
    onPause,
    onEnded,
    onError,
    getAnalyser,
    play,
    pause,
    toggle,
    next,
    previous,
    seek,
    select,
    remove,
    move,
    upload,
    addFromSearch,
    toggleShuffle,
    switchPlaylist,
    createPlaylist,
    deletePlaylist,
  };
}

function findCurrent(playlist: PlaylistDetail | null) {
  return playlist?.songs.find((song) => song.id === playlist.currentSongId) ?? null;
}
