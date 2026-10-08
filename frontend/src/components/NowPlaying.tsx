import { AnimatePresence, motion } from "framer-motion";
import type { Song } from "../types";
import { getYouTubeId } from "../lib/song";
import { Cover } from "./Cover";

interface NowPlayingProps {
  song: Song | null;
  isPlaying: boolean;
}

/** Large "now playing" card showing the album cover (or a calm placeholder). */
export function NowPlaying({ song, isPlaying }: NowPlayingProps) {
  return (
    <section
      aria-label="Ahora suena"
      className="rounded-3xl border border-sand-200 bg-sand-50 p-5 shadow-soft lg:sticky lg:top-8 lg:self-start"
    >
      <motion.div
        animate={{ scale: isPlaying ? 1 : 0.97 }}
        transition={{ type: "spring", stiffness: 120, damping: 18 }}
      >
        <Cover
          key={song?.id ?? "none"}
          src={song?.coverUrl}
          className="aspect-square w-full rounded-2xl shadow-soft"
          iconClassName="size-1/3"
        />
      </motion.div>

      <div className="mt-5 min-h-[4.5rem]">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sage-700">
          Ahora suena
        </p>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={song?.id ?? "empty"}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
          >
            {song ? (
              <>
                <h2 className="mt-1 truncate font-display text-2xl font-semibold text-ink-900">
                  {song.title}
                </h2>
                <p className="mt-0.5 flex items-center gap-2 truncate text-sm text-ink-500">
                  {song.artist}
                  <span className="rounded-full bg-lavender-100 px-2 py-0.5 text-[11px] font-semibold text-lavender-500">
                    {song.source === "local"
                      ? "Local"
                      : getYouTubeId(song)
                        ? "YouTube"
                        : "Web"}
                  </span>
                </p>
              </>
            ) : (
              <h2 className="mt-1 font-display text-2xl font-semibold text-ink-500">
                Nada suena todavía
              </h2>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
