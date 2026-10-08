import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import ReactPlayer from "react-player";
import { useCallback, useEffect, useRef, useState } from "react";
import { CreatePlaylistModal } from "./components/CreatePlaylistModal";
import { DeletePlaylistModal } from "./components/DeletePlaylistModal";
import { NowPlaying } from "./components/NowPlaying";
import { PlayerBar } from "./components/PlayerBar";
import { PlaylistPanel } from "./components/PlaylistPanel";
import { SearchPanel } from "./components/SearchPanel";
import { StatusScreen } from "./components/StatusScreen";
import { UploadIcon, WavesIcon } from "./components/icons";
import { ZenModeVisualizer } from "./components/ZenModeVisualizer";
import { useAlbumPalette } from "./hooks/useAlbumPalette";
import { useFileDrop } from "./hooks/useFileDrop";
import { useMediaSession } from "./hooks/useMediaSession";
import { usePlayer } from "./hooks/usePlayer";
import type { PlaylistSummary } from "./types";

type PlaylistDialog = { kind: "create" } | { kind: "delete"; playlist: PlaylistSummary } | null;

export default function App() {
  const player = usePlayer();
  const palette = useAlbumPalette(player.currentSong);

  const [zenOpen, setZenOpen] = useState(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [dialog, setDialog] = useState<PlaylistDialog>(null);
  const appRef = useRef<HTMLDivElement>(null);
  const zenButtonRef = useRef<HTMLButtonElement>(null);

  const { upload } = player;
  const handleDroppedFiles = useCallback((files: File[]) => void upload(files, "end"), [upload]);
  const isDraggingFiles = useFileDrop(
    handleDroppedFiles,
    player.status === "ready" && !zenOpen && dialog === null,
  );

  useMediaSession(player.currentSong, player.isPlaying, {
    play: player.play,
    pause: player.pause,
    next: player.next,
    previous: player.previous,
  });

  // While Zen or a dialog is open, the main UI is removed from keyboard and screen-reader reach.
  const mainInert = zenOpen || dialog !== null;
  useEffect(() => {
    if (appRef.current) appRef.current.inert = mainInert;
  }, [mainInert]);

  const { getAnalyser } = player;
  const openZen = useCallback(() => {
    setAnalyser(getAnalyser()); // inside the click: browsers only allow audio setup after a gesture
    setZenOpen(true);
  }, [getAnalyser]);

  const closeZen = useCallback(() => {
    setZenOpen(false);
    requestAnimationFrame(() => zenButtonRef.current?.focus());
  }, []);

  const closeDialog = useCallback(() => setDialog(null), []);

  if (player.status === "loading") return <StatusScreen kind="loading" />;
  if (player.status === "error" || !player.playlist) {
    return <StatusScreen kind="error" message={player.loadError} onRetry={player.retry} />;
  }

  return (
    // reducedMotion="user": people who ask their OS for less motion get fades instead of movement.
    <MotionConfig reducedMotion="user">
      {/* Only opacity is animated here: a transform/filter would break the fixed player bar. */}
      <motion.div
        ref={appRef}
        animate={{ opacity: zenOpen ? 0 : 1 }}
        transition={{ duration: 0.7, ease: "easeInOut" }}
        className="min-h-dvh pb-52 md:pb-40"
      >
        <header className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 pb-6 pt-8 md:px-6">
          <div className="flex items-baseline gap-4">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-900">
              Sosiego
            </h1>
            <p className="hidden text-sm text-ink-500 sm:block">Música para respirar</p>
          </div>

          <motion.button
            ref={zenButtonRef}
            type="button"
            whileTap={{ scale: 0.96 }}
            disabled={!player.currentSong}
            onClick={openZen}
            className="inline-flex items-center gap-2 rounded-full border border-sage-300 bg-sand-50 px-4 py-2 text-sm font-semibold text-sage-800 transition-colors duration-200 hover:bg-sage-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lavender-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <WavesIcon className="size-4" />
            Modo Zen
          </motion.button>
        </header>

        <main className="mx-auto grid max-w-5xl gap-6 px-4 md:px-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-8">
          <NowPlaying song={player.currentSong} isPlaying={player.isPlaying} />
          <div className="flex min-w-0 flex-col gap-6">
            <SearchPanel onAdd={player.addFromSearch} />
            <PlaylistPanel
              playlists={player.playlists}
              activePlaylistId={player.playlist.id}
              isShuffled={player.isShuffled}
              songs={player.songs}
              currentId={player.currentSong?.id ?? null}
              isPlaying={player.isPlaying}
              totalDurationSeconds={player.playlist.totalDurationSeconds}
              isUploading={player.isUploading}
              uploadProgress={player.uploadProgress}
              onSelect={player.select}
              onRemove={player.remove}
              onMove={player.move}
              onUpload={player.upload}
              onSwitchPlaylist={player.switchPlaylist}
              onRequestCreate={() => setDialog({ kind: "create" })}
              onRequestDelete={(playlist) => setDialog({ kind: "delete", playlist })}
            />
          </div>
        </main>

        <PlayerBar
          song={player.currentSong}
          isPlaying={player.isPlaying}
          position={player.position}
          duration={player.duration}
          canSeek={player.canPlay}
          notice={player.notice}
          isShuffled={player.isShuffled}
          canShuffle={player.songs.length >= 2}
          onToggleShuffle={player.toggleShuffle}
          onToggle={player.toggle}
          onNext={player.next}
          onPrev={player.previous}
          onSeek={player.seek}
        />

        {/* Reproductor oculto visualmente, pero "visible" para YouTube (mín. 200x200) */}
<div
  aria-hidden="true"
  className="pointer-events-none fixed bottom-0 right-0 size-[200px] overflow-hidden opacity-0"
>
  <ReactPlayer
    ref={player.playerRef}
    url={player.playerUrl ?? undefined}
    playing={player.isPlaying}
    controls={false}
    width="200px"
    height="200px"
    config={{ youtube: { playerVars: { controls: 0, playsinline: 1, rel: 0 } } }}
    progressInterval={250}
    onReady={() => console.log("[player] ready", player.playerUrl)}
    onProgress={player.onProgress}
    onDuration={player.onDuration}
    onPlay={player.onPlay}
    onPause={player.onPause}
    onEnded={player.onEnded}
    onError={(e) => {
      console.error("[player] error", e, player.playerUrl);
      player.onError(e);
    }}
  />
</div>
      </motion.div>

      {/* Dropping files anywhere: highlighted overlay (never blocks the drag itself) */}
      <AnimatePresence>
        {isDraggingFiles && (
          <motion.div
            key="drop-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-sage-100/80 p-6 backdrop-blur-sm"
          >
            <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-sage-500 bg-sand-50/90 px-8 py-12 text-center shadow-soft">
              <UploadIcon className="size-10 text-sage-700" />
              <p className="font-display text-2xl font-semibold text-ink-900">Suelta tus MP3 aquí</p>
              <p className="text-sm text-ink-500">Se agregarán al final de tu lista.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {zenOpen && (
          <ZenModeVisualizer
            key="zen"
            song={player.currentSong}
            isPlaying={player.isPlaying}
            // A YouTube iframe's sound cannot be analysed: its waves use the simulated motion.
            analyser={player.engine === "audio" ? analyser : null}
            palette={palette}
            onClose={closeZen}
            onToggle={player.toggle}
            onNext={player.next}
            onPrev={player.previous}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {dialog?.kind === "create" && (
          <CreatePlaylistModal key="create-playlist" onSubmit={player.createPlaylist} onClose={closeDialog} />
        )}
        {dialog?.kind === "delete" && (
          <DeletePlaylistModal
            key="delete-playlist"
            playlist={dialog.playlist}
            onConfirm={() => player.deletePlaylist(dialog.playlist.id)}
            onClose={closeDialog}
          />
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
