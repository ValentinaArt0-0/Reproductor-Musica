import { SongNode } from "./SongNode";
import type { ListSnapshot, ListSnapshotEntry, SongMetadata } from "./types";

/** How many random slots Smart Shuffle tries before accepting an artist repeat. */
const MAX_ARTIST_SPREAD_ATTEMPTS = 6;

type Placement = "start" | "end";

/**
 * Playlist implemented from scratch as a doubly linked list.
 *
 * The order of the songs lives ONLY in the `prev` / `next` pointers.
 * The internal `Map` is just an id -> node lookup (O(1) removal and duplicate
 * detection); it never stores or defines the order.
 */
export class DoublyLinkedList {
  private head: SongNode | null = null;
  private tail: SongNode | null = null;
  private current: SongNode | null = null;
  private count = 0;

  private shuffled = false;
  private minRank = 0;
  private maxRank = -1;

  private readonly nodesById = new Map<string, SongNode>();

  // ---------------------------------------------------------------------------
  // Read-only state
  // ---------------------------------------------------------------------------

  get size(): number {
    return this.count;
  }

  get isEmpty(): boolean {
    return this.count === 0;
  }

  get isShuffled(): boolean {
    return this.shuffled;
  }

  get hasNext(): boolean {
    return this.current?.next != null;
  }

  get hasPrev(): boolean {
    return this.current?.prev != null;
  }

  /** True when the current song is the last one (playback should stop after it). */
  get isAtEnd(): boolean {
    return this.current !== null && this.current.next === null;
  }

  // ---------------------------------------------------------------------------
  // Adding songs
  // ---------------------------------------------------------------------------

  /** Adds a song at the beginning of the list. */
  addToStart(song: SongMetadata): SongNode {
    const node = this.createNode(song, "start");
    this.insertAfter(null, node);
    if (this.current === null) this.current = node;
    return node;
  }

  /** Adds a song at the end of the list. */
  addToEnd(song: SongMetadata): SongNode {
    const node = this.createNode(song, "end");
    this.insertAfter(this.tail, node);
    if (this.current === null) this.current = node;
    return node;
  }

  /**
   * Inserts a song so that it ends up at `index` (0-based).
   * `0` behaves like addToStart and `size` like addToEnd.
   * While the list is shuffled, the song is placed at the end of the original order.
   * @throws RangeError when the index is not an integer between 0 and size.
   */
  insertAt(index: number, song: SongMetadata): SongNode {
    if (!Number.isInteger(index) || index < 0 || index > this.count) {
      throw new RangeError(`Index ${index} is out of range [0, ${this.count}]`);
    }
    if (index === 0) return this.addToStart(song);
    if (index === this.count) return this.addToEnd(song);

    const node = this.createNode(song, "end");
    this.insertAfter(this.getNodeAt(index - 1), node);
    return node;
  }

  // ---------------------------------------------------------------------------
  // Removing songs
  // ---------------------------------------------------------------------------

  /**
   * Removes the song with the given id.
   * If it was the current song, the current pointer moves to the next song
   * (or to the previous one when it was the last).
   * @returns true if a song was removed, false if the id does not exist.
   */
  removeById(id: string): boolean {
    const node = this.nodesById.get(id);
    if (!node) return false;

    if (node === this.current) {
      this.current = node.next ?? node.prev;
    }

    this.unlink(node);
    this.nodesById.delete(id);
    node.prev = null;
    node.next = null;

    if (this.count === 0) this.resetRanking();
    return true;
  }

  /** Removes every song and resets the whole structure. */
  clear(): void {
    let node = this.head;
    while (node) {
      const next = node.next;
      node.prev = null;
      node.next = null;
      node = next;
    }
    this.head = null;
    this.tail = null;
    this.current = null;
    this.count = 0;
    this.nodesById.clear();
    this.resetRanking();
  }

  // ---------------------------------------------------------------------------
  // Reordering
  // ---------------------------------------------------------------------------

