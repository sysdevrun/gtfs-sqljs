/**
 * ZIP Loader for GTFS files
 */

import JSZip from 'jszip';

export interface GTFSFiles {
  [filename: string]: string;
}

/**
 * Fetch and extract GTFS ZIP file
 * Works in both browser and Node.js environments
 */
export async function loadGTFSZip(source: string | ArrayBuffer | Uint8Array): Promise<GTFSFiles> {
  let zipData: ArrayBuffer | Uint8Array;

  // If source is a string, treat it as URL or file path
  if (typeof source === 'string') {
    zipData = await fetchZip(source);
  } else {
    zipData = source;
  }

  // Load ZIP file
  const zip = await JSZip.loadAsync(zipData);

  // Extract all .txt files (GTFS files)
  const files: GTFSFiles = {};
  const filePromises: Promise<void>[] = [];

  zip.forEach((relativePath, file) => {
    // Only process .txt files
    if (!file.dir && relativePath.endsWith('.txt')) {
      const fileName = relativePath.split('/').pop() || relativePath;
      filePromises.push(
        file.async('string').then((content) => {
          files[fileName] = content;
        })
      );
    }
  });

  await Promise.all(filePromises);

  return files;
}

/**
 * Fetch ZIP file from URL or file path
 */
async function fetchZip(source: string): Promise<ArrayBuffer> {
  // Try to detect environment and use appropriate method
  if (typeof fetch !== 'undefined') {
    // Browser or Node.js with fetch support
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Failed to fetch GTFS ZIP: ${response.status} ${response.statusText}`);
    }
    return await response.arrayBuffer();
  } else if (typeof require !== 'undefined') {
    // Node.js environment without fetch
    try {
      // Dynamic import for Node.js fs module
      const fs = await import('fs');
      const buffer = await fs.promises.readFile(source);
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    } catch (error) {
      throw new Error(`Failed to read GTFS ZIP file: ${error}`);
    }
  } else {
    throw new Error('No method available to fetch ZIP file');
  }
}

/**
 * Mapping of GTFS file names to database table names
 */
export const GTFS_FILE_MAPPING: Record<string, string> = {
  'agency.txt': 'agency',
  'stops.txt': 'stops',
  'routes.txt': 'routes',
  'trips.txt': 'trips',
  'stop_times.txt': 'stop_times',
  'calendar.txt': 'calendar',
  'calendar_dates.txt': 'calendar_dates',
  'fare_attributes.txt': 'fare_attributes',
  'fare_rules.txt': 'fare_rules',
  'shapes.txt': 'shapes',
  'frequencies.txt': 'frequencies',
  'transfers.txt': 'transfers',
  'pathways.txt': 'pathways',
  'levels.txt': 'levels',
  'feed_info.txt': 'feed_info',
  'attributions.txt': 'attributions',
};
