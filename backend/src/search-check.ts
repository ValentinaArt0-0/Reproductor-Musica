import { loadConfig } from "./config/env";
import { HttpError } from "./errors/HttpError";
import { songInputSchema } from "./schemas";
import { CachedSearchProvider } from "./services/search/CachedSearchProvider";
import { YouTubeSearchProvider } from "./services/search/YouTubeSearchProvider";

const assert = (condition: unknown, message: string): void => {
  if (!condition) throw new Error(`FAILED: ${message}`);
};

async function main(): Promise<void> {
  assert(loadConfig({}).searchProvider === "youtube", "default provider is keyless YouTube");
  assert(loadConfig({ SEARCH_PROVIDER: "auto" }).searchProvider === "youtube", "auto selects YouTube");
  assert(loadConfig({ SEARCH_PROVIDER: "itunes" }).searchProvider === "youtube", "legacy iTunes config migrates to YouTube");
  assert(loadConfig({ SEARCH_PROVIDER: "mock" }).searchProvider === "mock", "mock can be selected");

  let requestedQuery = "";
  let calls = 0;
  const provider = new YouTubeSearchProvider(async (query) => {
    requestedQuery = query;
    calls += 1;
    return [
      {
        videoId: "AAAAAAAAAAA",
        title: "Canción completa",
        author: { name: "Artista", url: "https://www.youtube.com/@artista" },
        seconds: 214,
        thumbnail: "https://i.ytimg.com/vi/AAAAAAAAAAA/mqdefault.jpg",
      },
      {
        videoId: "invalid",
        title: "ID inválido",
        author: { name: "Canal", url: "https://www.youtube.com/@canal" },
        seconds: 20,
        thumbnail: undefined,
      },
      {
        videoId: "BBBBBBBBBBB",
        title: "Otra canción",
        author: { name: "Otro artista", url: "https://www.youtube.com/@otro" },
        seconds: 90,
        thumbnail: undefined,
      },
    ];
  });

  const results = await provider.search("  canción prueba  ", 1);
  assert(requestedQuery === "  canción prueba   official audio", "official audio suffix passed to yt-search");
  assert(results.length === 1, "result limit applied and malformed video IDs dropped");
  assert(results[0].title === "Canción completa" && results[0].artist === "Artista", "metadata mapped");
  assert(results[0].durationSeconds === 214, "full duration mapped");
  assert(
    results[0].uri === "https://www.youtube.com/watch?v=AAAAAAAAAAA" &&
      results[0].provider === "youtube" &&
      results[0].source === "web",
    "YouTube watch URL returned",
  );
  assert(
    songInputSchema.safeParse({
      title: results[0].title,
      artist: results[0].artist,
      durationSeconds: results[0].durationSeconds,
      source: results[0].source,
      uri: results[0].uri,
    }).success,
    "YouTube watch URL accepted as a playlist song",
  );
  assert(
    !songInputSchema.safeParse({
      title: "Invalida",
      artist: "Canal",
      durationSeconds: 20,
      source: "web",
      uri: "https://youtube.com.evil.example/watch?v=AAAAAAAAAAA",
    }).success,
    "lookalike YouTube host rejected",
  );

  const cached = new CachedSearchProvider(
    new YouTubeSearchProvider(async () => {
      calls += 1;
      return [];
    }),
  );
  await cached.search("Brisa", 5);
  await cached.search(" brisa ", 5);
  assert(calls === 2, "repeated searches served from cache");

  const failing = new YouTubeSearchProvider(async () => {
    throw new Error("network unavailable");
  });
  const quiet = console.error;
  console.error = () => {};
  try {
    await failing.search("fallo", 5);
    throw new Error("FAILED: search errors should be surfaced");
  } catch (error) {
    assert(error instanceof HttpError && error.code === "SEARCH_UNAVAILABLE", "search failure surfaced");
  } finally {
    console.error = quiet;
  }

  console.log("Search checks passed.");
}

void main();
