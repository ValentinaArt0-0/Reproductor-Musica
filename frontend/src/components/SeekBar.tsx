import { useEffect, useRef, useState, type CSSProperties } from "react";
import { formatTime } from "../lib/format";

interface SeekBarProps {
  value: number;
  max: number;
  onSeek: (seconds: number) => void;
  disabled?: boolean;
}

/**
 * Time slider (native range input: keyboard and screen-reader friendly).
 *
 * - Dragging with the pointer only previews the new time; the player is moved once,
 *   when the pointer is released (no stutter from seeking on every pixel).
 * - Keyboard (arrows, Home, End) seeks immediately.
 */
export function SeekBar({ value, max, onSeek, disabled = false }: SeekBarProps) {
  const [dragValue, setDragValue] = useState<number | null>(null);
  const draggingRef = useRef(false);
  const pendingRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const onSeekRef = useRef(onSeek);
  useEffect(() => {
    onSeekRef.current = onSeek;
  }, [onSeek]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const shown = Math.min(dragValue ?? value, max);
  const percent = max > 0 ? (shown / max) * 100 : 0;
  const isDisabled = disabled || max <= 0;

  const finishDrag = () => {
    abortRef.current?.abort();
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const target = pendingRef.current;
    pendingRef.current = null;
    setDragValue(null);
    if (target !== null) onSeekRef.current(target);
  };

  const startDrag = () => {
    draggingRef.current = true;
    // Listen on window: the pointer may be released outside the slider.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    window.addEventListener("pointerup", finishDrag, { signal: controller.signal });
    window.addEventListener("pointercancel", finishDrag, { signal: controller.signal });
  };

  return (
    <div className="flex items-center gap-3 text-xs font-medium tabular-nums text-ink-500">
      <span className="w-10 text-right">{formatTime(shown)}</span>
      <input
        type="range"
        className="seek flex-1"
        min={0}
        max={max > 0 ? max : 1}
        step={0.1}
        value={shown}
        disabled={isDisabled}
        onPointerDown={startDrag}
        onChange={(event) => {
          const seconds = Number(event.target.value);
          if (draggingRef.current) {
            pendingRef.current = seconds;
            setDragValue(seconds);
          } else {
            onSeek(seconds);
          }
        }}
        style={{ "--progress": `${percent}%` } as CSSProperties}
        aria-label="Posición de la canción"
        aria-valuetext={`${formatTime(shown)} de ${formatTime(max)}`}
      />
      <span className="w-10">{formatTime(max)}</span>
    </div>
  );
}
