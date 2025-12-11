/**
 * File system-based cache store for Node.js
 *
 * Copy this file to your project and import it as needed.
 * NOT compatible with browser or React Native environments.
 *
 * Stores GTFS databases as files on disk for fast access on subsequent loads.
 * Suitable for any size database (limited only by disk space).
 *
 * @example
 * ```typescript
 * import { GtfsSqlJs } from 'gtfs-sqljs';
 * import { FileSystemCacheStore } from './FileSystemCacheStore';
 *
 * const cache = new FileSystemCacheStore({ dir: './.cache/gtfs' });
 * const gtfs = await GtfsSqlJs.fromZip('gtfs.zip', {
 *   cache,
 *   cacheVersion: '1.0'
 * });
 * ```
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { CacheStore, CacheMetadata, CacheEntry, CacheEntryWithData, CacheStoreOptions } from 'gtfs-sqljs';

export class FileSystemCacheStore implements CacheStore {
  private cacheDir: string;

  constructor(options: CacheStoreOptions = {}) {
    // Default to XDG cache directory on Linux/Mac, or temp dir as fallback
    this.cacheDir = options.dir || path.join(
      process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache'),
      'gtfs-sqljs'
    );
  }

  /**
   * Ensure cache directory exists
   */
  private async ensureCacheDir(): Promise<void> {
    try {
      await fs.promises.mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      // Ignore error if directory already exists
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * Get file path for a cache key
   */
  private getFilePath(key: string): string {
    // Sanitize key to be filesystem-safe
    const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.cacheDir, `${safeKey}.db`);
  }

  /**
   * Get metadata file path for a cache key
   */
  private getMetadataPath(key: string): string {
    const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.cacheDir, `${safeKey}.meta.json`);
  }

  /**
   * Get a cached database with metadata
   */
  async get(key: string): Promise<CacheEntryWithData | null> {
    try {
      const filePath = this.getFilePath(key);
      const metadataPath = this.getMetadataPath(key);

      // Read both database and metadata
      const [buffer, metadataContent] = await Promise.all([
        fs.promises.readFile(filePath),
        fs.promises.readFile(metadataPath, 'utf-8')
      ]);

      const data = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
      );
      const metadata = JSON.parse(metadataContent) as CacheMetadata;

      return { data, metadata };
    } catch (error) {
      // Return null if file doesn't exist
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Store a database in cache
   */
  async set(key: string, data: ArrayBuffer, metadata: CacheMetadata): Promise<void> {
    await this.ensureCacheDir();

    const filePath = this.getFilePath(key);
    const metadataPath = this.getMetadataPath(key);

    // Write database file
    await fs.promises.writeFile(filePath, new Uint8Array(data));

    // Write metadata file
    await fs.promises.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  }

  /**
   * Check if a cache entry exists
   */
  async has(key: string): Promise<boolean> {
    try {
      const filePath = this.getFilePath(key);
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete a specific cache entry
   */
  async delete(key: string): Promise<void> {
    const filePath = this.getFilePath(key);
    const metadataPath = this.getMetadataPath(key);

    try {
      await fs.promises.unlink(filePath);
    } catch (error) {
      // Ignore error if file doesn't exist
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    try {
      await fs.promises.unlink(metadataPath);
    } catch {
      // Ignore metadata file errors
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    try {
      const files = await fs.promises.readdir(this.cacheDir);

      await Promise.all(
        files.map(file =>
          fs.promises.unlink(path.join(this.cacheDir, file)).catch(() => {
            // Ignore errors
          })
        )
      );
    } catch (error) {
      // Ignore error if directory doesn't exist
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * List all cached entries
   */
  async list(): Promise<CacheEntry[]> {
    try {
      const files = await fs.promises.readdir(this.cacheDir);
      const metadataFiles = files.filter(f => f.endsWith('.meta.json'));

      const entries: CacheEntry[] = [];

      for (const metaFile of metadataFiles) {
        try {
          const metaPath = path.join(this.cacheDir, metaFile);
          const metaContent = await fs.promises.readFile(metaPath, 'utf-8');
          const metadata = JSON.parse(metaContent) as CacheMetadata;

          // Extract key from filename (remove .meta.json)
          const key = metaFile.replace('.meta.json', '');

          entries.push({ key, metadata });
        } catch {
          // Skip invalid metadata files
        }
      }

      return entries;
    } catch (error) {
      // Return empty array if directory doesn't exist
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }
}
