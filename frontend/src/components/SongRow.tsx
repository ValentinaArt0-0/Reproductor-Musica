import { Reorder, useDragControls } from "framer-motion";
import { forwardRef, useRef, useState, type KeyboardEvent } from "react";
import { formatTime } from "../lib/format";
import type { Song } from "../types";
import { Equalizer } from "./Equalizer";
import { IconButton } from "./IconButton";
import { GripIcon, TrashIcon } from "./icons";

interface SongRowProps {
  song: Song;
  index: number;
  isCurrent: boolean;
  isPlaying: boolean;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  /** Called when a drag ends; the panel decides if the position really changed. */
  onDrop: (id: string) => void;
  /** Keyboard alternative to dragging: -1 moves up, +1 moves down. */
  onKeyboardMove: (id: string, direction: -1 | 1) => Promise<void>;
}

/**
 * One playlist row. Reorder.Item gives drag-to-reorder plus the layout animation that makes
 * the siblings glide when a row is added, removed or moved. It forwards its ref because
 * AnimatePresence (popLayout) must measure the row that is leaving. Dragging starts ONLY from the
 * grip handle, so clicking the title (play) and the trash button keep working.
 */
export const SongRow = forwardRef<HTMLLIElement, SongRowProps>(function SongRow(
  { song, index, isCurrent, isPlaying, onSelect, onRemove, onDrop, onKeyboardMove },
  ref,
) {
  const controls = useDragControls();
  const [isDragging, setIsDragging] = useState(false);
  const handleRef = useRef<HTMLButtonElement>(null);

  const handleKeyDown = async (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    await onKeyboardMove(song.id, event.key === "ArrowUp" ? -1 : 1);
    // Moving the DOM node can drop focus: put it back so the user can keep going.
    requestAnimationFrame(() => handleRef.current?.focus());
  };

  return (
    <Reorder.Item
      ref={ref}
      as="li"
      value={song}
      dragListener={false}
      dragControls={controls}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={() => {
        setIsDragging(false);
        onDrop(song.id);
      }}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, x: -28, scale: 0.97, transition: { duration: 0.2, ease: "easeIn" } }}
      transition={{ type: "spring", stiffness: 420, damping: 36, mass: 0.9 }}
      whileDrag={{ scale: 1.02 }}
      className="relative select-none py-0.5"
    >
      <div
        className={`group flex items-center rounded-2xl pr-1.5 transition-[background-color,box-shadow] duration-200 ${
          isDragging
            ? "bg-sand-50 shadow-lift ring-1 ring-sage-300"
            : isCurrent
              ? "bg-sage-100 ring-1 ring-sage-200"
              : "hover:bg-sand-100"
        }`}
      >
        <button
          ref={handleRef}
          type="button"
          onPointerDown={(event) => controls.start(event)}
          onKeyDown={handleKeyDown}
          aria-label={`Reordenar ${song.title}. Arrastra, o usa las flechas arriba y abajo.`}
          title="Arrastra para reordenar"
          className={`flex h-11 w-9 shrink-0 touch-none items-center justify-center rounded-xl pl-1 text-sage-400 transition-colors hover:text-ink-700 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-lavender-500 ${
            isDragging ? "cursor-grabbing text-ink-700" : "cursor-grab"
          }`}
        >
          <GripIcon className="size-5" />
        </button>

        <button
          type="button"
          onClick={() => onSelect(song.id)}
          aria-current={isCurrent ? "true" : undefined}
          aria-label={`Reproducir ${song.title} de ${song.artist}`}
          className="flex min-w-0 flex-1 items-center gap-4 rounded-2xl py-3 pl-2 pr-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-lavender-500"
        >
          <span className="flex w-5 shrink-0 justify-center text-sm font-medium tabular-nums text-ink-500">
            {isCurrent ? <Equalizer playing={isPlaying} /> : index + 1}
          </span>
          <span className="min-w-0 flex-1">
            <span
              className={`block truncate text-[15px] font-semibold ${
                isCurrent ? "text-sage-800" : "text-ink-800"
              }`}
            >
              {song.title}
            </span>
            <span className="block truncate text-sm text-ink-500">{song.artist}</span>
          </span>
          <span className="shrink-0 text-sm tabular-nums text-ink-500">
            {formatTime(song.durationSeconds)}
          </span>
        </button>

        {/* Always visible on touch screens, revealed on hover/focus on desktop. */}
        <div className="transition-opacity duration-200 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100">
          <IconButton
            label={`Eliminar ${song.title}`}
            tone="danger"
            size="sm"
            onClick={() => onRemove(song.id)}
          >
            <TrashIcon className="size-[18px]" />
          </IconButton>
        </div>
      </div>
    </Reorder.Item>
  );
});
