/**
 * CSV Parser for GTFS files using papaparse
 */

import Papa from 'papaparse';

export interface ParsedCSV {
  headers: string[];
  rows: Record<string, string>[];
}

/**
 * Parse CSV text into structured data using papaparse
 */
export function parseCSV(text: string): ParsedCSV {
  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
    transform: (value) => value.trim(),
  });

  if (result.errors.length > 0) {
    console.warn('CSV parsing warnings:', result.errors);
  }

  const headers = result.meta.fields || [];
  const rows = result.data as Record<string, string>[];

  return { headers, rows };
}

/**
 * Fast O(bytes) estimate of the number of data rows in a CSV string.
 *
 * Counts newline characters and subtracts 1 for the header row. Assumes the
 * CSV has a header line, no embedded newlines in quoted fields (GTFS spec
 * compliant), and may or may not have a trailing newline. The result is
 * typically exact but may be ±a few rows per file in edge cases (e.g. trailing
 * blank lines). Suitable for driving progress callbacks, not for precise
 * bookkeeping.
 */
export function countCsvRows(csv: string): number {
  let lines = 0;
  for (let i = 0; i < csv.length; i++) {
    if (csv.charCodeAt(i) === 10) lines++;
  }
  const trailing = csv.length > 0 && csv.charCodeAt(csv.length - 1) !== 10 ? 1 : 0;
  return Math.max(0, lines - 1 + trailing);
}

/**
 * Convert parsed row to typed object with proper type conversions
 */
export function convertRowTypes(
  row: Record<string, string>,
  columnTypes: Record<string, 'TEXT' | 'INTEGER' | 'REAL'>
): Record<string, string | number | null> {
  const result: Record<string, string | number | null> = {};

  // Iterate over all expected columns, not just the ones present in the row
  for (const [key, type] of Object.entries(columnTypes)) {
    const value = row[key];

    // Handle missing or empty values
    if (value === undefined || value === null || value === '') {
      result[key] = null;
      continue;
    }

    if (type === 'INTEGER') {
      const parsed = parseInt(value, 10);
      result[key] = isNaN(parsed) ? null : parsed;
    } else if (type === 'REAL') {
      const parsed = parseFloat(value);
      result[key] = isNaN(parsed) ? null : parsed;
    } else {
      result[key] = value;
    }
  }

  return result;
}
