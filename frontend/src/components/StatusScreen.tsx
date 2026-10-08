import { motion } from "framer-motion";
import { MusicNoteIcon } from "./icons";

interface StatusScreenProps {
  kind: "loading" | "error";
  message?: string | null;
  onRetry?: () => void;
}

/** Full-page state shown while the playlist loads or when the backend cannot be reached. */
export function StatusScreen({ kind, message, onRetry }: StatusScreenProps) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <motion.div
        animate={kind === "loading" ? { opacity: [0.4, 1, 0.4] } : { opacity: 1 }}
        transition={{ duration: 2, repeat: kind === "loading" ? Infinity : 0, ease: "easeInOut" }}
        className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-lavender-200 to-sage-300 text-sage-700"
      >
        <MusicNoteIcon className="size-8" />
      </motion.div>

      {kind === "loading" ? (
        <p className="font-display text-xl font-semibold text-ink-700">Preparando tu música…</p>
      ) : (
        <>
          <h1 className="font-display text-2xl font-semibold text-ink-900">
            No pudimos cargar tu lista
          </h1>
          <p className="max-w-sm text-sm text-ink-500">{message}</p>
          <p className="max-w-sm text-xs text-ink-500">
            Si estás en desarrollo, abre otra terminal en la carpeta <code>backend</code> y ejecuta{" "}
            <code>npm run dev</code>.
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-full bg-sage-700 px-5 py-2.5 text-sm font-semibold text-sand-50 shadow-lift transition-colors hover:bg-sage-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lavender-500"
          >
            Reintentar
          </button>
        </>
      )}
    </div>
  );
}
