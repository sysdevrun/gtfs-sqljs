/**
 * Ingestion-path optimization benchmark.
 *
 * PRAGMAs are fully disabled in every variant to isolate code-level wins.
 *
 * Variants tested:
 *   A baseline       — current code (parseCSV twice, 1000-row multi-row INSERT)
 *   B no-preflight   — parse each CSV only once, stream row count
 *   C no-trim        — drop per-field `value.trim()` transform in papaparse
 *   D arrays         — papaparse with `header: false`, positional access
 *   E big-batch      — BATCH_SIZE 5000 (vs 1000)
 *   F prep-once      — prepare single-row INSERT once per table, reuse bind/step/reset
 *   G combined       — B+C+D+E applied together
 *   H combined+prep  — G + F
 */

import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import initSqlJs, { type Database } from 'sql.js';
import Papa from 'papaparse';
import { getAllCreateTableStatements, getAllCreateIndexStatements } from '../src/schema/schema.ts';
import { loadGTFSZip, type GTFSFiles } from '../src/loaders/zip-loader.ts';
import { loadGTFSData } from '../src/loaders/data-loader.ts';
import { GTFS_SCHEMA, type TableSchema } from '../src/schema/schema.ts';
import { createRealtimeTables } from '../src/schema/gtfs-rt-schema.ts';

const ZIP_PATH = process.argv[2] ?? '/tmp/gtfs-bench/astuce.zip';
const RUNS_PER_VARIANT = 5;

type Variant = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';

const VARIANT_LABELS: Record<Variant, string> = {
  A: 'A baseline',
  B: 'B no-preflight',
  C: 'C no-trim',
  D: 'D arrays',
  E: 'E big-batch(5k)',
  F: 'F prep-once',
  G: 'G combined (B+C+D+E)',
  H: 'H G + prep-once',
};

// ------------------------- variant implementations -------------------------

// Variant A: call upstream code unchanged.
async function loadVariantA(db: Database, files: GTFSFiles) {
  await loadGTFSData(db, files);
}

// Build schema map once (shared by B–H).
const SCHEMA_BY_FILE = new Map<string, TableSchema>();
for (const s of GTFS_SCHEMA) SCHEMA_BY_FILE.set(`${s.name}.txt`, s);

function orderedFiles(files: GTFSFiles): [string, string][] {
  const priority = [
    'agency.txt', 'feed_info.txt', 'attributions.txt', 'levels.txt', 'routes.txt',
    'calendar.txt', 'calendar_dates.txt', 'fare_attributes.txt', 'fare_rules.txt',
    'stops.txt', 'pathways.txt', 'transfers.txt', 'trips.txt', 'frequencies.txt',
    'shapes.txt', 'stop_times.txt',
  ];
  const out: [string, string][] = [];
  const seen = new Set<string>();
  for (const p of priority) if (files[p]) { out.push([p, files[p]]); seen.add(p); }
  for (const [k, v] of Object.entries(files)) if (!seen.has(k)) out.push([k, v]);
  return out;
}

// Variant B: single parse per file, papaparse options match baseline.
async function loadVariantB(db: Database, files: GTFSFiles, opts: {
  trim?: boolean; arrays?: boolean; batchSize?: number; prepOnce?: boolean;
} = {}) {
  const trim = opts.trim ?? true;
  const arrays = opts.arrays ?? false;
  const batchSize = opts.batchSize ?? 1000;
  const prepOnce = opts.prepOnce ?? false;

  for (const [fileName, content] of orderedFiles(files)) {
    const schema = SCHEMA_BY_FILE.get(fileName);
    if (!schema) continue;

    let headers: string[];
    let rows: unknown[];
    if (arrays) {
      const r = Papa.parse<string[]>(content, {
        header: false,
        skipEmptyLines: true,
      });
      const data = r.data;
      headers = (data[0] || []).map((h) => h.trim());
      rows = data.slice(1);
    } else {
      const r = Papa.parse<Record<string, string>>(content, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim(),
        ...(trim ? { transform: (v: string) => v.trim() } : {}),
      });
      headers = r.meta.fields || [];
      rows = r.data;
    }
    if (rows.length === 0) continue;

    // Columns present in both the CSV and the schema, in CSV order.
    const colIndexes: number[] = [];
    const columns: string[] = [];
    for (let i = 0; i < headers.length; i++) {
      if (schema.columns.some((c) => c.name === headers[i])) {
        colIndexes.push(i);
        columns.push(headers[i]);
      }
    }
    if (columns.length === 0) continue;

    db.run('BEGIN');
    try {
      if (prepOnce) {
        const insertSQL = `INSERT INTO ${schema.name} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`;
        const stmt = db.prepare(insertSQL);
        try {
          const rowVals: (string | number | null)[] = new Array(columns.length);
          for (let r = 0; r < rows.length; r++) {
            const row = rows[r];
            if (arrays) {
              const arr = row as string[];
              for (let j = 0; j < colIndexes.length; j++) {
                const v = arr[colIndexes[j]];
                rowVals[j] = v == null || v === '' ? null : (trim ? v.trim() : v);
              }
            } else {
              const obj = row as Record<string, string>;
              for (let j = 0; j < columns.length; j++) {
                const v = obj[columns[j]];
                rowVals[j] = v == null || v === '' ? null : v;
              }
            }
            stmt.run(rowVals);
          }
        } finally {
          stmt.free();
        }
      } else {
        // Multi-row INSERT batches; respect SQLITE_MAX_VARIABLE_NUMBER (32766).
        const safeBatch = Math.max(1, Math.min(batchSize, Math.floor(30000 / columns.length)));
        for (let i = 0; i < rows.length; i += safeBatch) {
          const end = Math.min(i + safeBatch, rows.length);
          const n = end - i;
          const placeholders = new Array(n).fill(`(${columns.map(() => '?').join(',')})`).join(',');
          const insertSQL = `INSERT INTO ${schema.name} (${columns.join(',')}) VALUES ${placeholders}`;
          const all: (string | number | null)[] = [];
          if (arrays) {
            for (let r = i; r < end; r++) {
              const arr = rows[r] as string[];
              for (let j = 0; j < colIndexes.length; j++) {
                const v = arr[colIndexes[j]];
                all.push(v == null || v === '' ? null : (trim ? v.trim() : v));
              }
            }
          } else {
            for (let r = i; r < end; r++) {
              const obj = rows[r] as Record<string, string>;
              for (const col of columns) {
                const v = obj[col];
                all.push(v == null || v === '' ? null : v);
              }
            }
          }
          const stmt = db.prepare(insertSQL);
          try { stmt.run(all); } finally { stmt.free(); }
        }
      }
      db.run('COMMIT');
    } catch (e) {
      db.run('ROLLBACK');
      throw e;
    }
  }
}

