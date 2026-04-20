# Ingestion Performance — Design & Plan

## Problem

GTFS ingestion dominates `GtfsSqlJs.fromZip()` wall time. On the ASTUCE Rouen feed (~5 MB zip / 34 MB uncompressed, ~430k stop_times rows), a full `fromZip` run on sql.js in Node takes ~2.65 s; the load phase alone is ~2.0 s of that. Measurements on the same machine (see `## Baseline` below) show three code-level wins that together cut total ingestion by ~45% without changing the public API or the on-disk schema.

This document is the plan to land those wins in v0.5.0 and to simultaneously **remove the bulk-load PRAGMAs** from the ingestion path, since benchmarking shows their aggregate effect on sql.js is within noise.

## Goals

1. Cut ingestion time on medium-to-large GTFS feeds by ~40%+ on sql.js.
2. Keep `GtfsSqlJs.fromZip()` / `fromZipData()` / `fromDatabase()` signatures unchanged. No breaking public-API change.
3. Preserve the progress-callback contract: every consumer that currently reads `rowsProcessed` / `totalRows` continues to receive sensible values.
4. Prepare the ingestion code for the pluggable adapter work (`pluggable-db-adapter.md`): fewer sql.js-specific tricks (multi-row `INSERT VALUES (?),(?)…` batches) makes the adapter port cleaner.

## Non-goals

- Changing the GTFS schema, indexes, or `ANALYZE` step — the index/analyze floor (~530 ms on ASTUCE) is out of scope for this change.
- Introducing workers, threads, or async parallelism. All wins here are single-threaded sync code changes.
- CSV strictness changes (normalizing padding, quote handling, BOM handling). We keep the papaparse parser and its current defaults for values.
- Removing papaparse. It's still the parser; we just change the options we pass it.

## Baseline (measured)

ASTUCE GTFS, sql.js 1.13.0, Node v24, fresh in-memory DB, 5 runs, median:

| Phase           | Median (ms) | Notes                                           |
|-----------------|-------------|-------------------------------------------------|
| create schema   |       1     | DDL, one-shot                                   |
| unzip           |      86     | JSZip + `file.async('string')`                  |
| **load data**   |  **2032**   | the hot path — 77% of ingestion time            |
| create indexes + ANALYZE | 530 | fixed floor                                     |
| **total**       |  **2647**   |                                                 |

## Opportunities identified

The load phase of 2032 ms breaks down, in the current `src/loaders/data-loader.ts`, into three avoidable costs:

1. **Every CSV is parsed twice.** The pre-flight loop (`data-loader.ts:69-76`) parses every file only to populate `fileRowCounts` so progress callbacks can report `totalRows`. For a 30 MB `stop_times.txt` this redoes ~600 ms of papaparse work.
2. **Row objects are allocated for every row.** Papa is called with `header: true`, which materializes a `Record<string, string>` per row (430k allocations for stop_times), and the insert loop does property lookup by column name. Switching to `header: false` plus positional column-index arrays removes both the allocation and the property lookup.
3. **`db.prepare()` / `stmt.free()` runs once per 1000-row batch.** Each batch is a fresh multi-row `INSERT ... VALUES (?,?),(?,?),...` statement, re-prepared every batch. Preparing a single per-row `INSERT ... VALUES (?,?,…)` *once per table* and re-running it with `bind/step/reset` for every row beats the batch approach.

## Measured wins (ASTUCE, PRAGMAs disabled)

5 runs per variant, median reported.

| Variant                          | Median (ms) | Δ vs baseline |
|----------------------------------|-------------|---------------|
| A baseline                       |    2647     | —             |
| B — no-preflight (single parse)  |    2008     | −640 (−24%)   |
| D — header:false arrays          |    1695     | −952 (−36%)   |
| F — prepare once, bind/step/reset|    1745     | −902 (−34%)   |
| **B + D + F combined**           |  **1461**   | **−1187 (−45%)** |

Load-phase only, combined: 2032 → 849 ms (−58%).

We also measured and rejected:
- Raising BATCH_SIZE 1000→5000: essentially noise, because SQLITE_MAX_VARIABLE_NUMBER (32766) caps the effective batch around 2100 rows for wide tables anyway. Superseded by F.
- Dropping papaparse's per-field `value.trim()` transform: ~30 ms win (~1%) but introduces a regression risk for feeds with whitespace-padded cells. Not worth it.

