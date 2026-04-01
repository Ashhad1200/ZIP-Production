import { openDB, type IDBPDatabase } from 'idb';

export interface QueuedMutation {
  id: string;
  method: string; // POST, PUT, PATCH, DELETE
  url: string;
  data?: unknown;
  headers?: Record<string, string>;
  timestamp: number;
  retryCount: number;
  status: 'queued' | 'replaying' | 'conflict';
  conflictData?: { server: unknown; queued: unknown };
}

type QueueInput = Omit<QueuedMutation, 'id' | 'timestamp' | 'retryCount' | 'status'>;

class MutationQueueService {
  private db: IDBPDatabase | null = null;
  private readonly DB_NAME = 'zip-offline-queue';
  private readonly STORE_NAME = 'mutations';
  private readonly MAX_QUEUE_SIZE = 50;

  async init(): Promise<IDBPDatabase> {
    if (this.db) return this.db;

    this.db = await openDB(this.DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('mutations')) {
          db.createObjectStore('mutations', { keyPath: 'id' });
        }
      },
    });

    return this.db;
  }

  async queue(mutation: QueueInput): Promise<QueuedMutation> {
    const db = await this.init();
    const count = await db.count(this.STORE_NAME);

    if (count >= this.MAX_QUEUE_SIZE) {
      throw new Error(
        `Offline queue is full (${this.MAX_QUEUE_SIZE} items). Please go online to sync.`,
      );
    }

    const entry: QueuedMutation = {
      ...mutation,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      retryCount: 0,
      status: 'queued',
    };

    await db.put(this.STORE_NAME, entry);
    return entry;
  }

  async peek(): Promise<QueuedMutation | undefined> {
    const db = await this.init();
    const all = await db.getAll(this.STORE_NAME);
    return all
      .filter((m) => m.status === 'queued')
      .sort((a, b) => a.timestamp - b.timestamp)[0];
  }

  async dequeue(id: string): Promise<void> {
    const db = await this.init();
    await db.delete(this.STORE_NAME, id);
  }

  async markConflict(id: string, serverData: unknown): Promise<void> {
    const db = await this.init();
    const entry = await db.get(this.STORE_NAME, id);
    if (!entry) return;

    entry.status = 'conflict';
    entry.conflictData = { server: serverData, queued: entry.data };
    await db.put(this.STORE_NAME, entry);
  }

  async getAll(): Promise<QueuedMutation[]> {
    const db = await this.init();
    const all = await db.getAll(this.STORE_NAME);
    return all.sort((a, b) => a.timestamp - b.timestamp);
  }

  async getCount(): Promise<number> {
    const db = await this.init();
    return db.count(this.STORE_NAME);
  }

  async clear(): Promise<void> {
    const db = await this.init();
    await db.clear(this.STORE_NAME);
  }
}

export const mutationQueue = new MutationQueueService();
