/**
 * Data Loader - Loads GTFS data into SQLite database
 */

import type { Database } from 'sql.js';
import { parseCSV } from './csv-parser';
import { GTFS_SCHEMA, type TableSchema } from '../schema/schema';
import type { GTFSFiles } from './zip-loader';
import type { ProgressCallback } from '../gtfs-sqljs';

/**
 * Load GTFS files into SQLite database
 * @param skipFiles - Optional array of filenames to skip importing (tables will be created but remain empty)
 * @param onProgress - Optional progress callback
 */
export async function loadGTFSData(
  db: Database,
  files: GTFSFiles,
  skipFiles?: string[],
  onProgress?: ProgressCallback
): Promise<void> {
  // Map of file names to table schemas
  const fileToSchema: Map<string, TableSchema> = new Map();
  for (const schema of GTFS_SCHEMA) {
    // Match file names like agency.txt to table name 'agency'
    fileToSchema.set(`${schema.name}.txt`, schema);
  }

  // Normalize skipFiles to a Set for faster lookup
  const skipSet = new Set(skipFiles?.map(f => f.toLowerCase()) || []);

  // Define file priority order (small files first, largest last)
  const filePriority = [
    'agency.txt',
    'feed_info.txt',
    'attributions.txt',
    'levels.txt',
    'routes.txt',
    'calendar.txt',
    'calendar_dates.txt',
    'fare_attributes.txt',
    'fare_rules.txt',
    'stops.txt',
    'pathways.txt',
    'transfers.txt',
    'trips.txt',
    'frequencies.txt',
    'shapes.txt',
    'stop_times.txt', // Largest file - process last
  ];

  // Sort files by priority
  const sortedFiles: [string, string][] = [];
  for (const priorityFile of filePriority) {
    if (files[priorityFile]) {
      sortedFiles.push([priorityFile, files[priorityFile]]);
    }
  }
  // Add any files not in priority list
  for (const [fileName, content] of Object.entries(files)) {
    if (!filePriority.includes(fileName)) {
      sortedFiles.push([fileName, content]);
    }
  }

  // Calculate total rows for progress tracking
  let totalRows = 0;
  const fileRowCounts = new Map<string, number>();
  for (const [fileName, content] of sortedFiles) {
    const schema = fileToSchema.get(fileName);
    if (schema && !skipSet.has(fileName.toLowerCase())) {
      const { rows } = parseCSV(content);
      fileRowCounts.set(fileName, rows.length);
      totalRows += rows.length;
    }
  }

  let rowsProcessed = 0;
  let filesCompleted = 0;

  // Process each file
  for (const [fileName, content] of sortedFiles) {
    const schema = fileToSchema.get(fileName);
    if (!schema) {
      // Skip unknown files
      continue;
    }

    // Skip if in skip list
    if (skipSet.has(fileName.toLowerCase())) {
      console.log(`Skipping import of ${fileName} (table ${schema.name} created but empty)`);
      filesCompleted++;
      continue;
    }

    const fileRows = fileRowCounts.get(fileName) || 0;

    onProgress?.({
      phase: 'inserting_data',
      currentFile: fileName,
      filesCompleted,
      totalFiles: sortedFiles.length,
      rowsProcessed,
      totalRows,
      percentComplete: 40 + Math.floor((rowsProcessed / totalRows) * 35),
      message: `Loading ${fileName} (${fileRows.toLocaleString()} rows)`,
    });

    await loadTableData(db, schema, content, (processedInFile) => {
      const currentProgress = rowsProcessed + processedInFile;
      onProgress?.({
        phase: 'inserting_data',
        currentFile: fileName,
        filesCompleted,
        totalFiles: sortedFiles.length,
        rowsProcessed: currentProgress,
        totalRows,
        percentComplete: 40 + Math.floor((currentProgress / totalRows) * 35),
        message: `Loading ${fileName} (${processedInFile.toLocaleString()}/${fileRows.toLocaleString()} rows)`,
      });
    });

    rowsProcessed += fileRows;
    filesCompleted++;

    onProgress?.({
      phase: 'inserting_data',
      currentFile: null,
      filesCompleted,
      totalFiles: sortedFiles.length,
      rowsProcessed,
      totalRows,
      percentComplete: 40 + Math.floor((rowsProcessed / totalRows) * 35),
      message: `Completed ${fileName}`,
    });
  }
}

/**
 * Load data for a single table with batch inserts and transaction
 */
async function loadTableData(
  db: Database,
  schema: TableSchema,
  csvContent: string,
  onProgress?: (rowsProcessed: number) => void
): Promise<void> {
  const { headers, rows } = parseCSV(csvContent);

  if (rows.length === 0) {
    return;
  }

  // Prepare INSERT statement
  const columns = headers.filter((h) => schema.columns.some((c) => c.name === h));
  if (columns.length === 0) {
    return;
  }

  const BATCH_SIZE = 1000;
  let rowsProcessed = 0;

  // Start transaction for better performance
  db.run('BEGIN TRANSACTION');

  try {
    // Process in batches
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batchRows = rows.slice(i, Math.min(i + BATCH_SIZE, rows.length));

      // Build multi-row INSERT statement
      const placeholders = batchRows.map(() => `(${columns.map(() => '?').join(', ')})`).join(', ');
      const insertSQL = `INSERT INTO ${schema.name} (${columns.join(', ')}) VALUES ${placeholders}`;

      // Collect all values for the batch
      const allValues: (string | number | null)[] = [];
      for (const row of batchRows) {
        for (const col of columns) {
          const value = row[col];
          // Let SQLite handle type conversion - just pass empty strings as NULL
          allValues.push(value === null || value === undefined || value === '' ? null : value);
        }
      }

      // Execute batch insert
      const stmt = db.prepare(insertSQL);
      try {
        stmt.run(allValues);
      } catch (error) {
        console.error(`Error inserting batch into ${schema.name}:`, error);
        console.error('Batch size:', batchRows.length);
        throw error;
      } finally {
        stmt.free();
      }

      rowsProcessed += batchRows.length;
      onProgress?.(rowsProcessed);
    }

    // Commit transaction
    db.run('COMMIT');
  } catch (error) {
    // Rollback on error
    try {
      db.run('ROLLBACK');
    } catch (rollbackError) {
      console.error('Error rolling back transaction:', rollbackError);
    }
    throw error;
  }
}
