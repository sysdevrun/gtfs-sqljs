# Changelog

## Upcoming release

### Breaking changes — pluggable database adapter

The library now talks to a small async `GtfsDatabase` interface. sql.js becomes one adapter among others (better-sqlite3 ships in the box; op-sqlite / expo-sqlite / … pluggable by the user). Three things change at every call site: (1) query methods return `Promise<T>`, (2) an `adapter` is required, (3) `sql.js` is an optional peer dependency — you install it yourself.

See the full migration write-up in [README](README.md) and the [Usage Guide](documents/guide.md#creating-an-instance).

#### What's unchanged

- All filter shapes (`{ routeId, date, directionId, … }`) and returned GTFS / GTFS-RT object shapes are identical. No SQL query changes, no schema changes.
- The high-level entry points (`fromZip`, `fromZipData`, `fromDatabase`) keep their names and argument order; only `options` gains `adapter`.

#### Step 1 — install the adapter peer dependency

The core package no longer depends on sql.js. Install whichever adapter(s) you use:

```bash
# Previously (v0.5 and earlier): already transitive — nothing to do.
# Now:
npm install sql.js                # browser / Node WASM
npm install better-sqlite3        # Node native, file-backed
```

#### Step 2 — pass an adapter and `await` your queries

Typical sql.js migration:

```diff
- import { GtfsSqlJs } from 'gtfs-sqljs';
+ import { GtfsSqlJs } from 'gtfs-sqljs';
+ import { createSqlJsAdapter } from 'gtfs-sqljs/adapters/sql-js';

- const gtfs = await GtfsSqlJs.fromZip(url, { locateFile });
+ const gtfs = await GtfsSqlJs.fromZip(url, {
+   adapter: await createSqlJsAdapter({ locateFile }),
+ });

- const routes = gtfs.getRoutes();
- const stops  = gtfs.getStops({ name: 'Station' });
+ const routes = await gtfs.getRoutes();
+ const stops  = await gtfs.getStops({ name: 'Station' });

- const buffer = gtfs.export();
- gtfs.close();
+ const buffer = await gtfs.export();
+ await gtfs.close();
```

TypeScript flags the missing `await`s for you; plain JS does not — grep for `gtfs.get` and `gtfs.close(`/`gtfs.export(` before shipping.

#### Step 3 — only if you called `getDatabase()` for raw access

`getDatabase()` now returns a `GtfsDatabase` (the adapter surface), not a raw sql.js `Database`. **All its methods are async.** This is the most likely silent failure during migration:

```diff
  const db = gtfs.getDatabase();
- const stmt = db.prepare('SELECT * FROM stops WHERE stop_lat > ?');
- stmt.bind([40.7]);
- while (stmt.step()) {
-   const row = stmt.getAsObject();
+ const stmt = await db.prepare('SELECT * FROM stops WHERE stop_lat > ?');
+ await stmt.bind([40.7]);
+ while (await stmt.step()) {
+   const row = await stmt.getAsObject();
    console.log(row);
  }
- stmt.free();
+ await stmt.free();
```

If you need the genuine sql.js `Database` (for features gtfs-sqljs does not wrap), keep a reference to it at the point where you built the adapter — the library no longer re-exposes it.

#### Option A — new `attach()` entry point

If you already open a database handle yourself (typical for file-backed drivers), skip the factory and attach the handle directly:

```ts
import BetterSqlite3 from 'better-sqlite3';
import { GtfsSqlJs } from 'gtfs-sqljs';
import { wrapBetterSqlite3 } from 'gtfs-sqljs/adapters/better-sqlite3';

const raw = new BetterSqlite3('./gtfs.db', { readonly: true });
const gtfs = await GtfsSqlJs.attach(wrapBetterSqlite3(raw), {
  skipSchema: true, // file already has the GTFS schema
});
```

`attach()` does not take an `adapter`. By default it does **not** close the raw handle when `gtfs.close()` runs — pass `ownsDatabase: true` if you want the library to own it.

#### Option B — removed / renamed options

| v0.5 | v0.6 |
| --- | --- |
| `GtfsSqlJsOptions.SQL` | `createSqlJsAdapter({ SQL })` |
| `GtfsSqlJsOptions.locateFile` | `createSqlJsAdapter({ locateFile })` |
| re-exported `SqlJsStatic`, sql.js `Database` type | import from `sql.js` directly, or use `GtfsDatabase` |

Calling `fromZip` / `fromZipData` / `fromDatabase` without `options.adapter` now throws a runtime `Error` pointing at `createSqlJsAdapter` — useful when you miss a call site.

### New features

- New `src/adapters/types.ts` public surface: `GtfsDatabase`, `GtfsStatement`, `GtfsDatabaseAdapter`, `SqlValue`, `Row`, `ExportNotSupportedError`.
- sql.js adapter at subpath `gtfs-sqljs/adapters/sql-js` (exports `createSqlJsAdapter`, `wrapSqlJsDatabase`). The core module no longer imports sql.js.
- **better-sqlite3 adapter at subpath `gtfs-sqljs/adapters/better-sqlite3`** (exports `wrapBetterSqlite3`, `createBetterSqlite3Adapter`). First-class Node / file-backed path; the adapter is the only file in the repo that imports `better-sqlite3`, so projects that do not reference this subpath never pull in the native module. Exercised by `tests/e2e-better-sqlite3.test.ts` on every CI run.
- Cache layer now catches `ExportNotSupportedError` from adapters that cannot serialize in-memory and logs a warning instead of failing the load; file-backed drivers persist their own DB on disk.

### Performance (from earlier work in this cycle)

- Ingestion is ~35-45% faster on medium-to-large feeds: ASTUCE (Rouen, ~430k stop_times rows) drops from ~2650 ms to ~1670 ms; Car Jaune from ~312 ms to ~188 ms. Wins come from parsing each CSV only once (progress totals now use a fast newline-based row-count estimate), loading rows as positional arrays instead of per-row objects, and reusing a single prepared INSERT per table instead of re-preparing a multi-row statement per 1000-row batch.
- Dropped the bulk-load PRAGMA block (`synchronous`, `journal_mode`, `temp_store`, `cache_size`, `locking_mode`) from ingestion. Benchmarked aggregate effect on sql.js is within noise (≤1%); removing them simplifies the code and unblocks the pluggable adapter.

### Behaviour changes

- `ProgressInfo.totalRows` is now an estimate based on CSV line count — typically exact, but may differ by a few rows per file in edge cases (e.g. trailing blank lines). For a precise post-ingest row count, query the database directly with `COUNT(*)`.

## 0.4.1

- Add Claude Code skill file with API reference, usage examples, WASM setup instructions, and Web Worker guidance for LLM code agents

## 0.4.0

### Breaking changes

- **`fromZip()` no longer reads local file paths** in Node.js. Read the file yourself and use `fromZipData()` instead
- `fetchRealtimeData()` / `loadRealtimeData()` no longer read local file paths in Node.js. Use the new `loadRealtimeDataFromBuffers()` method with pre-read data instead

### New features

- Add `loadRealtimeDataFromBuffers(buffers)` method to `GtfsSqlJs` for loading GTFS-RT data from pre-loaded protobuf `Uint8Array` buffers without fetching

### Internal improvements

- Remove all Node.js `fs` imports and `isNodeEnvironment()` checks, making the published module fully platform-neutral
- Delete `src/utils/env.ts` (no remaining callers)

## 0.3.1

- Make `route_short_name` and `route_long_name` optional, matching GTFS spec (conditionally required: at least one must be present)
- Allow `transfers.transfer_type` to be empty (defaults to 0 per GTFS spec)
- Make `stop_times.arrival_time` and `stop_times.departure_time` optional for intermediate stops per GTFS spec
- Make `stops.stop_lat` and `stops.stop_lon` optional for generic nodes (`location_type=3`) and boarding areas (`location_type=4`) per GTFS spec

## 0.3.0

### Breaking changes

- **`fromZip()` now only accepts `string`** (path or URL). If you were passing `ArrayBuffer` or `Uint8Array`, use the new `fromZipData()` method instead
- **`skipFiles` behavior change**: files listed in `skipFiles` are now skipped during ZIP extraction entirely (not just excluded from DB loading), improving performance for large feeds

### New features

- Add `GtfsSqlJs.fromZipData(zipData, options?, source?)` static method for loading from pre-loaded ZIP data (`ArrayBuffer` or `Uint8Array`)
- Extract only known GTFS files from ZIP, skipping unrecognized files for faster extraction

### Internal improvements

- Simplify checksum module to use global `crypto.subtle` directly (available in both browsers and Node.js 18+, which is the minimum engine version); remove multi-branch environment detection, dynamic `import('crypto')` fallback, and empty `catch` block
- Extract shared `isNodeEnvironment()` helper into `utils/env.ts`, replacing inline `typeof process` checks in zip-loader and gtfs-rt-loader
- Narrow `loadGTFSZip()` parameter from `string | ArrayBuffer | Uint8Array` to `ArrayBuffer | Uint8Array` (string path was dead code)
- Replace `unknown[]` with proper `ProtobufTimeRange[]` and `ProtobufEntitySelector[]` types in gtfs-rt-loader
- Refactor `convertKeysToSnakeCase` to use `Object.entries()`, removing `for..in` loop with `as Record<string, unknown>` cast
- Replace `as Record<string, unknown>` widening casts on `stmt.getAsObject()` across all query files with proper `ParamsObject` type from sql.js
- Replace non-null assertions (`!`) with optional chaining (`?.`) for `Map.get()` calls in rt-trip-updates and stop-times
- Replace `this.SQL!.Database()` non-null assertion with explicit guard in gtfs-sqljs

## 0.2.2

- Fix `getStopTimes` and `getTrips` returning all results instead of none when called with a date outside the feed's validity range
- Allow `fare_attributes.transfers` to be empty (NULL), meaning unlimited transfers per GTFS spec

## 0.2.0

- Add `pickupType` and `dropOffType` filters to `getStopTimes`, with `COALESCE` handling so NULL (empty) is treated as 0 (regular) per GTFS spec
- Add `PickupDropOffType` enum for GTFS static pickup/drop-off type values
- Replace `getCalendarByServiceId(serviceId)` with `getCalendars(filters?)` for consistent filter-based API
- Fix README: replace non-existent `getStopById` with `getStops({ stopId })`

## 0.1.2

- Remove dist/ from repository (built at publish time)
- Upgrade vitest from v1 to v4
- Upgrade ESLint from v8 to v9 with flat config migration
- Upgrade @typescript-eslint from v6 to v8 (via typescript-eslint)
- Upgrade TypeScript from v5.3 to v5.9
- Upgrade protobufjs from v7 to v8
- Upgrade @types/node from v20 to v25
- Upgrade sql.js, tsup, @types/papaparse to latest within-range versions
- Fix 10 npm audit vulnerabilities (minimatch ReDoS, esbuild dev server)

## 0.1.1

- Publish as ESM-only package (`"type": "module"`)
- Remove CJS build output
- Add automated CD workflow for npm publishing on GitHub release
- Remove migration guide from README (first public release)

## 0.1.0

- Initial public release
- GTFS static data loading from ZIP files (URL or local path)
- High-performance bulk loading with progress tracking
- Flexible filter-based query API for stops, routes, trips, stop times, shapes
- GTFS Realtime support (alerts, trip updates, vehicle positions)
- GeoJSON export for shapes
- Smart caching with IndexedDB and FileSystem stores
- Database export/import support
- Full TypeScript types