## The PRAGMA question

`initFromZipData` currently applies five performance PRAGMAs before bulk load and reverts two of them after:

```
PRAGMA synchronous    = OFF          -- before
PRAGMA journal_mode   = MEMORY       -- before
PRAGMA temp_store     = MEMORY       -- before
PRAGMA cache_size     = -64000       -- before
PRAGMA locking_mode   = EXCLUSIVE    -- before
PRAGMA synchronous    = FULL         -- after
PRAGMA locking_mode   = NORMAL       -- after
```

Benchmark (ASTUCE, 8 runs per config, each PRAGMA individually disabled):

| Config          | Median (ms) | Δ vs all-on |
|-----------------|-------------|-------------|
| all-on          |   2663      | —           |
| all-off         |   2639      | −0.9%       |
| no-synchronous  |   2662      | −0.1%       |
| no-journal_mode |   2656      | −0.3%       |
| no-temp_store   |   2622      | −1.5%       |
| no-cache_size   |   2676      | +0.5%       |
| no-locking_mode |   2717      | +2.0%       |

Every individual PRAGMA's effect on sql.js is ≤ 2%, inside the noise band. This matches the theory: sql.js is an in-memory WASM SQLite, so `synchronous=OFF` (no disk fsync to skip), `journal_mode=MEMORY` (journal is already in memory for `:memory:` DBs), and `locking_mode=EXCLUSIVE` (no concurrent connections) are effectively no-ops.

**Decision: drop the PRAGMA block entirely from ingestion.** The complexity (and the adapter-layer problem of "what does this PRAGMA mean on op-sqlite?" flagged in `pluggable-db-adapter.md`) buys us less than 1% on sql.js. Removing them simplifies the code and removes a future pain point for native-driver adapters.

The "after" pair (`synchronous = FULL`, `locking_mode = NORMAL`) also goes away — there's nothing to restore.

## The plan

### 1. Progress callback: newline-based total-rows estimate

The pre-flight parse exists only to populate `totalRows` for the progress callback. Replace it with a cheap newline count over the raw CSV string — O(bytes), measured at ~5 ms for 30 MB on the same machine (i.e. ~0.2% of ingestion, vs. ~600 ms for the full parse).

Semantic contract:
- `totalRows` becomes an **estimate**: newline count minus 1 per file (for the header row). It will usually match the exact row count; it may be ±1 if the file has no trailing newline or has trailing blank lines.
- `rowsProcessed` stays exact (counted as rows are actually inserted).
- `percentComplete` stays in `0..100` — if `rowsProcessed` momentarily exceeds the estimated `totalRows` due to trailing blanks, clamp the percentage to 99 until the current file finishes.
- We document in the JSDoc of `ProgressInfo.totalRows` that it is "an estimate based on CSV line count; typically exact but may be ±a few rows per file".

Implementation (inside `loadGTFSData`):

```ts
function countCsvRows(csv: string): number {
  let lines = 0;
  for (let i = 0; i < csv.length; i++) if (csv.charCodeAt(i) === 10) lines++;
  // Subtract 1 for the header row; add 1 only if the last byte isn't \n and the file isn't empty.
  const trailing = csv.length > 0 && csv.charCodeAt(csv.length - 1) !== 10 ? 1 : 0;
  return Math.max(0, lines - 1 + trailing);
}
```

Call site:

```ts
let totalRows = 0;
const fileRowCounts = new Map<string, number>();
for (const [fileName, content] of sortedFiles) {
  if (SCHEMA_BY_FILE.has(fileName) && !skipSet.has(fileName.toLowerCase())) {
    const n = countCsvRows(content);
    fileRowCounts.set(fileName, n);
    totalRows += n;
  }
}
```

### 2. Single parse per file with positional arrays

In `loadTableData`, replace the `Papa.parse(csv, { header: true, transform: v => v.trim() })` call with:

```ts
const parsed = Papa.parse<string[]>(csvContent, {
  header: false,
  skipEmptyLines: true,
});
const rawHeaders = (parsed.data[0] || []).map((h) => h.trim());
const dataRows = parsed.data.slice(1);
```