  /**
   * Moves a song so that it ends up at `toIndex` (0-based, final position).
   *
   * Implemented with the same primitives as removal and insertion: the node is
   * unlinked from its old place and re-linked at the new one. It is the same node,
   * so its id survives and the current pointer keeps following it.
   * While the list is shuffled, restoreOrder() still returns to the pre-shuffle order.
   *
   * @returns false when no song has that id.
   * @throws RangeError when `toIndex` is not an integer between 0 and size - 1.
   */
  moveTo(id: string, toIndex: number): boolean {
    const node = this.nodesById.get(id);
    if (!node) return false;
    if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex >= this.count) {
      throw new RangeError(`Index ${toIndex} is out of range [0, ${this.count - 1}]`);
    }
    if (this.count === 1) return true;

    this.unlink(node);
    this.insertAfter(toIndex === 0 ? null : this.getNodeAt(toIndex - 1), node);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  /** Returns the current song node, or null if the list is empty. */
  getCurrent(): SongNode | null {
    return this.current;
  }

  /**
   * Advances to the next song.
   * @returns the new current node, or null if already at the end
   *          (the current pointer does not move, so the player can simply stop).
   */
  moveNext(): SongNode | null {
    if (this.current?.next) {
      this.current = this.current.next;
      return this.current;
    }
    return null;
  }

  /**
   * Goes back to the previous song.
   * @returns the new current node, or null if already at the start.
   */
  movePrev(): SongNode | null {
    if (this.current?.prev) {
      this.current = this.current.prev;
      return this.current;
    }
    return null;
  }

  /** Jumps to a specific song (e.g. when the user clicks it). */
  setCurrentById(id: string): SongNode | null {
    const node = this.nodesById.get(id);
    if (!node) return null;
    this.current = node;
    return node;
  }

  /** Moves the current pointer back to the first song. */
  resetToStart(): SongNode | null {
    this.current = this.head;
    return this.current;
  }

  // ---------------------------------------------------------------------------
  // Smart Shuffle
  // ---------------------------------------------------------------------------

  /**
   * Smart Shuffle: re-links the existing nodes in a random order.
   *
   * - The current song is pinned to the head, so playback is never interrupted
   *   and everything after it is a fresh random order.
   * - Songs by the same artist are kept apart whenever possible.
   * - Nodes are only re-linked (never copied), so ids and the current pointer survive.
   * - The original order is remembered and can be recovered with restoreOrder().
   *
   * Complexity: O(n^2) (random slot lookup walks the list); fine for playlists.
   *
   * @param random injectable RNG in [0, 1) so the behaviour can be tested.
   */
  shuffle(random: () => number = Math.random): void {
    if (this.count < 2) return;
    if (!this.shuffled) this.snapshotOriginalOrder();

    const pinned = (this.current ?? this.head) as SongNode;
    this.unlink(pinned);

    // `pending` is the remaining chain, still linked in its old order.
    let pending = this.head;
    this.head = pinned;
    this.tail = pinned;
    pinned.prev = null;
    pinned.next = null;
    this.count = 1;

    while (pending) {
      const nextPending: SongNode | null = pending.next;
      pending.prev = null;
      pending.next = null;
      this.insertAtRandomSlot(pending, random);
      pending = nextPending;
    }
  }

  /** Returns the list to the order it had before the first Smart Shuffle. */
  restoreOrder(): void {
    if (!this.shuffled) return;

    let pending = this.head;
    this.head = null;
    this.tail = null;
    this.count = 0;

    while (pending) {
      const nextPending: SongNode | null = pending.next;
      pending.prev = null;
      pending.next = null;
      this.insertSortedByRank(pending);
      pending = nextPending;
    }
    this.resetRanking();
  }

  // ---------------------------------------------------------------------------
  // Read-only views (output only: the list never relies on them internally)
  // ---------------------------------------------------------------------------

  /** Iterates the songs from head to tail. */
  *[Symbol.iterator](): IterableIterator<SongNode> {
    let node = this.head;
    while (node) {
      yield node;
      node = node.next;
    }
  }

