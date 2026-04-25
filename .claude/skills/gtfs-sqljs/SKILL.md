---
name: gtfs-sqljs
description: Reference for building apps with gtfs-sqljs — a TypeScript library for loading GTFS transit data into a pluggable SQLite database (sql.js / better-sqlite3 / op-sqlite / expo-sqlite). Covers installation, adapter choice, Web Worker + Comlink usage, async query methods, GTFS-RT feeds, and caching.
  TRIGGER when: code imports `gtfs-sqljs`, or user asks to use gtfs-sqljs, or user works on a project that depends on gtfs-sqljs, or user needs to manipulate/query/load a GTFS file.
  DO NOT TRIGGER when: general programming, unrelated libraries.
user-invocable: false
---

# gtfs-sqljs

TypeScript library for loading GTFS (General Transit Feed Specification) transit data into a SQLite database through a pluggable adapter. Works in browser, Node.js (18+), and React Native (via op-sqlite / expo-sqlite adapters). ESM-only.

Starting with **v0.6.0**, the library speaks to a small async `GtfsDatabase` interface. The core package no longer imports `sql.js` — you pick an adapter. All query methods are async and return `Promise<T>`.

## Installation

```bash
npm install gtfs-sqljs
# plus ONE (or more) adapter peer dependency:
npm install sql.js              # browser / Node WASM
npm install better-sqlite3      # Node native, file-backed
# op-sqlite / expo-sqlite: supply your own wrapper implementing GtfsDatabaseAdapter
```

Both `sql.js` and `better-sqlite3` are declared as *optional* peer dependencies — you only install the one(s) you use.

## Choosing an adapter

| Adapter | Subpath | Best for |
| --- | --- | --- |
| sql.js | `gtfs-sqljs/adapters/sql-js` | Browser, worker threads, Node.js in-memory |
| better-sqlite3 | `gtfs-sqljs/adapters/better-sqlite3` | Node.js, file-backed, large feeds, CLI tools |
| Custom (op-sqlite, expo-sqlite, …) | user code | React Native |

## WASM file requirement (sql.js adapter, browser)

sql.js ships a `sql-wasm.wasm` file that must be reachable at runtime. In Node.js sql.js handles this automatically; in the browser you must tell it where to look via `locateFile`.

### Vite

```typescript
import { GtfsSqlJs } from 'gtfs-sqljs';
import { createSqlJsAdapter } from 'gtfs-sqljs/adapters/sql-js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

const adapter = await createSqlJsAdapter({ locateFile: () => sqlWasmUrl });
const gtfs = await GtfsSqlJs.fromZip('https://example.com/gtfs.zip', { adapter });
```

### Webpack

Copy `node_modules/sql.js/dist/sql-wasm.wasm` to your public/static assets directory, then:

```typescript
import { GtfsSqlJs } from 'gtfs-sqljs';
import { createSqlJsAdapter } from 'gtfs-sqljs/adapters/sql-js';

const adapter = await createSqlJsAdapter({
  locateFile: (filename) => `/assets/${filename}`,
});
const gtfs = await GtfsSqlJs.fromZip('https://example.com/gtfs.zip', { adapter });
```

### CDN

```typescript
import { GtfsSqlJs } from 'gtfs-sqljs';
import { createSqlJsAdapter } from 'gtfs-sqljs/adapters/sql-js';

const adapter = await createSqlJsAdapter({
  locateFile: (filename) => `https://sql.js.org/dist/${filename}`,
});
const gtfs = await GtfsSqlJs.fromZip('https://example.com/gtfs.zip', { adapter });
```

### Passing a pre-initialized SqlJsStatic

If you already called `initSqlJs` elsewhere (e.g. to share the module across loads), hand it in:

```typescript
import initSqlJs from 'sql.js';
import { createSqlJsAdapter } from 'gtfs-sqljs/adapters/sql-js';

const SQL = await initSqlJs({ locateFile: () => wasmUrl });
const adapter = await createSqlJsAdapter({ SQL });
```

## Web Worker recommendation (browser)

In the browser, gtfs-sqljs should run inside a Web Worker to avoid blocking the main thread during GTFS loading and querying. `comlink` exposes the worker API seamlessly. Because every query method is now `async`, worker proxying is very natural.

```bash
npm install comlink
```

```typescript
// gtfs-worker.ts — runs in a Web Worker
import * as Comlink from 'comlink';
import { GtfsSqlJs } from 'gtfs-sqljs';
import { createSqlJsAdapter } from 'gtfs-sqljs/adapters/sql-js';

let gtfs: GtfsSqlJs;

