# Pluggable Database Adapter — Design & Plan

## Problem

gtfs-sqljs is currently hard-coupled to `sql.js`. Every query module imports the `Database`/`Statement` types directly from `sql.js` and calls its concrete methods (`db.prepare`, `stmt.bind`, `stmt.step`, `stmt.getAsObject`, `stmt.free`, `db.run`, `db.export`, `db.close`).

This is fine for **browsers** and **Node.js**, where sql.js works well. It breaks on two environments that are rising in importance:

- **React Native** — Hermes and JavaScriptCore do not support WebAssembly, so `initSqlJs()` cannot run. sql.js's asm.js fallback technically works but is slow, memory-hungry (a 60 MiB GTFS DB becomes 150–250 MiB of JS heap), and crashes on mid-range Android devices. Meanwhile, excellent native SQLite bindings exist (`op-sqlite`, `expo-sqlite`) and are the idiomatic choice for React Native.
- **Node.js** — users who want no WASM at all could prefer `better-sqlite3`, which is faster and file-backed rather than in-memory.

The valuable, reusable part of this library is its **GTFS schema, CSV ingestion pipeline, and query layer**. The SQLite driver is an implementation detail. We should make it swappable.

## Goals

1. Let a consumer plug in any SQLite driver (sql.js, op-sqlite, expo-sqlite, better-sqlite3, …) behind the same `GtfsSqlJs` API.
2. **Treat sql.js as just one adapter among others.** The core library has no hard dependency on sql.js; the sql.js adapter ships as an opt-in module that users must explicitly import and pass in.
3. Minimize adapter surface — a new consumer should be able to write an adapter in <100 lines.
4. No meaningful performance regression vs. today's direct sql.js usage for consumers who do choose the sql.js adapter.
5. Keep the query API surface (`GtfsSqlJs.fromZip`, `.fromDatabase`, `.getRoutes()`, etc.) stable in shape — the only change required at the call site is picking an adapter and `await`-ing queries.

## Non-goals

- Multiple drivers active simultaneously in the same `GtfsSqlJs` instance.
- Rewriting the existing sql.js integration from scratch — we wrap it via an adapter, not replace it.
- Exposing arbitrary native driver features through gtfs-sqljs (consumers who need raw driver access can always `getRawDatabase()` escape hatch).
- Supporting drivers without prepared-statement semantics — those are out of scope for the first version.

## Prerequisites

