/**
 * Data Loader - Loads GTFS data into SQLite database
 */

import Papa from 'papaparse';
import { countCsvRows } from './csv-parser';
import { GTFS_SCHEMA, type TableSchema } from '../schema/schema';
import type { GTFSFiles } from './zip-loader';
import type { ProgressCallback } from '../gtfs-sqljs';
import type { GtfsDatabase, SqlValue } from '../adapters/types';

const PROGRESS_BATCH = 1000;

/**
 * Load GTFS files into SQLite database
 * @param skipFiles - Optional array of filenames to skip importing (tables will be created but remain empty)
 * @param onProgress - Optional progress callback
 */
export async function loadGTFSData(
  db: GtfsDatabase,
  files: GTFSFiles,
  skipFiles?: string[],
  onProgress?: ProgressCallback
): Promise<void> {
  const fileToSchema: Map<string, TableSchema> = new Map();
  for (const schema of GTFS_SCHEMA) {
    fileToSchema.set(`${schema.name}.txt`, schema);
  }

  const skipSet = new Set(skipFiles?.map((f) => f.toLowerCase()) || []);

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

  const sortedFiles: [string, string][] = [];
  for (const priorityFile of filePriority) {
    if (files[priorityFile]) {
      sortedFiles.push([priorityFile, files[priorityFile]]);
    }
  }
  for (const [fileName, content] of Object.entries(files)) {
    if (!filePriority.includes(fileName)) {
      sortedFiles.push([fileName, content]);
    }
  }

  // Estimate total rows via newline count (O(bytes)) instead of parsing every
  // file twice. totalRows may differ by a few rows from the true row count
  // for files with trailing blank lines; see countCsvRows for details.
  let totalRows = 0;
  const fileRowCounts = new Map<string, number>();
  for (const [fileName, content] of sortedFiles) {
    if (fileToSchema.has(fileName) && !skipSet.has(fileName.toLowerCase())) {
      const n = countCsvRows(content);
      fileRowCounts.set(fileName, n);
      totalRows += n;
    }
  }

  let rowsProcessed = 0;
  let filesCompleted = 0;

  for (const [fileName, content] of sortedFiles) {
    const schema = fileToSchema.get(fileName);
    if (!schema) continue;

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
      percentComplete: computePercent(rowsProcessed, totalRows),
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
        percentComplete: computePercent(currentProgress, totalRows),
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
      percentComplete: computePercent(rowsProcessed, totalRows),
      message: `Completed ${fileName}`,
    });
  }
}

// Map [0, totalRows] → [40, 75] to match the legacy progress ranges reported
// by GtfsSqlJs.loadFromZipData. Clamped to 74 to avoid jumping past the
// following "creating_indexes" phase when the row-count estimate undershoots.
function computePercent(rowsProcessed: number, totalRows: number): number {
  if (totalRows <= 0) return 40;
  const pct = 40 + Math.floor((rowsProcessed / totalRows) * 35);
  return Math.min(74, pct);
}

/**
 * Load data for a single table using a single prepared INSERT reused per row.
 * Parses the CSV exactly once as positional arrays (no per-row object
 * allocation) and binds column values by pre-computed index.
 */
async function loadTableData(
  db: GtfsDatabase,
  schema: TableSchema,
  csvContent: string,
  onProgress?: (rowsProcessed: number) => void
): Promise<void> {
  const parsed = Papa.parse<string[]>(csvContent, {
    header: false,
    skipEmptyLines: true,
  });
  const data = parsed.data;
  if (data.length < 2) return;

  const rawHeaders = (data[0] || []).map((h) => h.trim());
  const dataRows = data.slice(1);
  if (dataRows.length === 0) return;

  const colIndexes: number[] = [];
  const columns: string[] = [];
  for (let i = 0; i < rawHeaders.length; i++) {
    if (schema.columns.some((c) => c.name === rawHeaders[i])) {
      colIndexes.push(i);
      columns.push(rawHeaders[i]);
    }
  }
  if (columns.length === 0) return;

  const insertSQL = `INSERT INTO ${schema.name} (${columns.join(', ')}) VALUES (${columns
    .map(() => '?')
    .join(', ')})`;

  await db.run('BEGIN TRANSACTION');
  try {
    const stmt = await db.prepare(insertSQL);
    try {
      const rowVals: SqlValue[] = new Array(columns.length);
      for (let r = 0; r < dataRows.length; r++) {
        const row = dataRows[r];
        for (let j = 0; j < colIndexes.length; j++) {
          const v = row[colIndexes[j]];
          if (v == null) {
            rowVals[j] = null;
          } else {
            const trimmed = typeof v === 'string' ? v.trim() : v;
            rowVals[j] = trimmed === '' ? null : trimmed;
          }
        }
        await stmt.run(rowVals);

        const done = r + 1;
        if (done % PROGRESS_BATCH === 0) onProgress?.(done);
      }
      if (dataRows.length % PROGRESS_BATCH !== 0) onProgress?.(dataRows.length);
    } finally {
      await stmt.free();
    }
    await db.run('COMMIT');
  } catch (error) {
    try {
      await db.run('ROLLBACK');
    } catch (rollbackError) {
      console.error('Error rolling back transaction:', rollbackError);
    }
    throw error;
  }
}
