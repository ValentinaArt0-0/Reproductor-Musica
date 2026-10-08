import type { SearchProvider, SearchResult } from "./types";

interface MockTrack {
  id: string;
  title: string;
  artist: string;
  durationSeconds: number;
}

const CATALOG: MockTrack[] = [
  { id: "m01", title: "Brisa de Montaña", artist: "Luna Verde", durationSeconds: 214 },
  { id: "m02", title: "Té de Jazmín", artist: "Luna Verde", durationSeconds: 187 },
  { id: "m03", title: "Atardecer en Pasto", artist: "Altiplano Ensemble", durationSeconds: 242 },
  { id: "m04", title: "Niebla Suave", artist: "Altiplano Ensemble", durationSeconds: 199 },
  { id: "m05", title: "Café con Lluvia", artist: "Sala de Estar", durationSeconds: 176 },
  { id: "m06", title: "Lavanda", artist: "Sala de Estar", durationSeconds: 231 },
  { id: "m07", title: "Horizonte Lento", artist: "Marea Tranquila", durationSeconds: 268 },
  { id: "m08", title: "Arena y Sal", artist: "Marea Tranquila", durationSeconds: 205 },
  { id: "m09", title: "Páramo", artist: "Cumbre Azul", durationSeconds: 222 },
  { id: "m10", title: "Luciérnagas", artist: "Cumbre Azul", durationSeconds: 193 },
  { id: "m11", title: "Brisa Marina", artist: "Marea Tranquila", durationSeconds: 211 },
  { id: "m12", title: "Sendero de Cedro", artist: "Luna Verde", durationSeconds: 254 },
];

const normalize = (text: string): string =>
  text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/**
 * Offline provider for development and tests. Its results are NOT playable audio
 * (the uri is a "mock:" reference); they only exercise the search -> add-to-playlist flow.
 */
export class MockSearchProvider implements SearchProvider {
  readonly name = "mock";

  async search(query: string, limit: number): Promise<SearchResult[]> {
    const tokens = normalize(query).split(/\s+/).filter(Boolean);

    return CATALOG.filter((track) => {
      const haystack = normalize(`${track.title} ${track.artist}`);
      return tokens.every((token) => haystack.includes(token));
    })
      .slice(0, limit)
      .map((track) => ({
        externalId: track.id,
        title: track.title,
        artist: track.artist,
        durationSeconds: track.durationSeconds,
        source: "web" as const,
        uri: `mock:${track.id}`,
        provider: this.name,
      }));
  }
}
