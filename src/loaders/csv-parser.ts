/**
 * CSV Parser for GTFS files
 */

export interface ParsedCSV {
  headers: string[];
  rows: Record<string, string>[];
}

/**
 * Parse CSV text into structured data
 */
export function parseCSV(text: string): ParsedCSV {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  // Parse headers
  const headers = parseCSVLine(lines[0]);

  // Parse rows
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      const value = values[j] || '';
      row[header] = value;
    }
    rows.push(row);
  }

  return { headers, rows };
}

/**
 * Parse a single CSV line, handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  // Add last field
  result.push(current.trim());

  return result;
}

/**
 * Convert parsed row to typed object with proper type conversions
 */
export function convertRowTypes(
  row: Record<string, string>,
  columnTypes: Record<string, 'TEXT' | 'INTEGER' | 'REAL'>
): Record<string, string | number | null> {
  const result: Record<string, string | number | null> = {};

  for (const [key, value] of Object.entries(row)) {
    // Empty string means null/undefined
    if (value === '') {
      result[key] = null;
      continue;
    }

    const type = columnTypes[key];
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
