import { useEffect, useState } from "react";
import * as api from "../lib/api";
import { messageOf } from "../lib/errors";
import type { SearchResult } from "../types";

const DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 2; // saves provider quota (YouTube charges 100 units per search)
const RESULT_LIMIT = 8;

export type SearchStatus = "idle" | "loading" | "done" | "error";

interface SearchState {
  status: SearchStatus;
  results: SearchResult[];
  provider: string | null;
  error: string | null;
}

const IDLE: SearchState = { status: "idle", results: [], provider: null, error: null };

/**
 * Debounced search. Typing cancels the previous request (AbortController), and the previous
 * results stay on screen (dimmed) while the next ones load, so the list never flashes empty.
 */
export function useSongSearch() {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>(IDLE);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setState(IDLE);
      return;
    }

    setState((previous) => ({ ...previous, status: "loading", error: null }));
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await api.searchSongs(trimmed, RESULT_LIMIT, controller.signal);
        setState({ status: "done", results: response.results, provider: response.provider, error: null });
      } catch (error) {
        if (controller.signal.aborted) return;
        setState({ status: "error", results: [], provider: null, error: messageOf(error) });
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return { query, setQuery, ...state, isActive: query.trim().length >= MIN_QUERY_LENGTH };
}