Then compute the CSV-order subset of columns that exist in both the CSV and the table schema, and remember each column's *index* in the CSV row:

```ts
const colIndexes: number[] = [];
const columns: string[] = [];
for (let i = 0; i < rawHeaders.length; i++) {
  if (schema.columns.some((c) => c.name === rawHeaders[i])) {
    colIndexes.push(i);
    columns.push(rawHeaders[i]);
  }
}
if (columns.length === 0) return;
```

Keep the existing empty-string-to-NULL coercion rule; papaparse's per-field `value.trim()` *transform* is removed (it's not needed for GTFS spec-compliant feeds, and would re-introduce the per-field callback overhead that D specifically avoids).

> Behaviour preservation note: GTFS files can in the wild contain whitespace-padded cells. Removing the per-field trim is a ≤1% perf win and a correctness regression risk, so **we keep the trim** — but only at the points where we actually produce a value for binding (one branch, not a papaparse callback that fires on every cell regardless of whether we care about that column).

### 3. Single prepared INSERT per table, reused with `bind/step/reset`

Inside `loadTableData`, after the CSV is parsed and `columns`/`colIndexes` are computed:

```ts
const insertSQL =
  `INSERT INTO ${schema.name} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`;

db.run('BEGIN');
try {
  const stmt = db.prepare(insertSQL);
  try {
    const rowVals: (string | number | null)[] = new Array(columns.length);
    const batchSize = Math.max(1, Math.min(1000, dataRows.length));
    for (let r = 0; r < dataRows.length; r++) {
      const row = dataRows[r];
      for (let j = 0; j < colIndexes.length; j++) {
        const v = row[colIndexes[j]];
        rowVals[j] =
          v == null || v === '' ? null : (typeof v === 'string' ? v.trim() : v);
      }
      stmt.run(rowVals);

      // Progress callback throttled to once per BATCH_SIZE rows so we don't
      // spam a callback 430k times for stop_times.
      if ((r + 1) % batchSize === 0) onProgress?.(r + 1);
    }
    onProgress?.(dataRows.length);
  } finally {
    stmt.free();
  }
  db.run('COMMIT');
} catch (e) {
  db.run('ROLLBACK');
  throw e;
}
```

Key points:
- One `prepare` per table (17 of them total), not one per 1000-row batch (432 of them for stop_times alone on ASTUCE).
- sql.js's `stmt.run(params)` already does `bind` → `step` → `reset` internally, so the explicit pattern is the same code with far fewer `prepare`s.
- Progress callback cadence stays ≈ one event per 1000 rows, matching today's behaviour.
- Transaction boundary is still one `BEGIN`/`COMMIT` per file — no change in atomicity semantics.

### 4. Drop the bulk-load PRAGMA block

In `src/gtfs-sqljs.ts`, remove:

```ts
this.db.run('PRAGMA synchronous = OFF');
this.db.run('PRAGMA journal_mode = MEMORY');
this.db.run('PRAGMA temp_store = MEMORY');
this.db.run('PRAGMA cache_size = -64000');
this.db.run('PRAGMA locking_mode = EXCLUSIVE');
```

…and the post-ingestion reset:

```ts
this.db.run('PRAGMA synchronous = FULL');
this.db.run('PRAGMA locking_mode = NORMAL');
```

Rationale: benchmarked overall effect on sql.js ≤ 1%, within noise; they block the pluggable-adapter work because their semantics vary or fail on file-backed drivers. If a native driver adapter later wants to apply its own ingestion tuning, it can do so inside its adapter setup, not in the shared ingestion path.

## Scope of the internal change