  /** Snapshot of the metadata in playlist order, meant for the API / UI layer. */
  toArray(): SongMetadata[] {
    const snapshot: SongMetadata[] = [];
    for (const node of this) snapshot.push(node.toMetadata());
    return snapshot;
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  /** Captures the list (order, current song and shuffle state) so it can be stored. */
  toSnapshot(): ListSnapshot {
    const songs: ListSnapshotEntry[] = [];
    for (const node of this) {
      songs.push({ ...node.toMetadata(), originalRank: node.originalRank });
    }
    return {
      songs,
      currentId: this.current?.id ?? null,
      shuffled: this.shuffled,
    };
  }

  /** Rebuilds a list from a snapshot, re-linking one node per stored song. */
  static fromSnapshot(snapshot: ListSnapshot): DoublyLinkedList {
    const list = new DoublyLinkedList();
    let minRank = Number.POSITIVE_INFINITY;
    let maxRank = Number.NEGATIVE_INFINITY;

    for (const { originalRank, ...metadata } of snapshot.songs) {
      const node = list.addToEnd(metadata);
      node.originalRank = originalRank;
      minRank = Math.min(minRank, originalRank);
      maxRank = Math.max(maxRank, originalRank);
    }

    if (snapshot.shuffled && list.count > 0) {
      list.shuffled = true;
      list.minRank = minRank;
      list.maxRank = maxRank;
    }
    if (snapshot.currentId) {
      list.current = list.nodesById.get(snapshot.currentId) ?? list.head;
    }
    return list;
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private createNode(song: SongMetadata, placement: Placement): SongNode {
    if (this.nodesById.has(song.id)) {
      throw new Error(`A song with id "${song.id}" already exists in the list`);
    }
    const node = new SongNode(song);
    this.nodesById.set(node.id, node);

    // While shuffled, new songs also need a slot in the "original" order.
    if (this.shuffled) {
      node.originalRank = placement === "start" ? --this.minRank : ++this.maxRank;
    }
    return node;
  }

  /** Links `node` right after `reference` (or at the head when reference is null). */
  private insertAfter(reference: SongNode | null, node: SongNode): void {
    if (reference === null) {
      node.prev = null;
      node.next = this.head;
      if (this.head) this.head.prev = node;
      else this.tail = node;
      this.head = node;
    } else {
      node.prev = reference;
      node.next = reference.next;
      if (reference.next) reference.next.prev = node;
      else this.tail = node;
      reference.next = node;
    }
    this.count++;
  }

  /** Detaches `node` from the chain, fixing head/tail/count. Does not touch `current`. */
  private unlink(node: SongNode): void {
    if (node.prev) node.prev.next = node.next;
    else this.head = node.next;

    if (node.next) node.next.prev = node.prev;
    else this.tail = node.prev;

    this.count--;
  }

  /** Walks from the closest end to reach the node at `index` (assumes a valid index). */
  private getNodeAt(index: number): SongNode {
    let node: SongNode;
    if (index <= this.count / 2) {
      node = this.head as SongNode;
      for (let i = 0; i < index; i++) node = node.next as SongNode;
    } else {
      node = this.tail as SongNode;
      for (let i = this.count - 1; i > index; i--) node = node.prev as SongNode;
    }
    return node;
  }

  private snapshotOriginalOrder(): void {
    let rank = 0;
    for (const node of this) node.originalRank = rank++;
    this.minRank = 0;
    this.maxRank = this.count - 1;
    this.shuffled = true;
  }

  private resetRanking(): void {
    this.shuffled = false;
    this.minRank = 0;
    this.maxRank = -1;
  }

  /**
   * Inserts `node` after a random node of the list being rebuilt.
   * Inserting the k-th element in a uniformly random slot yields a uniform permutation.
   */
  private insertAtRandomSlot(node: SongNode, random: () => number): void {
    let left = this.head as SongNode;
    for (let attempt = 0; attempt < MAX_ARTIST_SPREAD_ATTEMPTS; attempt++) {
      left = this.getNodeAt(Math.floor(random() * this.count));
      if (!this.sameArtist(node, left) && !this.sameArtist(node, left.next)) break;
    }
    this.insertAfter(left, node);
  }

  /** Insertion step used by restoreOrder(): keeps the new list sorted by originalRank. */
  private insertSortedByRank(node: SongNode): void {
    let cursor = this.tail;
    while (cursor && cursor.originalRank > node.originalRank) cursor = cursor.prev;
    this.insertAfter(cursor, node);
  }

  private sameArtist(a: SongNode, b: SongNode | null): boolean {
    return b !== null && a.artist.trim().toLowerCase() === b.artist.trim().toLowerCase();
  }
}
