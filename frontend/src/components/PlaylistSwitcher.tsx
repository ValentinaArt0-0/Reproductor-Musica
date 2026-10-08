import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { formatSongCount } from "../lib/format";
import type { PlaylistSummary } from "../types";
import { IconButton } from "./IconButton";
import { CheckIcon, ChevronDownIcon, PlusIcon, TrashIcon } from "./icons";

interface PlaylistSwitcherProps {
  playlists: PlaylistSummary[];
  activeId: string;
  onSwitch: (id: string) => void;
  onCreate: () => void;
  onDelete: (playlist: PlaylistSummary) => void;
}

/** The playlist's title doubles as a button that opens the list of playlists. */
export function PlaylistSwitcher({
  playlists,
  activeId,
  onSwitch,
  onCreate,
  onDelete,
}: PlaylistSwitcherProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const active = playlists.find((playlist) => playlist.id === activeId);

  // Close on outside click or Esc.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative min-w-0">
      <h2 className="min-w-0">
        <button
          ref={buttonRef}
          type="button"
          data-focus-fallback="playlist-switcher"
          aria-haspopup="true"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="-ml-2 inline-flex max-w-full items-center gap-2 rounded-2xl px-2 py-1 font-display text-3xl font-semibold text-ink-900 transition-colors hover:bg-sage-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lavender-500"
        >
          <span className="truncate">{active?.name ?? "Mi lista"}</span>
          <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} className="flex">
            <ChevronDownIcon className="size-5 shrink-0 text-sage-700" />
          </motion.span>
          <span className="sr-only">: cambiar de lista</span>
        </button>
      </h2>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="absolute left-0 top-full z-30 mt-2 w-[min(24rem,calc(100vw-3rem))] origin-top-left rounded-2xl border border-sand-200 bg-sand-50 p-2 shadow-lift"
          >
            <ul aria-label="Tus listas" className="max-h-72 space-y-0.5 overflow-y-auto">
              {playlists.map((playlist) => {
                const isActive = playlist.id === activeId;
                return (
                  <li
                    key={playlist.id}
                    className={`flex items-center gap-1 rounded-xl pr-1 ${isActive ? "bg-sage-100" : "hover:bg-sand-100"}`}
                  >
                    <button
                      type="button"
                      aria-current={isActive ? "true" : undefined}
                      onClick={() => {
                        setOpen(false);
                        onSwitch(playlist.id);
                      }}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2.5 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-lavender-500"
                    >
                      <span className="flex size-5 shrink-0 items-center justify-center text-sage-700">
                        {isActive && <CheckIcon className="size-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold text-ink-800">
                          {playlist.name}
                        </span>
                        <span className="block text-xs text-ink-500">{formatSongCount(playlist.songCount)}</span>
                      </span>
                    </button>
                    <IconButton
                      label={`Eliminar la lista ${playlist.name}`}
                      tone="danger"
                      size="sm"
                      onClick={() => {
                        setOpen(false);
                        onDelete(playlist);
                      }}
                    >
                      <TrashIcon className="size-[18px]" />
                    </IconButton>
                  </li>
                );
              })}
            </ul>
            <div className="mt-1 border-t border-sand-200 pt-1">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onCreate();
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] font-semibold text-sage-800 transition-colors hover:bg-sage-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-lavender-500"
              >
                <PlusIcon className="size-5 shrink-0" />
                Nueva lista
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
