/**
 * IndexedDB-based cache store for browsers
 *
 * Copy this file to your project and import it as needed.
 *
 * Stores GTFS databases in IndexedDB for fast access on subsequent loads.
 * Suitable for large databases (100s of MB to several GB depending on browser limits).
 *
 * @example
 * ```typescript
 * import { GtfsSqlJs } from 'gtfs-sqljs';
 * import { IndexedDBCacheStore } from './IndexedDBCacheStore';
 *
 * const cache = new IndexedDBCacheStore();
 * const gtfs = await GtfsSqlJs.fromZip('gtfs.zip', {
 *   cache,
 *   cacheVersion: '1.0'
 * });
 * ```
 */

import type { CacheStore, CacheMetadata, CacheEntry, CacheEntryWithData, CacheStoreOptions } from 'gtfs-sqljs';

export class IndexedDBCacheStore implements CacheStore {
  private dbName: string;
  private storeName = 'gtfs-cache';
  private version = 1;

  constructor(options: CacheStoreOptions = {}) {
    this.dbName = options.dbName || 'gtfs-sqljs-cache';
  }

  /**
   * Open IndexedDB connection
   */
  private async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'key' });
          store.createIndex('timestamp', 'metadata.timestamp', { unique: false });
        }
      };
    });
  }

  /**
   * Get a cached database with metadata
   */
  async get(key: string): Promise<CacheEntryWithData | null> {
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);

      request.onerror = () => {
        db.close();
        reject(request.error);
      };

      request.onsuccess = () => {
        db.close();
        const result = request.result;
        if (result) {
          resolve({
            data: result.data,
            metadata: result.metadata
          });
        } else {
          resolve(null);
        }
      };
    });
  }

  /**
   * Store a database in cache
   */
  async set(key: string, data: ArrayBuffer, metadata: CacheMetadata): Promise<void> {
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      const record = {
        key,
        data,
        metadata
      };

      const request = store.put(record);

      request.onerror = () => {
        db.close();
        reject(request.error);
      };

      request.onsuccess = () => {
        db.close();
        resolve();
      };
    });
  }

  /**
   * Check if a cache entry exists
   */
  async has(key: string): Promise<boolean> {
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getKey(key);

      request.onerror = () => {
        db.close();
        reject(request.error);
      };

      request.onsuccess = () => {
        db.close();
        resolve(request.result !== undefined);
      };
    });
  }

  /**
   * Delete a specific cache entry
   */
  async delete(key: string): Promise<void> {
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(key);

      request.onerror = () => {
        db.close();
        reject(request.error);
      };

      request.onsuccess = () => {
        db.close();
        resolve();
      };
    });
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onerror = () => {
        db.close();
        reject(request.error);
      };

      request.onsuccess = () => {
        db.close();
        resolve();
      };
    });
  }

  /**
   * List all cached entries
   */
  async list(): Promise<CacheEntry[]> {
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAllKeys();

      request.onerror = () => {
        db.close();
        reject(request.error);
      };

      request.onsuccess = async () => {
        const keys = request.result as string[];
        const entries: CacheEntry[] = [];

        // Get metadata for each key
        const metadataPromises = keys.map(async (key) => {
          const metaRequest = store.get(key);
          return new Promise<CacheEntry>((resolveEntry, rejectEntry) => {
            metaRequest.onerror = () => rejectEntry(metaRequest.error);
            metaRequest.onsuccess = () => {
              const record = metaRequest.result;
              resolveEntry({
                key,
                metadata: record.metadata
              });
            };
          });
        });

        try {
          const results = await Promise.all(metadataPromises);
          entries.push(...results);
        } catch (error) {
          db.close();
          reject(error);
          return;
        }

        db.close();
        resolve(entries);
      };
    });
  }
}
