import type { CacheStore, CacheMetadata, CacheEntry, CacheEntryWithData, CacheStoreOptions } from './types';

/**
 * File system-based cache store for Node.js
 *
 * Stores GTFS databases as files on disk for fast access on subsequent loads.
 * Suitable for any size database (limited only by disk space).
 *
 * @example
 * ```typescript
 * import { GtfsSqlJs, FileSystemCacheStore } from 'gtfs-sqljs';
 *
 * const cache = new FileSystemCacheStore({ dir: './.cache/gtfs' });
 * const gtfs = await GtfsSqlJs.fromZip('gtfs.zip', {
 *   cache,
 *   cacheVersion: '1.0'
 * });
 * ```
 */
export class FileSystemCacheStore implements CacheStore {
  private cacheDir: string;

  constructor(options: CacheStoreOptions = {}) {
    // Default cache directory (will be resolved lazily on first use)
    this.cacheDir = options.dir || '';
  }

  /**
   * Get the cache directory path (lazy initialization)
   */
  private async getCacheDir(): Promise<string> {
    if (this.cacheDir) {
      return this.cacheDir;
    }

    // Dynamically import Node.js modules
    const path = await import('path');
    const os = await import('os');

    // Default to XDG cache directory on Linux/Mac, or temp dir as fallback
    this.cacheDir = path.join(
      process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache'),
      'gtfs-sqljs'
    );

    return this.cacheDir;
  }

  /**
   * Ensure cache directory exists
   */
  private async ensureCacheDir(): Promise<void> {
    const fs = await import('fs');
    const cacheDir = await this.getCacheDir();

    try {
      await fs.promises.mkdir(cacheDir, { recursive: true });
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
  private async getFilePath(key: string): Promise<string> {
    const path = await import('path');
    const cacheDir = await this.getCacheDir();

    // Sanitize key to be filesystem-safe
    const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(cacheDir, `${safeKey}.db`);
  }

  /**
   * Get metadata file path for a cache key
   */
  private async getMetadataPath(key: string): Promise<string> {
    const path = await import('path');
    const cacheDir = await this.getCacheDir();

    const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(cacheDir, `${safeKey}.meta.json`);
  }

  /**
   * Get a cached database with metadata
   */
  async get(key: string): Promise<CacheEntryWithData | null> {
    const fs = await import('fs');

    try {
      const filePath = await this.getFilePath(key);
      const metadataPath = await this.getMetadataPath(key);

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
    const fs = await import('fs');
    await this.ensureCacheDir();

    const filePath = await this.getFilePath(key);
    const metadataPath = await this.getMetadataPath(key);

    // Write database file
    await fs.promises.writeFile(filePath, new Uint8Array(data));

    // Write metadata file
    await fs.promises.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  }

  /**
   * Check if a cache entry exists
   */
  async has(key: string): Promise<boolean> {
    const fs = await import('fs');

    try {
      const filePath = await this.getFilePath(key);
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
    const fs = await import('fs');

    const filePath = await this.getFilePath(key);
    const metadataPath = await this.getMetadataPath(key);

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
    const fs = await import('fs');
    const path = await import('path');
    const cacheDir = await this.getCacheDir();

    try {
      const files = await fs.promises.readdir(cacheDir);

      await Promise.all(
        files.map(file =>
          fs.promises.unlink(path.join(cacheDir, file)).catch(() => {
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
    const fs = await import('fs');
    const path = await import('path');
    const cacheDir = await this.getCacheDir();

    try {
      const files = await fs.promises.readdir(cacheDir);
      const metadataFiles = files.filter(f => f.endsWith('.meta.json'));

      const entries: CacheEntry[] = [];

      for (const metaFile of metadataFiles) {
        try {
          const metaPath = path.join(cacheDir, metaFile);
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
