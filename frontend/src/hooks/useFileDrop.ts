import { useEffect, useRef, useState } from "react";

/**
 * Lets the user drop files anywhere on the page. It also stops the browser from opening a
 * file that is dropped outside the app, which would navigate away and stop the music.
 * Only native file drags are handled, so the playlist's own drag & drop is not affected.
 */
export function useFileDrop(onFiles: (files: File[]) => void, enabled: boolean): boolean {
  const [isOver, setIsOver] = useState(false);
  const onFilesRef = useRef(onFiles);
  const enabledRef = useRef(enabled);
  useEffect(() => {
    onFilesRef.current = onFiles;
    enabledRef.current = enabled;
  }, [onFiles, enabled]);

  useEffect(() => {
    let depth = 0; // dragenter/dragleave fire for every child element
    const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes("Files");

    const onEnter = (event: DragEvent) => {
      if (!hasFiles(event) || !enabledRef.current) return;
      depth += 1;
      setIsOver(true);
    };
    const onOver = (event: DragEvent) => {
      if (hasFiles(event)) event.preventDefault(); // required for the drop event to fire
    };
    const onLeave = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setIsOver(false);
    };
    const onDrop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth = 0;
      setIsOver(false);
      if (!enabledRef.current) return;
      const files = Array.from(event.dataTransfer?.files ?? []);
      if (files.length > 0) onFilesRef.current(files);
    };

    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  return isOver;
}
