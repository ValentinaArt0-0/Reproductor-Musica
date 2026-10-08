import { AnimatePresence, motion } from "framer-motion";
import type { Notice } from "../hooks/usePlayer";
import type { Song } from "../types";
import { Cover } from "./Cover";
import { IconButton } from "./IconButton";
import { PauseIcon, PlayIcon, ShuffleIcon, SkipNextIcon, SkipPrevIcon } from "./icons";
import { SeekBar } from "./SeekBar";

interface PlayerBarProps {
  song: Song | null;
  isPlaying: boolean;
  position: number;
  duration: number;
  /** Whether the current song has a playable media URL. */
  canSeek: boolean;
  notice: Notice | null;
  isShuffled: boolean;
  /** Shuffling needs at least two songs. */
  canShuffle: boolean;
  onToggleShuffle: () => void;
  onToggle: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (seconds: number) => void;
}

/** Fixed bottom bar: song info, transport buttons, time slider and transient messages. */
export function PlayerBar({
  song,
  isPlaying,
  position,
  duration,
  canSeek,
  notice,
  isShuffled,
  canShuffle,
  onToggleShuffle,
  onToggle,
  onNext,
  onPrev,
  onSeek,
}: PlayerBarProps) {
  const hasSong = song !== null;

  return (
    <footer
      aria-label="Controles de reproducción"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-sage-200/80 bg-sage-100/85 shadow-bar backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {/* Toast above the bar (wrapper centers it so Framer's transform does not clash). */}
      <div className="pointer-events-none absolute inset-x-0 bottom-full mb-3 flex justify-center px-4">
        <AnimatePresence>
          {notice && (
            <motion.p
              key={notice.id}
              role="status"
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.2 }}
              className={`max-w-md rounded-full px-4 py-2 text-center text-sm font-medium shadow-lift ${
                notice.kind === "error"
                  ? "border border-clay-500/60 bg-clay-100 text-ink-900"
                  : "bg-ink-800 text-sand-50"
              }`}
            >
              {notice.text}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <div className="mx-auto grid max-w-5xl items-center gap-x-6 gap-y-2 px-4 py-3 md:grid-cols-[1fr_minmax(0,1.7fr)_1fr] md:px-6">
        {/* Song info */}
        <div className="flex min-w-0 items-center gap-3">
          <Cover
            key={song?.id ?? "none"}
            src={song?.coverUrl}
            className="size-11 shrink-0 rounded-xl"
            iconClassName="size-5"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink-900">
              {song?.title ?? "Nada suena todavía"}
            </p>
            <p className="truncate text-xs text-ink-500">{song?.artist ?? "Sube un MP3 para empezar"}</p>
          </div>
        </div>

        {/* Controls + seek bar */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-3">
            <IconButton
              label="Smart Shuffle"
              pressed={isShuffled}
              onClick={onToggleShuffle}
              disabled={!canShuffle}
            >
              <ShuffleIcon className="size-5" />
            </IconButton>

            <IconButton label="Canción anterior" onClick={onPrev} disabled={!hasSong}>
              <SkipPrevIcon className="size-6" />
            </IconButton>

            <IconButton
              label={isPlaying ? "Pausar" : "Reproducir"}
              tone="primary"
              size="lg"
              onClick={onToggle}
              disabled={!hasSong}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={isPlaying ? "pause" : "play"}
                  initial={{ opacity: 0, scale: 0.6, rotate: -20 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.6, rotate: 20 }}
                  transition={{ duration: 0.14 }}
                  className="flex"
                >
                  {isPlaying ? <PauseIcon className="size-7" /> : <PlayIcon className="size-7" />}
                </motion.span>
              </AnimatePresence>
            </IconButton>

            {/* Always enabled: on the last song it stops the playback instead of looping. */}
            <IconButton label="Siguiente canción" onClick={onNext} disabled={!hasSong}>
              <SkipNextIcon className="size-6" />
            </IconButton>

            {/* Balances the shuffle button so Play stays centered */}
            <span className="size-11 shrink-0" aria-hidden="true" />
          </div>

          <div className="w-full max-w-xl">
            <SeekBar
              value={position}
              max={canSeek ? duration : 0}
              onSeek={onSeek}
              disabled={!hasSong || !canSeek}
            />
          </div>
        </div>

        {/* Spacer: volume and Zen mode controls will live here in later modules */}
        <div className="hidden md:block" />
      </div>
    </footer>
  );
}
