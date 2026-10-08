import type { SearchProvider, SearchResult } from "./types";

interface CacheEntry {
  expiresAt: number;
  results: SearchResult[];
}

/** Decorator that remembers recent searches to save external API quota. */
export class CachedSearchProvider implements SearchProvider {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly inner: SearchProvider,
    private readonly ttlMs = 10 * 60 * 1000,
    private readonly maxEntries = 100,
  ) {}

  get name(): string {
    return this.inner.name;
  }

  async search(query: string, limit: number): Promise<SearchResult[]> {
    const key = `${query.trim().toLowerCase()}|${limit}`;
    const hit = this.cache.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.results;

    const results = await this.inner.search(query, limit);
    this.cache.set(key, { results, expiresAt: Date.now() + this.ttlMs });

    if (this.cache.size > this.maxEntries) {
      const oldestKey = this.cache.keys().next().value as string;
      this.cache.delete(oldestKey);
    }
    return results;
  }
}
