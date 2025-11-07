/**
 * Compute SHA-256 checksum of data
 * Uses Web Crypto API (available in both browser and Node.js 18+)
 */
export async function computeChecksum(data: ArrayBuffer | Uint8Array): Promise<string> {
  // Ensure we have a BufferSource for crypto.subtle.digest
  // Use type assertion to handle ArrayBufferLike compatibility
  const bufferSource = (data instanceof Uint8Array ? data : new Uint8Array(data)) as BufferSource;
  const hashBuffer = await crypto.subtle.digest('SHA-256', bufferSource);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Compute checksum for a zip file
 * @param zipData - The zip file data (ArrayBuffer or Uint8Array)
 * @returns SHA-256 checksum as hex string
 */
export async function computeZipChecksum(zipData: ArrayBuffer | Uint8Array): Promise<string> {
  return computeChecksum(zipData);
}

/**
 * Generate a cache key from checksum, version, filesize, source, and options
 * Format: v{libVersion}_{dataVersion}_{filesize}_{checksum}_{source}_{skipFiles}
 *
 * @param checksum - SHA-256 checksum of zip file
 * @param libVersion - Library version from package.json
 * @param dataVersion - User-specified data version
 * @param filesize - Size of the zip file in bytes
 * @param source - Source URL or filename (optional)
 * @param skipFiles - Files that were skipped during import
 * @returns Cache key string
 */
export function generateCacheKey(
  checksum: string,
  libVersion: string,
  dataVersion: string,
  filesize: number,
  source?: string,
  skipFiles?: string[]
): string {
  // Start with versions and filesize
  let key = `v${libVersion}_d${dataVersion}_${filesize}_${checksum}`;

  // Add source (sanitized)
  if (source) {
    // Extract filename from URL/path and sanitize
    const filename = source.split('/').pop() || source;
    const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    key += `_${sanitized}`;
  }

  // Add skip files if any
  if (skipFiles && skipFiles.length > 0) {
    // Sort to ensure consistent key regardless of order
    const sortedSkips = [...skipFiles].sort();
    const skipsSuffix = sortedSkips.join(',').replace(/\.txt/g, '');
    key += `_skip-${skipsSuffix}`;
  }

  return key;
}
