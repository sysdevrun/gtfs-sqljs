/**
 * GTFS Data Exporter
 * Exports GTFS data from SQLite database to CSV files
 */

import type { Database } from 'sql.js';
import { GTFS_SCHEMA } from '../schema/schema';
import { generateCSV } from './csv-writer';

/**
 * Mapping from table name to GTFS filename
 */
const TABLE_TO_FILENAME: Record<string, string> = {
  agency: 'agency.txt',
  stops: 'stops.txt',
  routes: 'routes.txt',
  trips: 'trips.txt',
  stop_times: 'stop_times.txt',
  calendar: 'calendar.txt',
  calendar_dates: 'calendar_dates.txt',
  fare_attributes: 'fare_attributes.txt',
  fare_rules: 'fare_rules.txt',
  shapes: 'shapes.txt',
  frequencies: 'frequencies.txt',
  transfers: 'transfers.txt',
  pathways: 'pathways.txt',
  levels: 'levels.txt',
  feed_info: 'feed_info.txt',
  attributions: 'attributions.txt',
};

/**
 * Result of exporting GTFS data
 */
export interface GtfsExportResult {
  /** Map of filename to CSV content */
  files: Map<string, string>;
  /** Tables that were exported */
  exportedTables: string[];
  /** Tables that were skipped (empty) */
  skippedTables: string[];
}

/**
 * Options for exporting GTFS data
 */
export interface GtfsExportOptions {
  /** Specific tables to export (if not specified, exports all non-empty tables) */
  tables?: string[];
  /** Progress callback */
  onProgress?: (info: { table: string; tablesCompleted: number; totalTables: number }) => void;
}

/**
 * Get column names for a table from the schema
 */
function getSchemaColumns(tableName: string): string[] {
  const schema = GTFS_SCHEMA.find((s) => s.name === tableName);
  if (!schema) {
    return [];
  }
  return schema.columns.map((col) => col.name);
}

/**
 * Get column names that actually exist in the table
 * This handles cases where the database might have been created with a subset of columns
 */
function getExistingColumns(db: Database, tableName: string, schemaColumns: string[]): string[] {
  // Get table info to see what columns actually exist
  const stmt = db.prepare(`PRAGMA table_info(${tableName})`);
  const existingCols = new Set<string>();

  while (stmt.step()) {
    const row = stmt.getAsObject() as { name: string };
    existingCols.add(row.name);
  }
  stmt.free();

  // Return only schema columns that exist in the table, preserving schema order
  return schemaColumns.filter((col) => existingCols.has(col));
}

/**
 * Query all rows from a table
 */
function queryTableData(db: Database, tableName: string, columns: string[]): Record<string, unknown>[] {
  const columnList = columns.join(', ');
  const stmt = db.prepare(`SELECT ${columnList} FROM ${tableName}`);
  const rows: Record<string, unknown>[] = [];

  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }

  stmt.free();
  return rows;
}

/**
 * Check if a table exists in the database
 */
function tableExists(db: Database, tableName: string): boolean {
  const stmt = db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
  );
  stmt.bind([tableName]);
  const exists = stmt.step();
  stmt.free();
  return exists;
}

/**
 * Get row count for a table
 */
function getTableRowCount(db: Database, tableName: string): number {
  const stmt = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`);
  stmt.step();
  const result = stmt.getAsObject() as { count: number };
  stmt.free();
  return result.count;
}

/**
 * Export GTFS data from database to CSV files
 */
export function exportGtfsData(db: Database, options?: GtfsExportOptions): GtfsExportResult {
  const files = new Map<string, string>();
  const exportedTables: string[] = [];
  const skippedTables: string[] = [];

  // Get list of tables to export
  const tablesToExport = options?.tables || Object.keys(TABLE_TO_FILENAME);

  // Filter to only valid GTFS tables
  const validTables = tablesToExport.filter((table) => TABLE_TO_FILENAME[table]);

  let tablesCompleted = 0;
  const totalTables = validTables.length;

  for (const tableName of validTables) {
    // Check if table exists
    if (!tableExists(db, tableName)) {
      skippedTables.push(tableName);
      tablesCompleted++;
      continue;
    }

    // Check if table has data
    const rowCount = getTableRowCount(db, tableName);

    if (rowCount === 0) {
      skippedTables.push(tableName);
      tablesCompleted++;
      continue;
    }

    // Get columns from schema
    const schemaColumns = getSchemaColumns(tableName);
    if (schemaColumns.length === 0) {
      skippedTables.push(tableName);
      tablesCompleted++;
      continue;
    }

    // Get columns that actually exist in the table
    const columns = getExistingColumns(db, tableName, schemaColumns);
    if (columns.length === 0) {
      skippedTables.push(tableName);
      tablesCompleted++;
      continue;
    }

    // Query data
    const data = queryTableData(db, tableName, columns);

    // Generate CSV
    const csv = generateCSV(data, columns);

    // Add to files map
    const filename = TABLE_TO_FILENAME[tableName];
    files.set(filename, csv);
    exportedTables.push(tableName);

    tablesCompleted++;

    // Report progress
    options?.onProgress?.({
      table: tableName,
      tablesCompleted,
      totalTables,
    });
  }

  return {
    files,
    exportedTables,
    skippedTables,
  };
}

/**
 * Get available table names for export
 */
export function getExportableTables(): string[] {
  return Object.keys(TABLE_TO_FILENAME);
}
