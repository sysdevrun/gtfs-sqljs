/**
 * Metadata stored with cached GTFS databases
 */
export interface CacheMetadata {
  /** Checksum of the source zip file (SHA-256) */
  checksum: string;
  /** Version number - cache is invalidated if this changes */
  version: string;
  /** Timestamp when the cache was created */
  timestamp: number;
  /** Source zip URL or path (for reference) */
  source?: string;
  /** Size of the cached database in bytes */
  size: number;
  /** Which files were skipped during import (affects cache validity) */
  skipFiles?: string[];
}

/**
 * A single cache entry with its metadata
 */
export interface CacheEntry {
  /** Unique cache key */
  key: string;
  /** Cache metadata */
  metadata: CacheMetadata;
}

/**
 * Interface for implementing custom cache storage backends.
 *
 * The library provides two implementations:
 * - IndexedDBCacheStore (for browsers)
 * - FileSystemCacheStore (for Node.js)
 *
 * You can implement this interface to use custom storage backends
 * (e.g., Redis, S3, or any other storage system).
 */
export interface CacheStore {
  /**
   * Retrieve a cached database by key
   * @param key - Cache key (typically includes checksum and version)
   * @returns The cached database as ArrayBuffer, or null if not found
   */
  get(key: string): Promise<ArrayBuffer | null>;

  /**
   * Store a database in the cache
   * @param key - Cache key
   * @param data - Database as ArrayBuffer
   * @param metadata - Metadata about the cached database
   */
  set(key: string, data: ArrayBuffer, metadata: CacheMetadata): Promise<void>;

  /**
   * Check if a cache entry exists
   * @param key - Cache key
   * @returns true if the cache entry exists
   */
  has(key: string): Promise<boolean>;

  /**
   * Delete a specific cache entry
   * @param key - Cache key
   */
  delete(key: string): Promise<void>;

  /**
   * Clear all cache entries
   */
  clear(): Promise<void>;

  /**
   * List all cached entries (optional)
   * @returns Array of cache entries with their metadata
   */
  list?(): Promise<CacheEntry[]>;
}

/**
 * Options for cache stores
 */
export interface CacheStoreOptions {
  /** Cache directory path (for FileSystemCacheStore) */
  dir?: string;
  /** IndexedDB database name (for IndexedDBCacheStore) */
  dbName?: string;
}