// --------------------------------- runner ---------------------------------

async function ingest(SQL: initSqlJs.SqlJsStatic, zip: Uint8Array, variant: Variant) {
  const phase: Record<string, number> = {};
  const tick = (k: string, t0: number) => { phase[k] = (phase[k] || 0) + performance.now() - t0; };

  let t = performance.now();
  const db = new SQL.Database();
  for (const s of getAllCreateTableStatements()) db.run(s);
  createRealtimeTables(db);
  tick('schema', t);

  t = performance.now();
  const files = await loadGTFSZip(zip);
  tick('unzip', t);

  t = performance.now();
  switch (variant) {
    case 'A': await loadVariantA(db, files); break;
    case 'B': await loadVariantB(db, files); break;
    case 'C': await loadVariantB(db, files, { trim: false }); break;
    case 'D': await loadVariantB(db, files, { arrays: true, trim: false }); break;
    case 'E': await loadVariantB(db, files, { batchSize: 5000 }); break;
    case 'F': await loadVariantB(db, files, { prepOnce: true }); break;
    case 'G': await loadVariantB(db, files, { trim: false, arrays: true, batchSize: 5000 }); break;
    case 'H': await loadVariantB(db, files, { trim: false, arrays: true, batchSize: 5000, prepOnce: true }); break;
  }
  tick('load', t);

  t = performance.now();
  for (const s of getAllCreateIndexStatements()) db.run(s);
  db.run('ANALYZE');
  tick('indexes', t);

  const total = phase.schema + phase.unzip + phase.load + phase.indexes;
  db.close();
  return { total, phase };
}

function stats(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  const mean = samples.reduce((s, x) => s + x, 0) / samples.length;
  const median = sorted.length % 2
    ? sorted[(sorted.length - 1) / 2]
    : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  return { mean, median, min: sorted[0], max: sorted[sorted.length - 1] };
}

async function main() {
  const SQL = await initSqlJs();
  const zip = new Uint8Array(readFileSync(ZIP_PATH));

  process.stderr.write('warmup…\n');
  await ingest(SQL, zip, 'A');
  await ingest(SQL, zip, 'H');

  const variants: Variant[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const results: Record<Variant, { totals: number[]; phases: Record<string, number[]> }> = {} as any;

  for (const v of variants) {
    results[v] = { totals: [], phases: { schema: [], unzip: [], load: [], indexes: [] } };
    for (let i = 0; i < RUNS_PER_VARIANT; i++) {
      const { total, phase } = await ingest(SQL, zip, v);
      results[v].totals.push(total);
      for (const k of Object.keys(phase)) results[v].phases[k].push(phase[k]);
      process.stderr.write(`  ${VARIANT_LABELS[v].padEnd(22)} run ${i + 1}: ${total.toFixed(1)} ms (load ${phase.load.toFixed(1)})\n`);
    }
  }

  const baseline = stats(results.A.totals).median;

  process.stdout.write('\nTotal ingestion time (median of ' + RUNS_PER_VARIANT + ' runs):\n');
  process.stdout.write('| Variant                | Median  | Mean    | Min     | Max     | Δ vs A         |\n');
  process.stdout.write('|------------------------|---------|---------|---------|---------|----------------|\n');
  for (const v of variants) {
    const s = stats(results[v].totals);
    const dMs = s.median - baseline;
    const dPct = (dMs / baseline) * 100;
    const delta = v === 'A' ? '—' : `${dMs >= 0 ? '+' : ''}${dMs.toFixed(0)} ms (${dPct >= 0 ? '+' : ''}${dPct.toFixed(1)}%)`;
    process.stdout.write(`| ${VARIANT_LABELS[v].padEnd(22)} | ${s.median.toFixed(0).padStart(7)} | ${s.mean.toFixed(0).padStart(7)} | ${s.min.toFixed(0).padStart(7)} | ${s.max.toFixed(0).padStart(7)} | ${delta.padStart(14)} |\n`);
  }

  process.stdout.write('\nPhase breakdown (median ms):\n');
  process.stdout.write('| Variant                | schema | unzip  | load   | indexes |\n');
  process.stdout.write('|------------------------|--------|--------|--------|---------|\n');
  for (const v of variants) {
    const row: Record<string, number> = {};
    for (const k of Object.keys(results[v].phases)) row[k] = stats(results[v].phases[k]).median;
    process.stdout.write(`| ${VARIANT_LABELS[v].padEnd(22)} | ${row.schema.toFixed(0).padStart(6)} | ${row.unzip.toFixed(0).padStart(6)} | ${row.load.toFixed(0).padStart(6)} | ${row.indexes.toFixed(0).padStart(7)} |\n`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
