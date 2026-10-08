import type {
  InsertPosition,
  NewSongInput,
  PlaybackState,
  PlaylistDetail,
  PlaylistSummary,
  SearchResponse,
  Song,
  UploadResponse,
} from "../types";

/** The Vite dev server proxies /api and /media to the Express backend. */
const CONNECTION_MESSAGE =
  "No se pudo conectar con el servidor. Revisa que el backend esté encendido.";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ErrorBody {
  error?: { message?: string; code?: string };
}

/** Prefers the backend's Spanish message; a 5xx without it means the proxy cannot reach the server. */
function buildError(status: number, body: ErrorBody | null): ApiError {
  const message =
    body?.error?.message ??
    (status >= 500 ? CONNECTION_MESSAGE : "Ocurrió un error inesperado.");
  return new ApiError(message, status, body?.error?.code);
}

const isAbort = (error: unknown): boolean =>
  error instanceof DOMException && error.name === "AbortError";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch (error) {
    if (isAbort(error)) throw error; // cancelled on purpose (e.g. a newer search): not a failure
    throw new ApiError(CONNECTION_MESSAGE, 0, "NETWORK");
  }

  if (!response.ok) {
    let body: ErrorBody | null = null;
    try {
      body = (await response.json()) as ErrorBody;
    } catch {
      // Not our JSON error shape (e.g. the dev proxy answering 500 because the backend is down).
    }
    throw buildError(response.status, body);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: body === undefined ? undefined : { "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

// ---- Playlists ----------------------------------------------------------------
export const listPlaylists = () => request<{ playlists: PlaylistSummary[] }>("/api/playlists");

export const createPlaylist = (name: string) =>
  request<{ playlist: PlaylistDetail }>("/api/playlists", json("POST", { name }));

export const getPlaylist = (id: string) =>
  request<{ playlist: PlaylistDetail }>(`/api/playlists/${id}`);

export const deletePlaylist = (id: string) =>
  request<void>(`/api/playlists/${id}`, json("DELETE"));

// ---- Smart Shuffle (the backend re-links the nodes of the doubly linked list) -----------
export const shufflePlaylist = (id: string) =>
  request<{ playlist: PlaylistDetail }>(`/api/playlists/${id}/shuffle`, json("POST"));

export const restorePlaylistOrder = (id: string) =>
  request<{ playlist: PlaylistDetail }>(`/api/playlists/${id}/restore-order`, json("POST"));

// ---- Songs (linked list operations) ---------------------------------------------
export const addSong = (playlistId: string, song: NewSongInput, position: InsertPosition) =>
  request<{ song: Song; playlist: PlaylistDetail }>(
    `/api/playlists/${playlistId}/songs`,
    json("POST", { song, position }),
  );

export const removeSong = (playlistId: string, songId: string) =>
  request<{ playlist: PlaylistDetail }>(
    `/api/playlists/${playlistId}/songs/${songId}`,
    json("DELETE"),
  );

export const moveSong = (playlistId: string, songId: string, toIndex: number) =>
  request<{ playlist: PlaylistDetail }>(
    `/api/playlists/${playlistId}/songs/${songId}/move`,
    json("POST", { toIndex }),
  );

// ---- Navigation -------------------------------------------------------------------
export const nextSong = (playlistId: string) =>
  request<PlaybackState>(`/api/playlists/${playlistId}/next`, json("POST"));

export const previousSong = (playlistId: string) =>
  request<PlaybackState>(`/api/playlists/${playlistId}/prev`, json("POST"));

export const setCurrentSong = (playlistId: string, songId: string) =>
  request<PlaybackState>(`/api/playlists/${playlistId}/current`, json("PUT", { songId }));

// ---- Search ---------------------------------------------------------------------------
export const searchSongs = (query: string, limit: number, signal?: AbortSignal) =>
  request<SearchResponse>(`/api/search?${new URLSearchParams({ q: query, limit: String(limit) })}`, {
    signal,
  });

// ---- Uploads ----------------------------------------------------------------------------
/**
 * Uploads MP3 files. With `onProgress` it uses XMLHttpRequest, because fetch cannot report
 * upload progress; without it (or outside a browser) it uses fetch.
 */
export function uploadFiles(
  playlistId: string,
  files: File[],
  position: InsertPosition,
  onProgress?: (fraction: number) => void,
): Promise<UploadResponse> {
  const form = new FormData();
  form.append("playlistId", playlistId);
  form.append("position", position);
  for (const file of files) form.append("files", file);

  if (!onProgress || typeof XMLHttpRequest === "undefined") {
    return request<UploadResponse>("/api/uploads", { method: "POST", body: form });
  }

  return new Promise<UploadResponse>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/uploads");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onerror = () => reject(new ApiError(CONNECTION_MESSAGE, 0, "NETWORK"));
    xhr.onload = () => {
      let body: unknown = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // keep null
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body as UploadResponse);
      else reject(buildError(xhr.status, body as ErrorBody | null));
    };
    xhr.send(form);
  });
}

// ---- First load -----------------------------------------------------------------------------
export const DEFAULT_PLAYLIST_NAME = "Tarde tranquila";

export const toSummary = (playlist: PlaylistDetail): PlaylistSummary => ({
  id: playlist.id,
  name: playlist.name,
  songCount: playlist.songCount,
  totalDurationSeconds: playlist.totalDurationSeconds,
});

export interface InitialState {
  playlists: PlaylistSummary[];
  playlist: PlaylistDetail;
}

let bootstrap: Promise<InitialState> | null = null;

/**
 * Loads every playlist plus the one to show: the remembered one if it still exists, else the
 * first, else a new default (fresh install). The promise is shared so React StrictMode's
 * double effect in development cannot create the default playlist twice.
 */
export function loadInitialState(preferredId: string | null): Promise<InitialState> {
  bootstrap ??= (async () => {
    const { playlists } = await listPlaylists();
    if (playlists.length === 0) {
      const { playlist } = await createPlaylist(DEFAULT_PLAYLIST_NAME);
      return { playlists: [toSummary(playlist)], playlist };
    }
    const chosen = playlists.find((p) => p.id === preferredId) ?? playlists[0];
    const { playlist } = await getPlaylist(chosen.id);
    return { playlists, playlist };
  })().catch((error: unknown) => {
    bootstrap = null;
    throw error;
  });
  return bootstrap;
}

export function resetBootstrap(): void {
  bootstrap = null;
}