const api = {
  async load(zipUrl: string, wasmUrl: string) {
    const adapter = await createSqlJsAdapter({ locateFile: () => wasmUrl });
    gtfs = await GtfsSqlJs.fromZip(zipUrl, { adapter });
  },
  getRoutes(filters?: Parameters<GtfsSqlJs['getRoutes']>[0]) {
    return gtfs.getRoutes(filters);
  },
  getStops(filters?: Parameters<GtfsSqlJs['getStops']>[0]) {
    return gtfs.getStops(filters);
  },
  getTrips(filters?: Parameters<GtfsSqlJs['getTrips']>[0]) {
    return gtfs.getTrips(filters);
  },
  getStopTimes(filters?: Parameters<GtfsSqlJs['getStopTimes']>[0]) {
    return gtfs.getStopTimes(filters);
  },
  async close() {
    await gtfs.close();
  },
};

Comlink.expose(api);
```

```typescript
// main.ts — runs on the main thread
import * as Comlink from 'comlink';

const worker = new Worker(new URL('./gtfs-worker.ts', import.meta.url), { type: 'module' });
const gtfs = Comlink.wrap<typeof import('./gtfs-worker').api>(worker);

await gtfs.load('https://example.com/gtfs.zip', '/assets/sql-wasm.wasm');
const routes = await gtfs.getRoutes();
```

## Node.js usage

### In-memory via sql.js (simplest)

```typescript
import { GtfsSqlJs } from 'gtfs-sqljs';
import { createSqlJsAdapter } from 'gtfs-sqljs/adapters/sql-js';

const gtfs = await GtfsSqlJs.fromZip('https://example.com/gtfs.zip', {
  adapter: await createSqlJsAdapter(),
});
```

### File-backed via better-sqlite3 (recommended for large feeds / CLI tools)

```typescript
import { GtfsSqlJs } from 'gtfs-sqljs';
import { createBetterSqlite3Adapter } from 'gtfs-sqljs/adapters/better-sqlite3';

const gtfs = await GtfsSqlJs.fromZip('https://example.com/gtfs.zip', {
  adapter: createBetterSqlite3Adapter({ filename: './gtfs.db' }),
});
```

### Attach an already-open handle

If you opened the handle yourself (common with file-backed drivers), `attach()` skips the factory:

```typescript
import BetterSqlite3 from 'better-sqlite3';
import { GtfsSqlJs } from 'gtfs-sqljs';
import { wrapBetterSqlite3 } from 'gtfs-sqljs/adapters/better-sqlite3';

const raw = new BetterSqlite3('./gtfs.db', { readonly: true });
const gtfs = await GtfsSqlJs.attach(wrapBetterSqlite3(raw), {
  skipSchema: true,          // file already has the GTFS schema
  // ownsDatabase: true,     // let gtfs.close() close the raw handle
});
```

`attach()` takes a `GtfsDatabase`, not an adapter. By default it does **not** close the raw handle on `gtfs.close()`.

## Creating an instance

```typescript
// From a GTFS ZIP URL
const gtfs = await GtfsSqlJs.fromZip('https://example.com/gtfs.zip', { adapter });

// From pre-loaded ZIP data (ArrayBuffer or Uint8Array)
const zipData = await fetch('https://example.com/gtfs.zip').then(r => r.arrayBuffer());
const gtfs = await GtfsSqlJs.fromZipData(zipData, { adapter });

// From an existing exported SQLite database (ArrayBuffer)
const gtfs = await GtfsSqlJs.fromDatabase(dbBuffer, { adapter });
```

Omitting `adapter` throws a runtime `Error` pointing at `createSqlJsAdapter` — handy when migrating a codebase.

### Options

```typescript
{
  adapter: GtfsDatabaseAdapter;                   // REQUIRED for fromZip/fromZipData/fromDatabase
  skipFiles?: string[];                           // GTFS files to skip, e.g. ['shapes.txt']
  realtimeFeedUrls?: string[];                    // GTFS-RT protobuf feed URLs
  stalenessThreshold?: number;                    // RT staleness threshold in seconds (default: 120)
  onProgress?: (progress: ProgressInfo) => void;  // Progress callback (0-100%)
  cache?: CacheStore | null;                      // Cache store implementation
  cacheVersion?: string;                          // Version string for cache invalidation
  cacheExpirationMs?: number;                     // Cache TTL (default: 7 days)
}
```

The pre-v0.6 options `SQL` and `locateFile` are **gone** — pass them to `createSqlJsAdapter({ SQL, locateFile })` instead.

## Querying GTFS static data

All query methods are `async` and return `Promise<T>`. Filters use AND logic. Most accept single values or arrays.

```typescript
// Agencies
const agencies = await gtfs.getAgencies();
const agency = await gtfs.getAgencies({ agencyId: 'AGENCY_1' });

