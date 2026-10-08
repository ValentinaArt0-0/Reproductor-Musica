import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { mix, rgba, SAND, type Palette } from "../lib/palette";
import type { Song } from "../types";
import { IconButton } from "./IconButton";
import { CloseIcon, PauseIcon, PlayIcon, SkipNextIcon, SkipPrevIcon } from "./icons";
import { ZenWaves } from "./ZenWaves";

interface ZenModeVisualizerProps {
  song: Song | null;
  isPlaying: boolean;
  analyser: AnalyserNode | null;
  /** Colors of the current album cover. */
  palette: Palette;
  onClose: () => void;
  onToggle: () => void;
  onNext: () => void;
  onPrev: () => void;
}

const IDLE_HIDE_MS = 3000;

/**
 * Full-screen Zen mode: a calm background that "breathes" in the colors of the current cover,
 * with minimal waves that move with the music. Controls fade away after a few seconds of
 * inactivity; any movement or key brings them back. Esc exits.
 */
export function ZenModeVisualizer({
  song,
  isPlaying,
  analyser,
  palette,
  onClose,
  onToggle,
  onNext,
  onPrev,
}: ZenModeVisualizerProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const [controlsVisible, setControlsVisible] = useState(true);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let timer: number | undefined;
    const reveal = () => {
      setControlsVisible(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setControlsVisible(false), IDLE_HIDE_MS);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      else reveal();
    };

    reveal();
    window.addEventListener("pointermove", reveal);
    window.addEventListener("pointerdown", reveal);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointermove", reveal);
      window.removeEventListener("pointerdown", reveal);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  const base = rgba(mix(palette.primary, SAND, 0.8));
  const blobs = [
    { color: palette.primary, position: "-left-[15%] -top-[25%] size-[70vmax]", seconds: 9 },
    { color: palette.secondary, position: "-bottom-[30%] -right-[15%] size-[75vmax]", seconds: 11 },
    { color: palette.accent, position: "left-[30%] top-[25%] size-[45vmax]", seconds: 13 },
  ];
  const breathe = (seconds: number) => ({ duration: seconds, repeat: Infinity, ease: "easeInOut" as const });

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Modo Zen"
      className="fixed inset-0 z-50 overflow-hidden"
      style={{ cursor: controlsVisible ? "auto" : "none" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0.2 : 0.9, ease: "easeInOut" }}
    >
      {/* Base wash, tinted by the cover */}
      <motion.div
        aria-hidden="true"
        className="absolute inset-0"
        initial={{ backgroundColor: base }}
        animate={{ backgroundColor: base }}
        transition={{ duration: 1.4 }}
      />

      {/* Breathing color fields: they swell slowly, a little more while music plays */}
      {blobs.map((blob) => (
        <motion.div
          key={blob.position}
          aria-hidden="true"
          className={`absolute rounded-full blur-[90px] will-change-transform ${blob.position}`}
          initial={{ backgroundColor: rgba(blob.color), opacity: 0.5, scale: 1 }}
          animate={{
            backgroundColor: rgba(blob.color),
            ...(reduceMotion
              ? {}
              : {
                  scale: [1, isPlaying ? 1.2 : 1.07, 1],
                  opacity: [0.5, isPlaying ? 0.8 : 0.62, 0.5],
                }),
          }}
          transition={{
            backgroundColor: { duration: 1.4 },
            scale: breathe(blob.seconds),
            opacity: breathe(blob.seconds),
          }}
        />
      ))}

      {/* Waves that follow the music */}
      <div className="absolute inset-0">
        <ZenWaves analyser={analyser} isPlaying={isPlaying} palette={palette} animate={!reduceMotion} />
      </div>

      {/* Top bar: exit */}
      <motion.div
        className="absolute inset-x-0 top-0 flex items-center justify-between px-5 pt-5"
        animate={{ opacity: controlsVisible ? 1 : 0 }}
        transition={{ duration: 0.5 }}
        style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top, 0px))" }}
      >
        <p className="text-sm font-medium text-ink-700">Modo Zen · Esc para salir</p>
        <button
          ref={closeButtonRef}
          type="button"
          aria-label="Salir del Modo Zen"
          title="Salir del Modo Zen"
          onClick={onClose}
          className="flex size-11 items-center justify-center rounded-full text-ink-700 transition-colors hover:bg-sage-200/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lavender-500"
        >
          <CloseIcon className="size-6" />
        </button>
      </motion.div>

      {/* Bottom: song + controls */}
      <div
        className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-6 px-6 pb-10 text-center"
        style={{ paddingBottom: "max(2.5rem, env(safe-area-inset-bottom, 0px))" }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={song?.id ?? "empty"}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
          >
            <h2 className="font-display text-3xl font-semibold text-ink-900 sm:text-4xl">
              {song?.title ?? "Nada suena todavía"}
            </h2>
            {song && <p className="mt-1 text-base text-ink-700">{song.artist}</p>}
          </motion.div>
        </AnimatePresence>

        <motion.div
          className="flex items-center gap-4"
          animate={{ opacity: controlsVisible ? 1 : 0 }}
          transition={{ duration: 0.5 }}
        >
          <IconButton label="Canción anterior" onClick={onPrev} disabled={!song}>
            <SkipPrevIcon className="size-6" />
          </IconButton>
          <IconButton
            label={isPlaying ? "Pausar" : "Reproducir"}
            tone="primary"
            size="lg"
            onClick={onToggle}
            disabled={!song}
          >
            {isPlaying ? <PauseIcon className="size-7" /> : <PlayIcon className="size-7" />}
          </IconButton>
          <IconButton label="Siguiente canción" onClick={onNext} disabled={!song}>
            <SkipNextIcon className="size-6" />
          </IconButton>
        </motion.div>
      </div>
    </motion.div>
  );
}
