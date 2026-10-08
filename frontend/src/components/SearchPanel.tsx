import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useSongSearch } from "../hooks/useSongSearch";
import { formatTime } from "../lib/format";
import type { InsertPosition, SearchResult } from "../types";
import { Cover } from "./Cover";
import { CloseIcon, SearchIcon } from "./icons";

interface SearchPanelProps {
  /** Resolves to true when the song was added. */
  onAdd: (result: SearchResult, where: InsertPosition) => Promise<boolean>;
}

const pillClass =
  "rounded-full border border-sage-300 px-3 py-1.5 text-xs font-semibold text-sage-800 transition-colors duration-200 hover:bg-sage-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lavender-500 disabled:cursor-wait disabled:opacity-50";

/** Web search: a compact input that expands into results while the user types. */
export function SearchPanel({ onAdd }: SearchPanelProps) {
  const { query, setQuery, status, results, provider, error, isActive } = useSongSearch();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [addedKey, setAddedKey] = useState<string | null>(null);
  const addedTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(addedTimer.current), []);

  const handleAdd = async (result: SearchResult, where: InsertPosition) => {
    const key = `${result.uri}|${where}`;
    setPendingKey(key);
    const added = await onAdd(result, where);
    setPendingKey(null);
    if (!added) return;
    setAddedKey(key);
    window.clearTimeout(addedTimer.current);
    addedTimer.current = window.setTimeout(() => setAddedKey(null), 1800);
  };

  const isLoading = status === "loading";
  const showSkeleton = isLoading && results.length === 0;

  return (
    <section
      aria-label="Buscar canciones en la web"
      className="rounded-3xl border border-sand-200 bg-sand-50 p-4 shadow-soft sm:p-5"
    >
      <div className="relative">
        <label htmlFor="song-search" className="sr-only">
          Buscar canciones en la web
        </label>
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-sage-500" />
        <input
          id="song-search"
          type="search"
          value={query}
          autoComplete="off"
          placeholder="Buscar canciones en la web…"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setQuery("");
          }}
          className="w-full rounded-full border border-sand-300 bg-sand-100 py-3 pl-12 pr-11 text-[15px] text-ink-800 placeholder:text-ink-500 focus-visible:border-sage-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lavender-500 [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            aria-label="Borrar búsqueda"
            onClick={() => setQuery("")}
            className="absolute right-2.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-ink-500 transition-colors hover:bg-sage-200/70 focus-visible:outline-2 focus-visible:outline-lavender-500"
          >
            <CloseIcon className="size-4" />
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {isActive && (
          <motion.div
            key="results"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="pt-3" aria-live="polite" aria-busy={isLoading}>
              {showSkeleton && (
                <ul aria-label="Buscando…" className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <li key={i} className="flex animate-pulse items-center gap-3 px-2 py-2">
                      <div className="size-11 rounded-lg bg-sage-200" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-1/2 rounded-full bg-sage-200" />
                        <div className="h-3 w-1/3 rounded-full bg-sand-200" />
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {status === "error" && (
                <p className="rounded-2xl border border-clay-500/40 bg-clay-100 px-4 py-3 text-sm text-ink-900">
                  {error}
                </p>
              )}

              {status === "done" && results.length === 0 && (
                <p className="px-2 py-4 text-center text-sm text-ink-500">
                  No encontramos canciones para “{query.trim()}”.
                </p>
              )}

              {results.length > 0 && (
                <ul className={`transition-opacity duration-200 ${isLoading ? "opacity-50" : "opacity-100"}`}>
                  <AnimatePresence initial={false}>
                    {results.map((result) => (
                      <motion.li
                        key={result.uri}
                        layout="position"
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-sand-100"
                      >
                        <Cover
                          src={result.thumbnailUrl}
                          className="size-11 shrink-0 rounded-lg"
                          iconClassName="size-5"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-ink-800">{result.title}</p>
                          <p className="truncate text-xs text-ink-500">
                            {result.artist}
                            {result.durationSeconds > 0 && ` · ${formatTime(result.durationSeconds)}`}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-1.5">
                          {(["start", "end"] as const).map((where) => {
                            const key = `${result.uri}|${where}`;
                            const label = where === "start" ? "+ Inicio" : "+ Final";
                            return (
                              <button
                                key={where}
                                type="button"
                                disabled={pendingKey === key}
                                onClick={() => void handleAdd(result, where)}
                                aria-label={`Agregar ${result.title} al ${where === "start" ? "inicio" : "final"} de la lista`}
                                className={pillClass}
                              >
                                {pendingKey === key ? "…" : addedKey === key ? "Agregada ✓" : label}
                              </button>
                            );
                          })}
                        </div>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}

              {provider && results.length > 0 && (
                <p className="px-2 pt-2 text-xs text-ink-500">
                  {provider === "mock"
                    ? "Catálogo de demostración: son canciones de ejemplo, sin audio."
                    : "Resultados de YouTube: reproduce las canciones completas."}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
