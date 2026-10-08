import { AnimatePresence, motion, Reorder } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { formatSongCount, formatTotalDuration } from "../lib/format";
import type { InsertPosition, PlaylistSummary, Song } from "../types";
import { MusicNoteIcon, UploadIcon } from "./icons";
import { PlaylistSwitcher } from "./PlaylistSwitcher";
import { SongRow } from "./SongRow";

interface PlaylistPanelProps {
  playlists: PlaylistSummary[];
  activePlaylistId: string;
  isShuffled: boolean;
  songs: Song[];
  currentId: string | null;
  isPlaying: boolean;
  totalDurationSeconds: number;
  isUploading: boolean;
  /** 0..1 while uploading, null otherwise. */
  uploadProgress: number | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  /** Resolves to true when the backend accepted the new position. */
  onMove: (id: string, toIndex: number) => Promise<boolean>;
  onUpload: (files: File[], where: InsertPosition) => void;
  onSwitchPlaylist: (id: string) => void;
  onRequestCreate: () => void;
  onRequestDelete: (playlist: PlaylistSummary) => void;
}

const uploadButtonClass =
  "inline-flex items-center gap-1.5 rounded-full border border-sage-300 bg-sand-50 px-3.5 py-2 text-sm font-semibold text-sage-800 transition-colors duration-200 hover:bg-sage-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lavender-500 disabled:cursor-wait disabled:opacity-50";

export function PlaylistPanel({
  playlists,
  activePlaylistId,
  isShuffled,
  songs,
  currentId,
  isPlaying,
  totalDurationSeconds,
  isUploading,
  uploadProgress,
  onSelect,
  onRemove,
  onMove,
  onUpload,
  onSwitchPlaylist,
  onRequestCreate,
  onRequestDelete,
}: PlaylistPanelProps) {
  // `ordered` is the order shown while dragging. It resets to the server's order whenever the
  // server sends a new list (derive-state-during-render pattern, no extra effect/flicker).
  const [previousSongs, setPreviousSongs] = useState(songs);
  const [ordered, setOrdered] = useState(songs);
  if (songs !== previousSongs) {
    setPreviousSongs(songs);
    setOrdered(songs);
  }
  const orderedRef = useRef(ordered);
  useEffect(() => {
    orderedRef.current = ordered;
  }, [ordered]);

  const [announcement, setAnnouncement] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingPositionRef = useRef<InsertPosition>("end");

  const openPicker = (where: InsertPosition) => {
    pendingPositionRef.current = where;
    fileInputRef.current?.click();
  };

  /** Drop: if the dragged row ended in a new index, ask the backend to move the node. */
  const handleDrop = async (songId: string) => {
    const toIndex = orderedRef.current.findIndex((song) => song.id === songId);
    const fromIndex = songs.findIndex((song) => song.id === songId);
    if (toIndex === -1 || toIndex === fromIndex) return;

    const accepted = await onMove(songId, toIndex);
    if (accepted) {
      const title = songs[fromIndex]?.title ?? "La canción";
      setAnnouncement(`${title} se movió a la posición ${toIndex + 1} de ${songs.length}.`);
    } else {
      setOrdered(songs); // revert the visual order
    }
  };

  const handleKeyboardMove = async (songId: string, direction: -1 | 1) => {
    const fromIndex = songs.findIndex((song) => song.id === songId);
    const toIndex = fromIndex + direction;
    if (fromIndex === -1 || toIndex < 0 || toIndex >= songs.length) return;
    const accepted = await onMove(songId, toIndex);
    if (accepted) {
      setAnnouncement(`${songs[fromIndex].title} se movió a la posición ${toIndex + 1} de ${songs.length}.`);
    }
  };

  return (
    <section
      aria-label="Lista de reproducción"
      className="rounded-3xl border border-sand-200 bg-sand-50 p-5 shadow-soft sm:p-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <PlaylistSwitcher
            playlists={playlists}
            activeId={activePlaylistId}
            onSwitch={onSwitchPlaylist}
            onCreate={onRequestCreate}
            onDelete={onRequestDelete}
          />
          <p className="mt-1 flex items-center gap-2 text-sm text-ink-500">
            <span>
              {formatSongCount(songs.length)}
              {songs.length > 0 && ` · ${formatTotalDuration(totalDurationSeconds)}`}
            </span>
            {isShuffled && (
              <span className="rounded-full bg-lavender-100 px-2 py-0.5 text-[11px] font-semibold text-ink-700">
                Mezclada
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp3,audio/mpeg"
            multiple
            tabIndex={-1}
            className="sr-only"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = ""; // lets the user pick the same file again later
              if (files.length > 0) onUpload(files, pendingPositionRef.current);
            }}
          />
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            disabled={isUploading}
            onClick={() => openPicker("start")}
            className={uploadButtonClass}
          >
            <UploadIcon className="size-4" />
            {isUploading ? "Subiendo…" : "MP3 al inicio"}
          </motion.button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            disabled={isUploading}
            onClick={() => openPicker("end")}
            className={uploadButtonClass}
          >
            <UploadIcon className="size-4" />
            {isUploading ? "Subiendo…" : "MP3 al final"}
          </motion.button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isUploading && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
            role="status"
          >
            <div className="mt-4 flex items-center justify-between text-xs font-medium text-ink-500">
              <span>{(uploadProgress ?? 0) >= 1 ? "Procesando archivos…" : "Subiendo archivos…"}</span>
              <span className="tabular-nums">{Math.round((uploadProgress ?? 0) * 100)}%</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sage-200">
              <motion.div
                className="h-full rounded-full bg-sage-600"
                animate={{ width: `${Math.round((uploadProgress ?? 0) * 100)}%` }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-5">
        {/* popLayout takes leaving rows out of the flow, so the rest closes the gap smoothly. */}
        <Reorder.Group as="ul" axis="y" values={ordered} onReorder={setOrdered} className="relative">
          <AnimatePresence mode="popLayout" initial={false}>
            {ordered.map((song, index) => (
              <SongRow
                key={song.id}
                song={song}
                index={index}
                isCurrent={song.id === currentId}
                isPlaying={isPlaying}
                onSelect={onSelect}
                onRemove={onRemove}
                onDrop={handleDrop}
                onKeyboardMove={handleKeyboardMove}
              />
            ))}
          </AnimatePresence>
        </Reorder.Group>

        <AnimatePresence>
          {songs.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, delay: 0.15 }}
              className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-sage-300 px-6 py-12 text-center"
            >
              <MusicNoteIcon className="size-9 text-sage-400" />
              <p className="font-display text-xl font-semibold text-ink-700">Tu lista está vacía</p>
              <p className="max-w-xs text-sm text-ink-500">
                Sube uno o varios archivos MP3, o arrástralos a cualquier parte de la página.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </section>
  );
}