| File | Change |
|------|--------|
| `src/loaders/data-loader.ts` | Rewrite `loadGTFSData` to use `countCsvRows` for progress totals (drop the pre-flight parse). Rewrite `loadTableData` to use `header: false` + positional arrays and a single prepared statement reused with `stmt.run(rowVals)`. |
| `src/gtfs-sqljs.ts` | Delete the 5 bulk-load PRAGMA calls (lines 366–370) and the 2 post-ingest PRAGMA calls (lines 465–466). Add a one-line comment at the old call-site noting that PRAGMAs were dropped and pointing to this document. |
| `src/loaders/csv-parser.ts` | No change to public API. The `parseCSV` helper stays for query-side CSV usage, but the loader no longer calls it. Optionally: add an exported `countCsvRows` helper used by the loader; co-locating it with the CSV utilities keeps the scan cheap and testable. |
| `src/gtfs-sqljs.ts` — JSDoc | Update `ProgressInfo.totalRows`: note it's an estimate, typically exact but may be ±a few rows per file. |
| `tests/sample-feed.test.ts` | Verify ingestion still works end-to-end on the fixture (`tests/fixtures/sample-feed.zip`). Already covers this by asserting row counts after `fromZip`. |
| **new** `tests/progress-callback.test.ts` | Assert that (a) `totalRows` is within ±2 of the real row count on the sample fixture, (b) `percentComplete` stays in `[0, 100]`, (c) the final callback reports `phase: 'complete'`. |
| `CHANGELOG.md` | "Upcoming release" bullets: ingestion ~45% faster on medium-to-large feeds; PRAGMAs removed from ingestion path; `ProgressInfo.totalRows` is now an estimate. |

No changes to: `src/schema/*`, `src/queries/*`, `src/cache/*`, `src/loaders/zip-loader.ts`, `src/loaders/gtfs-rt-loader.ts`, the public API of `GtfsSqlJs`.

## Testing strategy

1. **Existing test suite passes unchanged.** Every test that calls `fromZip` / `fromZipData` exercises the ingestion path. Row-count and data-shape assertions in `tests/sample-feed.test.ts`, `tests/gtfs-sqljs.test.ts`, and `tests/shapes.test.ts` are the primary regression guard.
2. **New: progress-callback test** (see above).
3. **Benchmark regression check.** Re-run `scripts/bench-ingest.ts` on ASTUCE before merging; require median total ≤ 1700 ms (vs. baseline 2647 ms). Document the measurement method in the script header.
4. **Manual smoke test on large feeds.** Car Jaune (small), ASTUCE (medium), and one larger feed (e.g. Île-de-France Mobilités GTFS, ~500 MB uncompressed) to confirm the wins scale and nothing regresses on very large inputs. sql.js memory usage should not increase — the `header: false` branch produces smaller per-row representations, not larger.

## Migration & compatibility

- **Public API unchanged.** No import paths change, no method signatures change.
- **`ProgressInfo.totalRows` semantic change:** from "exact row count" to "estimate, typically exact, may be ±a few per file". This is the only user-observable behaviour change. Consumers who display a rows-remaining progress bar are not affected; consumers who used `totalRows` as a post-hoc row count should instead read `COUNT(*)` via SQL.
- **`locking_mode = EXCLUSIVE` removed.** Consumers opening secondary connections against an exported `.db` file were previously blocked until ingestion finished and the post-reset ran; they are now never blocked. (No known consumer relied on the old behaviour.)
- **Performance.** Monotonically better on sql.js ingestion; the reduction in per-row allocations also lowers peak JS-heap pressure on the largest feeds.

## Phased rollout

**Phase 1 — loader rewrite (0.5 day)**
- Implement `countCsvRows`, rewrite `loadTableData` (`header: false`, prepare-once, `stmt.run` per row), rewrite the progress pre-flight in `loadGTFSData` (newline count).
- Drop the 7 PRAGMA lines from `src/gtfs-sqljs.ts`.
- Update JSDoc on `ProgressInfo.totalRows`.

**Phase 2 — validation (0.5 day)**
- Run the full `vitest` suite; fix any fallout.
- Add the progress-callback test.
- Re-run `scripts/bench-ingest.ts` and confirm the budget.

**Phase 3 — release**
- CHANGELOG entry under "Upcoming release".
- Cut `v0.5.0`.

## Resolved decisions

1. **Progress totals → newline count.** Accept a ±few-row estimate to save ~600 ms on large feeds.
2. **Keep per-field trim**, but at the bind site, not as a papaparse callback. 1% perf cost, 0% regression risk.
3. **Prepare once per table** with `stmt.run(params)`. sql.js handles bind/step/reset internally.
4. **Drop all ingestion-time PRAGMAs**. ≤1% effect on sql.js; complicates the adapter plan.
5. **Keep BATCH_SIZE at 1000 as the progress-callback cadence.** No functional role beyond callback throttling now that we no longer issue multi-row `VALUES (?,?),(?,?)…` SQL.
