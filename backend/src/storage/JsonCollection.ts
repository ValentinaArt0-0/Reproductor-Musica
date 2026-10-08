import fs from "node:fs";
import path from "node:path";

/**
 * Tiny persistent collection backed by a JSON file.
 * Reads happen once at startup; writes are serialized and atomic (temp file + rename).
 * Swap it for a real database later without touching the services' public API.
 */
export class JsonCollection<T extends { id: string }> {
  private readonly items = new Map<string, T>();
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (!fs.existsSync(filePath)) return;

    const raw = fs.readFileSync(filePath, "utf8").trim();
    if (raw === "") return;
    try {
      for (const item of JSON.parse(raw) as T[]) this.items.set(item.id, item);
    } catch {
      throw new Error(`Storage file is corrupted and could not be parsed: ${filePath}`);
    }
  }

  list(): T[] {
    return Array.from(this.items.values());
  }

  get(id: string): T | undefined {
    return this.items.get(id);
  }

  upsert(item: T): Promise<void> {
    this.items.set(item.id, item);
    return this.persist();
  }

  remove(id: string): Promise<void> {
    this.items.delete(id);
    return this.persist();
  }

  private persist(): Promise<void> {
    const run = this.writeQueue.then(() => this.flush());
    this.writeQueue = run.catch(() => undefined); // a failed write must not block later ones
    return run;
  }

  private async flush(): Promise<void> {
    const tmpPath = `${this.filePath}.tmp`;
    await fs.promises.writeFile(tmpPath, JSON.stringify(this.list(), null, 2), "utf8");
    await fs.promises.rename(tmpPath, this.filePath);
  }
}