// Stops
const stops = await gtfs.getStops();
const stops = await gtfs.getStops({ name: 'Central Station' }); // partial match
const stops = await gtfs.getStops({ stopId: 'STOP_1' });
const stops = await gtfs.getStops({ stopCode: 'ABC' });
const stops = await gtfs.getStops({ tripId: 'TRIP_1' });

// Routes
const routes = await gtfs.getRoutes();
const routes = await gtfs.getRoutes({ routeId: 'ROUTE_1' });
const routes = await gtfs.getRoutes({ agencyId: 'AGENCY_1' });

// Trips
const trips = await gtfs.getTrips({ routeId: 'ROUTE_1', date: '20240115', directionId: 0 });
const trips = await gtfs.getTrips({ tripId: 'TRIP_1' });

// Stop times (ordered by stop_sequence)
const stopTimes = await gtfs.getStopTimes({ tripId: 'TRIP_1' });
const stopTimes = await gtfs.getStopTimes({
  stopId: 'STOP_1', routeId: 'ROUTE_1', date: '20240115',
});

// Shapes
const shapes = await gtfs.getShapes({ shapeId: 'SHAPE_1' });
const shapes = await gtfs.getShapes({ routeId: 'ROUTE_1' });

// Shapes as GeoJSON FeatureCollection (for Leaflet, Mapbox, etc.)
const geojson = await gtfs.getShapesToGeojson({ routeId: 'ROUTE_1' });

// Calendar
const serviceIds = await gtfs.getActiveServiceIds('20240115'); // YYYYMMDD
const calendar = await gtfs.getCalendarByServiceId('WEEKDAY');
const exceptions = await gtfs.getCalendarDates('WEEKDAY');
const exceptionsForDate = await gtfs.getCalendarDatesForDate('20240115');

// Build ordered stop list across multiple trip variants (express/local, etc.)
const orderedStops = await gtfs.buildOrderedStopList(['TRIP_1', 'TRIP_2', 'TRIP_3']);

// Build a directed stop-to-stop graph from a set of trips (v0.7.0+).
// Edges connect consecutive stops in stop_sequence order (gaps allowed —
// uses LEAD()). Each deduplicated edge carries the list of trips that
// traverse it, with route_id and direction_id attached.
const graph = await gtfs.buildGraph(['TRIP_1', 'TRIP_2']);
// graph: Map<fromStopId, Map<toStopId, { trips: EdgeTrip[] }>>
const edge = graph.get('STOP_A')?.get('STOP_B');
edge?.trips.forEach(t => console.log(t.tripId, t.routeId, t.directionId));

import { edgeCount, edges } from 'gtfs-sqljs';
edgeCount(graph);                 // total directed edges
for (const { from, to, data } of edges(graph)) { /* ... */ }
```

All query methods support a `limit` filter parameter.

**Plain JavaScript gotcha:** TypeScript flags missing `await`s; plain JS does not. A missing `await` returns a `Promise` that looks truthy — the bug surfaces later as “undefined is not iterable.” Grep for `gtfs.get` to audit call sites.

## GTFS Realtime

```typescript
// Configure RT feeds at creation
const gtfs = await GtfsSqlJs.fromZip('https://example.com/gtfs.zip', {
  adapter,
  realtimeFeedUrls: [
    'https://example.com/gtfs-rt/alerts',
    'https://example.com/gtfs-rt/trip-updates',
    'https://example.com/gtfs-rt/vehicle-positions',
  ],
});

// Or fetch later
await gtfs.fetchRealtimeData();
await gtfs.fetchRealtimeData(['https://example.com/feed.pb']);

// Or load from pre-fetched buffers
await gtfs.loadRealtimeDataFromBuffers([uint8ArrayBuffer]);

// Query realtime data
const alerts = await gtfs.getAlerts({ routeId: 'ROUTE_1', activeOnly: true });
const vehicles = await gtfs.getVehiclePositions({ routeId: 'ROUTE_1' });
const tripUpdates = await gtfs.getTripUpdates({ tripId: 'TRIP_1' });
const stopTimeUpdates = await gtfs.getStopTimeUpdates({ tripId: 'TRIP_1' });

// Merge realtime with static data
const trips = await gtfs.getTrips({
  routeId: 'ROUTE_1', date: '20240115', includeRealtime: true,
});
// trips[0].realtime?.vehicle_position, trips[0].realtime?.trip_update

const stopTimes = await gtfs.getStopTimes({ tripId: 'TRIP_1', includeRealtime: true });
// stopTimes[0].realtime?.arrival_delay, stopTimes[0].realtime?.departure_delay

