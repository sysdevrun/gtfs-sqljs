/**
 * Data Loader - Loads GTFS data into SQLite database
 */

import type { Database } from 'sql.js';
import { parseCSV, convertRowTypes } from './csv-parser';
import { GTFS_SCHEMA, type TableSchema } from '../schema/schema';
import type { GTFSFiles } from './zip-loader';

/**
 * Load GTFS files into SQLite database
 * @param skipFiles - Optional array of filenames to skip importing (tables will be created but remain empty)
 */
export async function loadGTFSData(db: Database, files: GTFSFiles, skipFiles?: string[]): Promise<void> {
  // Map of file names to table schemas
  const fileToSchema: Map<string, TableSchema> = new Map();
  for (const schema of GTFS_SCHEMA) {
    // Match file names like agency.txt to table name 'agency'
    fileToSchema.set(`${schema.name}.txt`, schema);
  }

  // Normalize skipFiles to a Set for faster lookup
  const skipSet = new Set(skipFiles?.map(f => f.toLowerCase()) || []);

  // Process each file
  for (const [fileName, content] of Object.entries(files)) {
    const schema = fileToSchema.get(fileName);
    if (!schema) {
      // Skip unknown files
      continue;
    }

    // Skip if in skip list
    if (skipSet.has(fileName.toLowerCase())) {
      console.log(`Skipping import of ${fileName} (table ${schema.name} created but empty)`);
      continue;
    }

    await loadTableData(db, schema, content);
  }
}

/**
 * Load data for a single table
 */
async function loadTableData(db: Database, schema: TableSchema, csvContent: string): Promise<void> {
  const { headers, rows } = parseCSV(csvContent);

  if (rows.length === 0) {
    return;
  }

  // Build column type map
  const columnTypes: Record<string, 'TEXT' | 'INTEGER' | 'REAL'> = {};
  for (const col of schema.columns) {
    columnTypes[col.name] = col.type;
  }

  // Prepare INSERT statement
  const columns = headers.filter((h) => schema.columns.some((c) => c.name === h));
  const placeholders = columns.map(() => '?').join(', ');
  const insertSQL = `INSERT INTO ${schema.name} (${columns.join(', ')}) VALUES (${placeholders})`;

  const stmt = db.prepare(insertSQL);

  // Insert each row
  for (const row of rows) {
    const typedRow = convertRowTypes(row, columnTypes);
    const values = columns.map((col) => {
      const value = typedRow[col];
      // Handle undefined, null, or empty values
      return value === null || value === undefined ? null : value;
    });

    try {
      stmt.run(values);
    } catch (error) {
      console.error(`Error inserting row into ${schema.name}:`, error);
      console.error('Row data:', row);
      throw error;
    }
  }

  stmt.free();
}
