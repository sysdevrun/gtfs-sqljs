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
