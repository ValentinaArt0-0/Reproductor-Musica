import "dotenv/config";
import path from "node:path";

export type SearchProviderName = "youtube" | "mock";

export interface AppConfig {
  port: number;
  /** Comma-separated list of allowed frontend origins. */
  clientOrigin: string;
  searchProvider: SearchProviderName;
  uploadDir: string;
  dataDir: string;
  maxUploadBytes: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const requested = (env.SEARCH_PROVIDER ?? "").trim().toLowerCase() || "auto";

  if (!["auto", "youtube", "mock", "itunes"].includes(requested)) {
    throw new Error(`SEARCH_PROVIDER must be "auto", "youtube" or "mock" (got "${requested}")`);
  }
  const searchProvider: SearchProviderName =
    requested === "auto" || requested === "itunes"
      ? "youtube"
      : (requested as SearchProviderName);

  return {
    port: Number(env.PORT ?? 4000),
    clientOrigin: env.CLIENT_ORIGIN ?? "http://localhost:3000",
    searchProvider,
    uploadDir: path.resolve(env.UPLOAD_DIR ?? "uploads"),
    dataDir: path.resolve(env.DATA_DIR ?? "data"),
    maxUploadBytes: Number(env.MAX_UPLOAD_MB ?? 50) * 1024 * 1024,
  };
}