**Done.** The ingestion-optimization work described in `gtfs-optimize-ingestion.md` landed on `main` as PR [#42](https://github.com/sysdevrun/gtfs-sqljs/pull/42) and ships in v0.5.0. It removed the bulk-load PRAGMA block from `initFromZipData`, switched the loader to a single prepared INSERT per table, and dropped the double CSV parse. Together these changes eliminated the only non-trivial driver-portability wrinkle (PRAGMA semantics on file-backed native drivers) and shrank the ingestion surface the adapter interface has to cover — verified by `grep -ri PRAGMA src/` returning zero matches.

## Current sql.js API surface used by gtfs-sqljs

A full grep confirms the surface is narrow and consistent. Only these methods are called:

**`Database` methods:**
- `new SQL.Database()` and `new SQL.Database(Uint8Array)` — construction from scratch or from an existing DB buffer.
- `db.prepare(sql: string): Statement`
- `db.run(sql: string): void` — for PRAGMAs, DDL, BEGIN/COMMIT/ROLLBACK, DELETE.
- `db.export(): Uint8Array` — used by the cache layer and `GtfsSqlJs.export()`.
- `db.close(): void`

**`Statement` methods:**
- `stmt.bind(params: SqlValue[]): void` — positional parameters only; no named params in use today.
- `stmt.step(): boolean`
- `stmt.getAsObject(): Record<string, SqlValue>` — the only row-materialization shape used.
- `stmt.run(params: SqlValue[]): void` — used in `data-loader.ts` for batched inserts.
- `stmt.free(): void`

Calls we do **not** make today, and therefore don't need to abstract: `stmt.exec`, `stmt.get`, `stmt.getColumnNames`, `stmt.reset`, named parameters, BLOB values, user-defined functions, `db.iterateStatements`, virtual tables.

**All calls are synchronous.** This is a key constraint that shapes the design below.

## The sync-vs-async problem

sql.js is synchronous. **better-sqlite3** is synchronous. **op-sqlite** via JSI is synchronous-capable (it exposes `db.executeSync()` alongside `db.execute()`). **expo-sqlite** is *asynchronous-first*: `executeAsync`, `runAsync`, etc., with only a limited synchronous API (`*Sync` variants) available when the DB is opened on the JS thread.

We have three options:

### Option A — Keep everything synchronous

Keep the existing sync query signatures (`gtfs.getRoutes()` returns `Route[]`, not `Promise<Route[]>`). All adapters must expose sync primitives.

- ✅ Zero public-API change for existing callers.
- ✅ Matches sql.js / better-sqlite3 naturally.
- ✅ Works with op-sqlite in sync mode.
- ❌ Excludes expo-sqlite's async API entirely. Expo users would need to either open the DB synchronously (supported but less common) or use op-sqlite instead.
- ❌ Blocks the JS thread during queries. Most GTFS queries are sub-millisecond, so this is usually fine — but `getShapesToGeojson({ routeId })` on a large feed took 6.7 ms in testing, and heavier queries could be 50+ ms, which is perceptible in a 16.7 ms UI frame.

### Option B — Make everything async

Change every query method to return `Promise<T>`. All adapters expose async primitives; sync drivers are trivially wrappable via `Promise.resolve()`.

- ✅ Works with every driver without exception.
- ✅ Doesn't block the UI thread on slow drivers.
- ❌ **Breaking change** for every caller (`const routes = gtfs.getRoutes()` → `const routes = await gtfs.getRoutes()`).
- ❌ Adds a microtask per query even in the sync case — negligible perf cost but feels wrong for sub-millisecond operations.

### Option C — Dual API (recommended)

Keep the existing sync methods (`getRoutes()`, `getStops()`, etc.) for drivers that support synchronous execution, **and** add async counterparts (`getRoutesAsync()`, or a second instance class `GtfsSqlJsAsync`) for async-only drivers.

- ✅ No breaking change for existing sql.js / Node users.
- ✅ Expo users get a path (`GtfsSqlJsAsync` + expo-sqlite adapter).
- ❌ Two parallel code paths to maintain.

**Decision: Option B (async-only).** The library is pre-1.0 with low adoption, so the breaking change is acceptable. Async is the only option that supports every target driver (sql.js, better-sqlite3, op-sqlite, expo-sqlite) with a single code path and no second parallel class to maintain. Sync drivers wrap trivially as `Promise.resolve(...)`; the microtask overhead is irrelevant for all practical GTFS query volumes.

The rest of this document assumes Option B. All query methods return `Promise<T>`; all adapter methods are async.

## Proposed adapter interface

A new file `src/adapters/types.ts`:

```ts
export type SqlValue = string | number | null | Uint8Array;
export type Row = Record<string, SqlValue>;

export interface GtfsStatement {
  /** Bind positional parameters. May be called once per execution. */
  bind(params: SqlValue[]): Promise<void>;
  /** Advance cursor. Resolves true if a row is available. */
  step(): Promise<boolean>;
  /** Materialize current row as an object keyed by column name. */
  getAsObject(): Promise<Row>;
  /** Execute an INSERT/UPDATE/DELETE with parameters, no cursor needed. */
  run(params?: SqlValue[]): Promise<void>;
  /** Release native resources. Called after every prepare(). */
  free(): Promise<void>;
}

export interface GtfsDatabase {
  /** Prepare a SQL statement for repeated execution. */
  prepare(sql: string): Promise<GtfsStatement>;
  /** Execute a one-shot SQL string (PRAGMA, DDL, transaction control). */
  run(sql: string): Promise<void>;
  /** Serialize the database to a byte buffer. Throws if the driver is file-backed and cannot serialize. */
  export(): Promise<Uint8Array>;
  /** Close and release the database. */
  close(): Promise<void>;
}

/** Factory passed into GtfsSqlJs for flows that need to create / load a DB
 *  on the caller's behalf (fromZip, fromDatabase). Not needed for `attach()`. */
export interface GtfsDatabaseAdapter {
  /** Create an empty database (used by fromZip / fromZipData). */
  createEmpty(): Promise<GtfsDatabase>;
  /** Open an existing database from a byte buffer (used by fromDatabase).
   *  File-backed drivers that cannot load bytes into a fresh DB may throw. */
  openFromBuffer(buffer: ArrayBuffer | Uint8Array): Promise<GtfsDatabase>;
}
```

This is literally a structural subset of sql.js's API, so a sql.js adapter is a one-line identity mapping. Ports to other drivers are a few dozen lines each.

### Adapter factory vs. pre-opened handle

There are two distinct scenarios and we support both:

1. **Library-managed DB** — caller has a URL or a `Uint8Array`, wants `GtfsSqlJs` to create a DB and fill it. The caller hands in a factory (`GtfsDatabaseAdapter`) and the library calls `createEmpty()` / `openFromBuffer()` internally. Natural fit for sql.js (in-memory) and for scenarios where the library ingests a GTFS ZIP from scratch.
2. **Caller-managed DB** — caller has already opened a database connection themselves (typical for file-backed native drivers: op-sqlite, expo-sqlite, better-sqlite3). They know the file path, the journal mode, the encryption key, whether the schema is already populated, etc. For these cases they hand in a live `GtfsDatabase` via a new `GtfsSqlJs.attach()` entry point. No factory is needed.

So the adapter surface splits cleanly:

```ts
// Case 1: library-managed (factory on GtfsSqlJsOptions).
const gtfs = await GtfsSqlJs.fromZip(url, {
  adapter: await createSqlJsAdapter({ locateFile }),
});

// Case 2: caller-managed (live handle, no factory).
import { open } from '@op-engineering/op-sqlite';
import { wrapOpSqlite } from './adapters/OpSqliteAdapter';
const raw = open({ name: 'gtfs.db' });
const gtfs = await GtfsSqlJs.attach(wrapOpSqlite(raw), {
  skipSchema: true, // the file already has the GTFS schema
});
```

`attach()` semantics:
- Takes a `GtfsDatabase` (already connected) and the same non-DB options as `fromZip` (cache, etc.).
- Does **not** take `adapter` — the handle *is* the "adapter output".
- `skipSchema: boolean` (default `false`) — when `true`, `attach()` trusts that the schema and data already exist and performs no DDL or ingestion. When `false`, runs the schema DDL exactly once (idempotent `CREATE TABLE IF NOT EXISTS`) so `attach()` on a fresh empty DB works too.
- Ownership: the caller retains ownership of the handle. `gtfs.close()` does **not** close a handle passed via `attach()` by default; it calls the adapter's `close()` only for handles the library itself created. (Configurable via an `ownsDatabase: true` flag on `attach()` if callers prefer the old behaviour.)

In short: **yes, the client can absolutely hand in an already-open database, and for file-backed drivers that's the recommended path.** The factory interface is there for the in-memory / URL-loading case where the library needs to build the DB itself.

### Wiring it into `GtfsSqlJs`

`GtfsSqlJsOptions` gains a **required** field:

```ts
export interface GtfsSqlJsOptions {
  // …existing fields (cache, fetch, progress hooks, …)…

  /**
   * Required: database adapter. Use `createSqlJsAdapter()` from
   * `gtfs-sqljs/adapters/sql-js` for the browser/Node sql.js path, or
   * plug in a custom adapter (op-sqlite, expo-sqlite, better-sqlite3, …).
   */
  adapter: GtfsDatabaseAdapter;
}
```

Internally, `GtfsSqlJs.db` has type `GtfsDatabase | null`. **The core module no longer imports sql.js.** The existing `SQL` and `locateFile` fields move off `GtfsSqlJsOptions` entirely; they are now options on `createSqlJsAdapter()` in the sql.js adapter module.

`GtfsSqlJs.fromZip` / `fromZipData` / `fromDatabase` all require `options.adapter` (the factory). `GtfsSqlJs.attach(db, options)` takes a pre-opened `GtfsDatabase` instead and does not require `adapter`. Calling `fromZip` without an `adapter` is a TypeScript error and a runtime throw pointing to the sql.js adapter as the most common choice, or to `attach()` for callers who already have an open handle.

### Scope of the internal change

Files that need editing:

| File | Change |
|---|---|
| `src/adapters/types.ts` | **New.** Defines `GtfsDatabase`, `GtfsStatement`, `GtfsDatabaseAdapter`, `SqlValue`, `Row`, `ExportNotSupportedError`. |
| `src/adapters/sql-js/index.ts` | **New, opt-in module.** Ships `createSqlJsAdapter(opts)`. Imported via subpath export `gtfs-sqljs/adapters/sql-js`. This is the only file in the repo that imports `sql.js`. |
| `src/gtfs-sqljs.ts` | Remove all `sql.js` imports. Replace `Database`/`SqlJsStatic` field types with `GtfsDatabase`/`GtfsDatabaseAdapter`. `initFromZipData` / `initFromDatabase` call `options.adapter.createEmpty()` / `openFromBuffer()`. Add `GtfsSqlJs.attach(db, options)` that accepts a pre-opened `GtfsDatabase` and skips adapter factory calls; it runs `CREATE TABLE IF NOT EXISTS` DDL unless `skipSchema: true`. Track an `ownsDatabase` flag so `close()` only releases handles the library itself created. Drop the `SQL` and `locateFile` fields from `GtfsSqlJsOptions`. `export()` delegates to `this.db.export()`. |
| `src/loaders/data-loader.ts` | Replace `import type { Database } from 'sql.js'` with `import type { GtfsDatabase } from '../adapters/types'`. No runtime change — all calls (`db.run`, `db.prepare`, `stmt.run`, `stmt.free`) are already on the adapter surface. |
| `src/loaders/gtfs-rt-loader.ts` | Same: import type from adapter module. |
| `src/schema/gtfs-rt-schema.ts` | Same. |
| `src/queries/*.ts` (10 files) | Same. Replace `import type { Database, ParamsObject } from 'sql.js'` with `import type { GtfsDatabase, Row } from '../adapters/types'`. Replace `ParamsObject` usages with `Row`. Every query function becomes `async` and its callers `await` it. |
| `src/cache/*.ts` | No change — cache operates on `Uint8Array` buffers, not the DB handle. |
| `src/index.ts` | Export `GtfsDatabase`, `GtfsStatement`, `GtfsDatabaseAdapter`, `SqlValue`, `Row`, `ExportNotSupportedError`. Do **not** re-export the sql.js adapter — consumers import it from the subpath. |
| `package.json` | Add `"exports"` map with `"."` → main bundle and `"./adapters/sql-js"` → sql.js adapter bundle. Move `sql.js` from `dependencies` to `peerDependencies` + `peerDependenciesMeta.optional = true`; add to `devDependencies` for the repo's own tests. |
| `tsup.config.ts` | Add a second entry point for `src/adapters/sql-js/index.ts` so it is bundled and tree-shakeable independently of the core. |

Because the adapter interface was designed to be a literal subset of the sql.js call sites we already have, **no SQL changes, no logic changes, no query rewrites** — the diff is mostly import path swaps plus the new adapter files.

### sql.js adapter sketch (opt-in, subpath `gtfs-sqljs/adapters/sql-js`)

```ts
// src/adapters/sql-js/index.ts
import initSqlJs, { type SqlJsStatic, type Database as SqlJsDatabase } from 'sql.js';
import type { GtfsDatabaseAdapter, GtfsDatabase, GtfsStatement, Row, SqlValue } from '../types';

export interface SqlJsAdapterOptions {
  SQL?: SqlJsStatic;
  locateFile?: (filename: string) => string;
}

export async function createSqlJsAdapter(opts: SqlJsAdapterOptions = {}): Promise<GtfsDatabaseAdapter> {
  const SQL = opts.SQL || (await initSqlJs(opts.locateFile ? { locateFile: opts.locateFile } : {}));

  const wrapStatement = (stmt: ReturnType<SqlJsDatabase['prepare']>): GtfsStatement => ({
    bind: async (params) => { stmt.bind(params as SqlValue[]); },
    step: async () => stmt.step(),
    getAsObject: async () => stmt.getAsObject() as Row,
    run: async (params) => stmt.run(params as SqlValue[] | undefined),
    free: async () => stmt.free(),
  });

  const wrapDatabase = (db: SqlJsDatabase): GtfsDatabase => ({
    prepare: async (sql) => wrapStatement(db.prepare(sql)),
    run: async (sql) => { db.run(sql); },
    export: async () => db.export(),
    close: async () => db.close(),
  });

  return {
    createEmpty: async () => wrapDatabase(new SQL.Database()),
    openFromBuffer: async (buf) => wrapDatabase(new SQL.Database(buf instanceof Uint8Array ? buf : new Uint8Array(buf))),
  };
}
```

The wrapping functions are monomorphic closures — V8/Hermes inline them trivially, so the overhead is effectively zero.

Consumer usage:

```ts
import { GtfsSqlJs } from 'gtfs-sqljs';
import { createSqlJsAdapter } from 'gtfs-sqljs/adapters/sql-js';

const gtfs = await GtfsSqlJs.fromZip(url, {
  adapter: await createSqlJsAdapter({ locateFile: (f) => `/sqljs/${f}` }),
});
const routes = await gtfs.getRoutes();
```

Because `sql.js` is declared as an **optional peer dependency**, projects that choose another adapter (op-sqlite, better-sqlite3, …) never install or bundle sql.js. This is the key benefit of extracting it.

## Adapters that ship with the library

The sql.js adapter is the one adapter we ship as a built-in module (subpath `gtfs-sqljs/adapters/sql-js`) because (a) it has been the project's home turf from day one, (b) our own test suite depends on it, and (c) it is by far the most likely choice for browser users. It is still opt-in at the consumer level: the core module does not import it, and projects that choose a different adapter do not ship sql.js.

All other reference adapters live in `examples/adapters/` (copy-into-project, same pattern as the existing `examples/cache/` stores):

1. **`OpSqliteAdapter`** (React Native, the primary motivating use case). Uses `@op-engineering/op-sqlite`'s JSI API.
2. **`ExpoSqliteAdapter`** using `expo-sqlite`'s async API from an `openDatabaseAsync()` handle.
3. **`BetterSqlite3Adapter`** (Node.js, file-backed). Useful for server-side pipelines.

These are reference implementations, not npm packages — that keeps `gtfs-sqljs`'s dependency graph minimal (sql.js as an *optional* peer dep, nothing else).

## `export()` and the caching layer

`db.export()` is used today in two places:
1. `GtfsSqlJs.export()` — public API for serialization.
2. The cache layer — saves processed DB buffers to IndexedDB / filesystem.

sql.js and better-sqlite3 both support `.serialize()`/`.export()`. **op-sqlite** and **expo-sqlite** operate on a file-backed DB and do not have an in-memory export — they're files on disk; "exporting" means reading the file.

**Decision: `export()` is a required method on the adapter interface, but adapters for file-backed drivers throw a well-known `ExportNotSupportedError` from it.** The cache layer catches that error and logs a warning + no-ops (it does not throw — a cacheless run is still a valid run). File-backed drivers don't need the cache anyway because their DB *is* already persisted on disk; we document that in the adapter README. We can add a structured `readFile(path)` helper later if a real use case appears, but it is not part of v0.6.

## Ingestion loop and PRAGMAs

**Resolved — merged to `main` in PR [#42](https://github.com/sysdevrun/gtfs-sqljs/pull/42).** The bulk-load PRAGMA block is deleted. Benchmarking showed the aggregate effect of all five PRAGMAs on sql.js was within noise (≤1%), so they did not earn their keep, and removing them eliminates the adapter-portability problem they would otherwise create.

Verification (on `main` at time of this doc update):

```
$ git grep -ni PRAGMA -- src/
(no matches)
```

The deleted calls were:

```
PRAGMA synchronous    = OFF        -- before ingestion (removed)
PRAGMA journal_mode   = MEMORY     -- before ingestion (removed)
PRAGMA temp_store     = MEMORY     -- before ingestion (removed)
PRAGMA cache_size     = -64000     -- before ingestion (removed)
PRAGMA locking_mode   = EXCLUSIVE  -- before ingestion (removed)
PRAGMA synchronous    = FULL       -- after ingestion  (removed)
PRAGMA locking_mode   = NORMAL     -- after ingestion  (removed)
```

The ingestion path now touches no PRAGMAs.

**Adapter implication: nothing.** The core library does not apply bulk-load PRAGMAs, so adapters for op-sqlite, expo-sqlite, and better-sqlite3 do not need to honor them, reject them, or work around them. If a given driver genuinely benefits from driver-specific ingestion tuning, that tuning lives inside the adapter's setup code (or is applied by the caller before `attach()`), not in the shared ingestion path.

This was previously the single biggest adapter-portability wrinkle in this plan; it is now gone.

## Testing strategy

1. **Existing test suite runs unchanged on sql.js adapter.** This is the primary regression guard. Current tests exercise every query method — after the refactor, they still use the default adapter and must all pass. No test code changes except import paths if any test touches sql.js types directly.
2. **New adapter-contract test suite** (`tests/adapter-contract.test.ts`). Parameterized over adapter implementations. Asserts the same observable behavior (INSERT → SELECT round-trip, transaction control, statement reuse, row iteration) across all adapters. Runs sql.js **and better-sqlite3** in CI by default (both are pure Node installs with no simulator requirement); op-sqlite/expo-sqlite tests run only locally or in RN-specific CI because they require native builds.
3. **End-to-end test on better-sqlite3 adapter** (`tests/e2e-better-sqlite3.test.ts`). A full `GtfsSqlJs.attach()` round-trip against the sample fixture (`tests/fixtures/sample-feed.zip`) using a file-backed better-sqlite3 connection opened in a `tmp/` path:
   - Open a fresh better-sqlite3 DB → wrap it with `BetterSqlite3Adapter` → `GtfsSqlJs.attach(db)`.
   - Load the fixture via `fromZipData` using the attached handle.
   - Run the same assertions as `tests/sample-feed.test.ts` (agency lookup, stop counts, route/trip/stop-time round-trips) to prove the query layer is adapter-agnostic.
   - Verify `export()` throws `ExportNotSupportedError` and that the cache layer catches it and no-ops.
   - Close the adapter; confirm the underlying file remains on disk (caller owns the handle unless `ownsDatabase: true`).

   This is the non-sql.js adapter we can actually run in CI — it catches the vast majority of adapter-interface bugs (sync-vs-async boundary, transaction semantics, `stmt.run` vs `stmt.all` shape differences, error propagation) without needing iOS/Android. Sized to finish in under 10 s so it fits in the main vitest run. `better-sqlite3` lives in `devDependencies` alongside sql.js.
4. **Manual integration test for RN path.** A small Expo example app (`examples/react-native-gtfs`) that consumes gtfs-sqljs + `OpSqliteAdapter` against a prebuilt `.db`. Smoke test on iOS and Android simulator before each release.

## Migration & compatibility

**This is a breaking release.** The library is pre-1.0 with low adoption, so we take the opportunity to make a clean cut.

- `v0.6.0` introduces the adapter layer, flips every query method to async, and **requires callers to pass an adapter explicitly**. There is no implicit sql.js fallback.
- Typical migration for an existing sql.js user (library-managed DB):

  ```diff
  - import { GtfsSqlJs } from 'gtfs-sqljs';
  + import { GtfsSqlJs } from 'gtfs-sqljs';
  + import { createSqlJsAdapter } from 'gtfs-sqljs/adapters/sql-js';

  - const gtfs = await GtfsSqlJs.fromZip(url, { locateFile });
  - const routes = gtfs.getRoutes();
  + const gtfs = await GtfsSqlJs.fromZip(url, {
  +   adapter: await createSqlJsAdapter({ locateFile }),
  + });
  + const routes = await gtfs.getRoutes();
  ```

- Native / file-backed path (caller-managed DB — op-sqlite, expo-sqlite, better-sqlite3):

  ```ts
  import { open } from '@op-engineering/op-sqlite';
  import { GtfsSqlJs } from 'gtfs-sqljs';
  import { wrapOpSqlite } from './adapters/OpSqliteAdapter';

  const raw = open({ name: 'gtfs.db' });
  const gtfs = await GtfsSqlJs.attach(wrapOpSqlite(raw), { skipSchema: true });
  ```

- **sql.js moves from `dependencies` to optional `peerDependencies`.** Projects using the sql.js adapter install sql.js themselves (or keep it, since most already have it transitively). Projects using op-sqlite, expo-sqlite, or better-sqlite3 never pull in sql.js at all.
- **Clean cut on type re-exports.** `SqlJsStatic` and sql.js `Database` are no longer re-exported from `src/index.ts`. Consumers annotating against them migrate to `GtfsDatabase`, or import from `sql.js` directly.
- `SQL` and `locateFile` are removed from `GtfsSqlJsOptions`. Equivalent options live on `createSqlJsAdapter()`.
- CHANGELOG calls out the async switch, the required adapter, the peer-dependency move, and the dropped re-exports at the top of the v0.6.0 entry.

## Phased rollout

**Phase 1 — refactor (target: one week of focused work)**
- Add `src/adapters/types.ts` and `src/adapters/sql-js/index.ts`. Delete any sql.js imports from everywhere else in `src/`.
- Add a `./adapters/sql-js` subpath export to `package.json`; add a second entry to `tsup.config.ts`.
- Change import types across all `src/queries/*`, `src/loaders/*`, `src/schema/*`, and `src/gtfs-sqljs.ts`. Largely a search-and-replace of `Database` (from sql.js) → `GtfsDatabase` and `ParamsObject` → `Row`.
- Convert every query function and every public `GtfsSqlJs` method to `async`. Update internal call sites to `await` accordingly.
- Make `adapter` a required field on `GtfsSqlJsOptions` (for `fromZip` / `fromDatabase`). Remove `SQL` and `locateFile` from core options (move them onto `createSqlJsAdapter`).
- Add `GtfsSqlJs.attach(db, options)` entry point for caller-managed handles. Wire `ownsDatabase` / `skipSchema` flags. Reference adapters for file-backed drivers should document `attach()` as the primary usage pattern.
- Move `sql.js` from `dependencies` to optional `peerDependencies`; keep it in `devDependencies` for tests.
- Update the test suite: every test calling a query method now awaits it, and every test bootstrap passes `adapter: await createSqlJsAdapter()` explicitly.
- Add `better-sqlite3` and `@types/better-sqlite3` to `devDependencies`. Ship `BetterSqlite3Adapter` (see Phase 2) and the `tests/e2e-better-sqlite3.test.ts` end-to-end test so CI validates at least one non-sql.js adapter on every run.
- Drop sql.js type re-exports from `src/index.ts`.
- Publish as `v0.6.0-alpha`.

**Phase 2 — reference adapters (target: 2–3 days)**
- `examples/adapters/BetterSqlite3Adapter.ts` + README. **Promoted in Phase 1** to the repo's own dev/test dependency tree because it powers the Phase 1 CI end-to-end test. The `examples/` copy is the canonical consumer-facing reference; the same file is symlinked (or `import`-re-exported) from `tests/helpers/` so the test does not drift from the published example.
- `examples/adapters/OpSqliteAdapter.ts` + README.
- `examples/adapters/ExpoSqliteAdapter.ts` + README.
- A `examples/react-native-gtfs/` Expo app demonstrating end-to-end usage with a downloaded GTFS DB.

**Phase 3 — stabilize**
- Run against the reference React Native app on iOS + Android. File any adapter-interface mismatches (expect surprises around large-array bind parameters and per-driver transaction semantics).
- Publish `v0.6.0`.
- Update README with an "Alternative drivers" section pointing to the examples.

_(Phase 4 removed: async is the default API as of v0.6, so there is no separate async class to add later.)_

## Effort estimate

~1 week for Phase 1 (mostly mechanical refactor + test validation), plus ~3 days for Phase 2 reference adapters, plus ~2 days Phase 3 stabilization against a real RN app. **Total: ~2 weeks of focused work for v0.6.0.**

## Resolved decisions

All previously open questions have been resolved for v0.6:

1. **Sync vs async → async (Option B).** Single code path, supports every driver including expo-sqlite. Breaking change accepted (library is pre-1.0, low adoption).
2. **sql.js role → extracted to an opt-in subpath module (`gtfs-sqljs/adapters/sql-js`), required-not-default.** The core library no longer imports sql.js; `GtfsSqlJsOptions.adapter` is required for `fromZip` / `fromDatabase`. sql.js moves to an optional peer dependency.
2a. **Two entry points: factory (`fromZip`/`fromDatabase` with an adapter) and pre-opened handle (`attach(db)`).** Factory is for library-managed DBs (URL loading, in-memory sql.js). `attach()` is for caller-managed DBs (file-backed native drivers where the client already has a live connection). `attach()` does not own the handle by default; close is opt-in via `ownsDatabase`.
3. **Cache gating when `export()` is unsupported → log-warn + no-op.** A cacheless run is still a valid run; the cache layer catches `ExportNotSupportedError` and continues.
4. **Reference adapter distribution → `examples/adapters/`** for non-sql.js drivers (copy-into-project, same pattern as existing `examples/cache/`). Promotion to published `@gtfs-sqljs/adapter-*` packages can happen later if adoption warrants.
5. **sql.js type re-exports → dropped.** Clean cut in v0.6. Consumers migrate to `GtfsDatabase`; anyone still needing sql.js types can import them directly from `sql.js`.
6. **PRAGMAs during ingestion → removed entirely (done).** Landed via PR #42 on `main` and shipping in v0.5.0. `grep -ri PRAGMA src/` returns zero matches. v0.6 adapters are not required to implement any PRAGMA behavior; driver-specific tuning, if any, lives inside the adapter or is applied by the caller.
7. **Non-sql.js adapter in CI → better-sqlite3.** It is a pure Node install (no iOS/Android simulator or WASM toolchain), so it runs in the same `vitest` invocation as the sql.js tests. `BetterSqlite3Adapter` is therefore elevated from "copy-paste example" to a CI-run reference: the file lives in `examples/adapters/` for consumers but is also loaded by `tests/e2e-better-sqlite3.test.ts`. op-sqlite and expo-sqlite remain manual/local because they need native toolchains.
