/**
 * CSV Writer for GTFS data export using papaparse
 */

import Papa from 'papaparse';

/**
 * Generate CSV string from data rows
 * @param data - Array of row objects
 * @param columns - Array of column names to include (in order)
 * @returns CSV string with CRLF line endings (GTFS best practice)
 */
export function generateCSV(data: Record<string, unknown>[], columns: string[]): string {
  // Convert null/undefined values to empty strings for CSV output
  const cleanedData = data.map((row) => {
    const cleaned: Record<string, string> = {};
    for (const col of columns) {
      const value = row[col];
      // Convert null/undefined to empty string, otherwise convert to string
      cleaned[col] = value === null || value === undefined ? '' : String(value);
    }
    return cleaned;
  });

  // Use papaparse to generate CSV
  const csv = Papa.unparse(cleanedData, {
    columns,
    newline: '\r\n', // GTFS best practice: CRLF line endings
  });

  return csv;
}
