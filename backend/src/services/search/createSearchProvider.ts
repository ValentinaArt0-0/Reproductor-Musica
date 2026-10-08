import type { AppConfig } from "../../config/env";
import { CachedSearchProvider } from "./CachedSearchProvider";
import { MockSearchProvider } from "./MockSearchProvider";
import type { SearchProvider } from "./types";
import { YouTubeSearchProvider } from "./YouTubeSearchProvider";

/** Picks the catalogue integration from configuration. */
export function createSearchProvider(config: AppConfig): SearchProvider {
  switch (config.searchProvider) {
    case "youtube":
      return new CachedSearchProvider(new YouTubeSearchProvider());
    case "mock":
      return new MockSearchProvider();
  }
}
