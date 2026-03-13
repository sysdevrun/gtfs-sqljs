/**
 * ZIP Writer for GTFS export using jszip
 */

import JSZip from 'jszip';
import type { GtfsExportResult } from './gtfs-exporter';

/**
 * Options for creating GTFS ZIP file
 */
export interface ZipWriterOptions {
  /** Compression level (0-9, default: 6) */
  compressionLevel?: number;
  /** Progress callback */
  onProgress?: (info: { filesAdded: number; totalFiles: number }) => void;
}

/**
 * Create a GTFS ZIP file from exported data
 * @param exportResult - Result from exportGtfsData()
 * @param options - ZIP creation options
 * @returns ArrayBuffer containing the ZIP file
 */
export async function createGtfsZip(
  exportResult: GtfsExportResult,
  options?: ZipWriterOptions
): Promise<ArrayBuffer> {
  const zip = new JSZip();
  const compressionLevel = options?.compressionLevel ?? 6;

  let filesAdded = 0;
  const totalFiles = exportResult.files.size;

  // Add each CSV file to the ZIP
  for (const [filename, content] of exportResult.files) {
    zip.file(filename, content, {
      compression: 'DEFLATE',
      compressionOptions: {
        level: compressionLevel,
      },
    });

    filesAdded++;
    options?.onProgress?.({
      filesAdded,
      totalFiles,
    });
  }

  // Generate the ZIP file as ArrayBuffer
  const arrayBuffer = await zip.generateAsync({
    type: 'arraybuffer',
    compression: 'DEFLATE',
    compressionOptions: {
      level: compressionLevel,
    },
  });

  return arrayBuffer;
}
