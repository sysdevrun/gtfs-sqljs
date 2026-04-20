/**
 * Post-refactor ingestion benchmark: end-to-end GtfsSqlJs.fromZipData on a
 * real feed. No PRAGMAs, no synthetic adapter paths — exercises the real
 * public API after the optimize-ingestion changes.
 *
 * Usage: npx tsx scripts/bench-after.ts /path/to/feed.zip
 */

import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { GtfsSqlJs } from '../src/gtfs-sqljs.ts';

const ZIP_PATH = process.argv[2] ?? '/tmp/gtfs-bench/astuce.zip';
const RUNS = 5;

async function run() {
  const zip = new Uint8Array(readFileSync(ZIP_PATH));
  // warmup
  const w = await GtfsSqlJs.fromZipData(zip);
  w.close();

  const samples: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const t0 = performance.now();
    const gtfs = await GtfsSqlJs.fromZipData(zip);
    const ms = performance.now() - t0;
    gtfs.close();
    samples.push(ms);
    process.stderr.write(`  run ${i + 1}: ${ms.toFixed(1)} ms\n`);
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const mean = samples.reduce((s, x) => s + x, 0) / samples.length;
  const median = sorted.length % 2
    ? sorted[(sorted.length - 1) / 2]
    : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  process.stdout.write(`\nfeed: ${ZIP_PATH}\n`);
  process.stdout.write(`runs: ${RUNS}\n`);
  process.stdout.write(`median: ${median.toFixed(1)} ms\n`);
  process.stdout.write(`mean:   ${mean.toFixed(1)} ms\n`);
  process.stdout.write(`min:    ${sorted[0].toFixed(1)} ms\n`);
  process.stdout.write(`max:    ${sorted[sorted.length - 1].toFixed(1)} ms\n`);
}

run().catch((e) => { console.error(e); process.exit(1); });