// Manage RT feeds
gtfs.setRealtimeFeedUrls(['https://example.com/new-feed']);
gtfs.setStalenessThreshold(60);
await gtfs.clearRealtimeData();
```

## Database operations

```typescript
// Export database to ArrayBuffer (includes RT data).
// Throws ExportNotSupportedError on file-backed adapters that cannot serialize.
try {
  const buffer = await gtfs.export();
} catch (err) {
  if (err instanceof ExportNotSupportedError) {
    // File-backed (e.g. better-sqlite3): the DB file on disk already IS the export.
  } else {
    throw err;
  }
}

// Raw DB access via the GtfsDatabase surface (adapter-agnostic, fully async).
const db = gtfs.getDatabase();
const stmt = await db.prepare('SELECT * FROM stops WHERE stop_lat > ? AND stop_lon < ?');
await stmt.bind([40.7, -74.0]);
while (await stmt.step()) {
  console.log(await stmt.getAsObject());
}
await stmt.free();

// Always close when done
await gtfs.close();
```

`getDatabase()` returns a `GtfsDatabase`, **not** a raw sql.js `Database`. If you need sql.js-specific features, keep a reference to the underlying handle at the point where you created the adapter.

## Database tables

Static: `agency`, `stops`, `routes`, `trips`, `stop_times`, `calendar`, `calendar_dates`, `fare_attributes`, `fare_rules`, `shapes`, `frequencies`, `transfers`, `pathways`, `levels`, `feed_info`, `attributions`.

Realtime (created when RT data is loaded): `alerts`, `vehicle_positions`, `trip_updates`, `stop_time_updates`.

## Key TypeScript types

```typescript
import {
  GtfsSqlJs,
  type GtfsSqlJsOptions,
  // Adapter surface (new in v0.6)
  type GtfsDatabase, type GtfsStatement, type GtfsDatabaseAdapter,
  type SqlValue, type Row,
  ExportNotSupportedError,
  // Static GTFS
  type Agency, type Stop, type Route, type Trip, type StopTime, type Shape,
  type Calendar, type CalendarDate,
  // Filters
  type StopFilters, type RouteFilters, type TripFilters,
  type StopTimeFilters, type ShapeFilters,
  // Graph (v0.7.0+)
  type Graph, type EdgeTrip, type EdgeData,
  edgeCount, edges,
  // Realtime
  type Alert, type VehiclePosition, type TripUpdate, type StopTimeUpdate,
  type AlertFilters, type VehiclePositionFilters, type TripUpdateFilters,
  // Merged types
  type TripWithRealtime, type StopTimeWithRealtime,
  // Enums
  ScheduleRelationship, VehicleStopStatus, AlertCause, AlertEffect,
  PickupDropOffType,
  // GeoJSON
  type GeoJsonFeatureCollection,
  // Progress
  type ProgressInfo,
  // Caching
  type CacheStore, type CacheMetadata,
} from 'gtfs-sqljs';
```

## Caching

Optional caching stores processed databases for fast subsequent loads (<1 second vs 5-10 seconds).

Reference implementations in `examples/cache/`:

- `IndexedDBCacheStore` — browser (copy to your project)
- `FileSystemCacheStore` — Node.js (copy to your project)

```typescript
import { GtfsSqlJs } from 'gtfs-sqljs';
import { createSqlJsAdapter } from 'gtfs-sqljs/adapters/sql-js';
import { IndexedDBCacheStore } from './IndexedDBCacheStore';

const cache = new IndexedDBCacheStore();
const gtfs = await GtfsSqlJs.fromZip('https://example.com/gtfs.zip', {
  adapter: await createSqlJsAdapter(),
  cache,
});
```

If the active adapter cannot serialize in-memory (`ExportNotSupportedError`, typical of file-backed drivers), the cache layer logs a warning and skips the cache write — the DB file on disk is itself the persistent copy. Implement the `CacheStore` interface for custom backends (Redis, S3, etc.).

## Important notes

- All query methods, `export()`, and `close()` are `async` — remember `await`. TypeScript catches missing awaits; JavaScript does not.
- Dates use YYYYMMDD string format (e.g., `'20240115'`).
- ESM-only — use `import`, not `require`. Requires Node.js 18+.
- Always `await gtfs.close()` when done.
- `fromZip()` accepts URLs only (not local file paths) — use `fromZipData()` for pre-loaded data.
- `skipFiles` skips files during ZIP extraction to reduce memory (e.g., `['shapes.txt']`).
- Browser + sql.js: the `sql-wasm.wasm` file must be copied from `node_modules/sql.js/dist/` and served as a static asset, or loaded from a CDN via `locateFile` passed to `createSqlJsAdapter`.
- `ProgressInfo.totalRows` is an estimate from CSV line count (typically exact; may differ by a few rows with trailing blank lines). For exact counts, run `SELECT COUNT(*)` against the DB.
