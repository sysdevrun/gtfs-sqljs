/**
 * Benchmark the individual performance impact of each bulk-load PRAGMA.
 *
 * For each configuration we:
 *   1. fresh in-memory sql.js DB
 *   2. apply a subset of the PRAGMAs used today in src/gtfs-sqljs.ts
 *   3. create schema, load all CSVs, create indexes, ANALYZE
 *   4. time the whole thing with performance.now()
 *
 * We run every config N times and report mean + median.
 */

import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import initSqlJs from 'sql.js';
import { getAllCreateTableStatements, getAllCreateIndexStatements } from '../src/schema/schema.ts';
import { loadGTFSZip } from '../src/loaders/zip-loader.ts';
import { loadGTFSData } from '../src/loaders/data-loader.ts';
import { createRealtimeTables } from '../src/schema/gtfs-rt-schema.ts';

const ZIP_PATH = process.argv[2] ?? '/tmp/gtfs-bench/car-jaune.zip';
const RUNS_PER_CONFIG = 8;

const ALL_PRAGMAS = [
  'synchronous',
  'journal_mode',
  'temp_store',
  'cache_size',
  'locking_mode',
] as const;

type PragmaName = typeof ALL_PRAGMAS[number];

const PRAGMA_SQL: Record<PragmaName, string> = {
  synchronous: 'PRAGMA synchronous = OFF',
  journal_mode: 'PRAGMA journal_mode = MEMORY',
  temp_store: 'PRAGMA temp_store = MEMORY',
  cache_size: 'PRAGMA cache_size = -64000',
  locking_mode: 'PRAGMA locking_mode = EXCLUSIVE',
};

interface Config {
  label: string;
  pragmas: PragmaName[];
}

const CONFIGS: Config[] = [
  { label: 'all-on (baseline)', pragmas: [...ALL_PRAGMAS] },
  { label: 'all-off', pragmas: [] },
  ...ALL_PRAGMAS.map<Config>((p) => ({
    label: `no-${p}`,
    pragmas: ALL_PRAGMAS.filter((x) => x !== p),
  })),
];

async function runOnce(SQL: initSqlJs.SqlJsStatic, zipBuf: Uint8Array, pragmas: PragmaName[]) {
  const t0 = performance.now();
  const db = new SQL.Database();
  for (const p of pragmas) db.run(PRAGMA_SQL[p]);
  for (const stmt of getAllCreateTableStatements()) db.run(stmt);
  createRealtimeTables(db);
  const files = await loadGTFSZip(zipBuf);
  await loadGTFSData(db, files);
  for (const stmt of getAllCreateIndexStatements()) db.run(stmt);
  db.run('ANALYZE');
  const elapsed = performance.now() - t0;
  db.close();
  return elapsed;
}

function stats(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  const mean = samples.reduce((s, x) => s + x, 0) / samples.length;
  const median =
    sorted.length % 2
      ? sorted[(sorted.length - 1) / 2]
      : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  return { mean, median, min: sorted[0], max: sorted[sorted.length - 1] };
}

async function main() {
  const SQL = await initSqlJs();
  const zipBuf = new Uint8Array(readFileSync(ZIP_PATH));
  // Warmup (JIT + sql.js heap grow) — discarded.
  process.stderr.write('warmup…\n');
  await runOnce(SQL, zipBuf, [...ALL_PRAGMAS]);
  await runOnce(SQL, zipBuf, []);

  const results: Array<{ label: string; samples: number[] }> = [];
  for (const cfg of CONFIGS) {
    const samples: number[] = [];
    for (let i = 0; i < RUNS_PER_CONFIG; i++) {
      const ms = await runOnce(SQL, zipBuf, cfg.pragmas);
      samples.push(ms);
      process.stderr.write(`  ${cfg.label} run ${i + 1}: ${ms.toFixed(1)} ms\n`);
    }
    results.push({ label: cfg.label, samples });
  }

  const baseline = stats(results[0].samples).median;
  process.stdout.write('\n');
  process.stdout.write('| Config                | Median (ms) | Mean (ms) | Min   | Max   | Δ vs baseline |\n');
  process.stdout.write('|-----------------------|-------------|-----------|-------|-------|---------------|\n');
  for (const r of results) {
    const s = stats(r.samples);
    const deltaMs = s.median - baseline;
    const deltaPct = (deltaMs / baseline) * 100;
    const deltaStr =
      r.label === 'all-on (baseline)'
        ? '—'
        : `${deltaMs >= 0 ? '+' : ''}${deltaMs.toFixed(1)} ms (${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}%)`;
    process.stdout.write(
      `| ${r.label.padEnd(21)} | ${s.median.toFixed(1).padStart(11)} | ${s.mean
        .toFixed(1)
        .padStart(9)} | ${s.min.toFixed(1).padStart(5)} | ${s.max.toFixed(1).padStart(5)} | ${deltaStr.padStart(13)} |\n`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
