import type { CacheMetadata, CacheEntry } from './types';

/**
 * Default cache expiration time in milliseconds (7 days)
 */
export const DEFAULT_CACHE_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Check if a cache entry is expired
 * @param metadata - Cache metadata
 * @param expirationMs - Expiration time in milliseconds (default: 7 days)
 * @returns true if the cache entry is expired
 */
export function isCacheExpired(
  metadata: CacheMetadata,
  expirationMs: number = DEFAULT_CACHE_EXPIRATION_MS
): boolean {
  const now = Date.now();
  const age = now - metadata.timestamp;
  return age > expirationMs;
}

/**
 * Filter out expired cache entries
 * @param entries - Array of cache entries
 * @param expirationMs - Expiration time in milliseconds (default: 7 days)
 * @returns Filtered array of non-expired entries
 */
export function filterExpiredEntries(
  entries: CacheEntry[],
  expirationMs: number = DEFAULT_CACHE_EXPIRATION_MS
): CacheEntry[] {
  return entries.filter(entry => !isCacheExpired(entry.metadata, expirationMs));
}

/**
 * Get cache statistics
 * @param entries - Array of cache entries
 * @returns Cache statistics
 */
export function getCacheStats(entries: CacheEntry[]) {
  const totalSize = entries.reduce((sum, entry) => sum + entry.metadata.size, 0);
  const expiredEntries = entries.filter(entry => isCacheExpired(entry.metadata));
  const activeEntries = entries.filter(entry => !isCacheExpired(entry.metadata));

  return {
    totalEntries: entries.length,
    activeEntries: activeEntries.length,
    expiredEntries: expiredEntries.length,
    totalSize,
    totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
    oldestEntry: entries.length > 0
      ? Math.min(...entries.map(e => e.metadata.timestamp))
      : null,
    newestEntry: entries.length > 0
      ? Math.max(...entries.map(e => e.metadata.timestamp))
      : null,
  };
}
