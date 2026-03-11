---
name: gtfs-sqljs
description: Reference for building apps with gtfs-sqljs — a TypeScript library for loading GTFS transit data into sql.js SQLite databases (browser + Node.js). Covers installation, Web Worker + Comlink usage, query methods, GTFS-RT feeds, and caching.
  TRIGGER when: code imports `gtfs-sqljs`, or user asks to use gtfs-sqljs, or user works on a project that depends on gtfs-sqljs, or user needs to manipulate/query/load a GTFS file.
  DO NOT TRIGGER when: general programming, unrelated libraries.
user-invocable: false
---

# gtfs-sqljs

TypeScript library for loading GTFS (General Transit Feed Specification) transit data into an in-memory sql.js SQLite database. Works in both browser and Node.js (18+). ESM-only.

## Installation

```bash
npm install gtfs-sqljs sql.js
```

`sql.js` is a required peer dependency.

## WASM File Requirement (Browser)

sql.js uses a WebAssembly file (`sql-wasm.wasm`) that must be available at runtime. In Node.js this is handled automatically. In the browser, you must serve the WASM file and tell sql.js where to find it.

### Vite

```typescript
import initSqlJs from 'sql.js';
import { GtfsSqlJs } from 'gtfs-sqljs';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

const SQL = await initSqlJs({ locateFile: () => sqlWasmUrl });
const gtfs = await GtfsSqlJs.fromZip('https://example.com/gtfs.zip', { SQL });
```

### Webpack

Copy `node_modules/sql.js/dist/sql-wasm.wasm` to your public/static assets directory, then:

```typescript
import initSqlJs from 'sql.js';
import { GtfsSqlJs } from 'gtfs-sqljs';

const SQL = await initSqlJs({
  locateFile: (filename) => `/assets/${filename}`
});
const gtfs = await GtfsSqlJs.fromZip('https://example.com/gtfs.zip', { SQL });
```

### CDN

```typescript
import initSqlJs from 'sql.js';
import { GtfsSqlJs } from 'gtfs-sqljs';

const SQL = await initSqlJs({
  locateFile: (filename) => `https://sql.js.org/dist/${filename}`
});
const gtfs = await GtfsSqlJs.fromZip('https://example.com/gtfs.zip', { SQL });
```

### Without bundler (script tag)

Copy `sql-wasm.wasm` from `node_modules/sql.js/dist/` to the same directory as your page or a known path, then use `locateFile` to point to it.

## Web Worker Recommendation (Browser)

In the browser, gtfs-sqljs should run inside a Web Worker to avoid blocking the main thread during GTFS loading and querying. Use a library like `comlink` to expose the worker API seamlessly.

```bash
npm install comlink
```

```typescript
// gtfs-worker.ts — runs in a Web Worker
import * as Comlink from 'comlink';
import initSqlJs from 'sql.js';
import { GtfsSqlJs } from 'gtfs-sqljs';

let gtfs: GtfsSqlJs;

const api = {
  async load(zipUrl: string, wasmUrl: string) {
    const SQL = await initSqlJs({ locateFile: () => wasmUrl });
    gtfs = await GtfsSqlJs.fromZip(zipUrl, { SQL });
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
  close() {
    gtfs.close();
  }
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

## Node.js Usage

No WASM setup needed — sql.js locates the WASM file automatically.

```typescript
import { GtfsSqlJs } from 'gtfs-sqljs';

const gtfs = await GtfsSqlJs.fromZip('https://example.com/gtfs.zip');
```

## Creating an Instance

```typescript
// From a GTFS ZIP URL
const gtfs = await GtfsSqlJs.fromZip('https://example.com/gtfs.zip');

// From pre-loaded ZIP data (ArrayBuffer or Uint8Array)
const zipData = await fetch('https://example.com/gtfs.zip').then(r => r.arrayBuffer());
const gtfs = await GtfsSqlJs.fromZipData(zipData);

// From an existing exported SQLite database (ArrayBuffer)
const gtfs = await GtfsSqlJs.fromDatabase(dbBuffer);
```

### Options

```typescript
{
  SQL?: SqlJsStatic;                              // Pre-initialized sql.js instance (required for browser)
  locateFile?: (filename: string) => string;      // Alternative to passing SQL: custom WASM path
  skipFiles?: string[];                           // GTFS files to skip, e.g. ['shapes.txt']
  realtimeFeedUrls?: string[];                    // GTFS-RT protobuf feed URLs
  stalenessThreshold?: number;                    // RT staleness threshold in seconds (default: 120)
  onProgress?: (progress: ProgressInfo) => void;  // Progress callback (0-100%)
  cache?: CacheStore | null;                      // Cache store implementation
  cacheVersion?: string;                          // Version string for cache invalidation
  cacheExpirationMs?: number;                     // Cache TTL (default: 7 days)
}
```

## Querying GTFS Static Data

All query methods accept optional filter objects. Filters use AND logic. Most accept single values or arrays.

```typescript
// Agencies
const agencies = gtfs.getAgencies();
const agency = gtfs.getAgencies({ agencyId: 'AGENCY_1' });

// Stops
const stops = gtfs.getStops();
const stops = gtfs.getStops({ name: 'Central Station' });        // partial match
const stops = gtfs.getStops({ stopId: 'STOP_1' });
const stops = gtfs.getStops({ stopCode: 'ABC' });
const stops = gtfs.getStops({ tripId: 'TRIP_1' });

// Routes
const routes = gtfs.getRoutes();
const routes = gtfs.getRoutes({ routeId: 'ROUTE_1' });
const routes = gtfs.getRoutes({ agencyId: 'AGENCY_1' });

// Trips
const trips = gtfs.getTrips({ routeId: 'ROUTE_1', date: '20240115', directionId: 0 });
const trips = gtfs.getTrips({ tripId: 'TRIP_1' });
const trips = gtfs.getTrips({ agencyId: 'AGENCY_1', date: '20240115' });

// Stop times (ordered by stop_sequence)
const stopTimes = gtfs.getStopTimes({ tripId: 'TRIP_1' });
const stopTimes = gtfs.getStopTimes({ stopId: 'STOP_1', routeId: 'ROUTE_1', date: '20240115' });

// Shapes
const shapes = gtfs.getShapes({ shapeId: 'SHAPE_1' });
const shapes = gtfs.getShapes({ routeId: 'ROUTE_1' });

// Shapes as GeoJSON FeatureCollection (for Leaflet, Mapbox, etc.)
const geojson = gtfs.getShapesToGeojson({ routeId: 'ROUTE_1' });

// Calendar
const serviceIds = gtfs.getActiveServiceIds('20240115');  // YYYYMMDD format
const calendars = gtfs.getCalendars({ serviceId: 'WEEKDAY' });
const exceptions = gtfs.getCalendarDates('WEEKDAY');

// Build ordered stop list from multiple trips (for timetables with express/local variants)
const orderedStops = gtfs.buildOrderedStopList(['TRIP_1', 'TRIP_2', 'TRIP_3']);
```

All query methods support a `limit` filter parameter.

## GTFS Realtime

```typescript
// Configure RT feeds at creation
const gtfs = await GtfsSqlJs.fromZip('https://example.com/gtfs.zip', {
  realtimeFeedUrls: [
    'https://example.com/gtfs-rt/alerts',
    'https://example.com/gtfs-rt/trip-updates',
    'https://example.com/gtfs-rt/vehicle-positions'
  ]
});

// Or fetch later
await gtfs.fetchRealtimeData();
await gtfs.fetchRealtimeData(['https://example.com/feed.pb']);

// Or load from pre-fetched buffers
await gtfs.loadRealtimeDataFromBuffers([uint8ArrayBuffer]);

// Query realtime data
const alerts = gtfs.getAlerts({ routeId: 'ROUTE_1', activeOnly: true });
const vehicles = gtfs.getVehiclePositions({ routeId: 'ROUTE_1' });
const tripUpdates = gtfs.getTripUpdates({ tripId: 'TRIP_1' });
const stopTimeUpdates = gtfs.getStopTimeUpdates({ tripId: 'TRIP_1' });

// Merge realtime with static data
const trips = gtfs.getTrips({ routeId: 'ROUTE_1', date: '20240115', includeRealtime: true });
// trips[0].realtime?.vehicle_position, trips[0].realtime?.trip_update

const stopTimes = gtfs.getStopTimes({ tripId: 'TRIP_1', includeRealtime: true });
// stopTimes[0].realtime?.arrival_delay, stopTimes[0].realtime?.departure_delay

// Manage RT feeds
gtfs.setRealtimeFeedUrls(['https://example.com/new-feed']);
gtfs.setStalenessThreshold(60);
gtfs.clearRealtimeData();
```

## Database Operations

```typescript
// Export database to ArrayBuffer (includes RT data)
const buffer = gtfs.export();

// Direct sql.js database access for custom SQL queries
const db = gtfs.getDatabase();
const stmt = db.prepare('SELECT * FROM stops WHERE stop_lat > ? AND stop_lon < ?');
stmt.bind([40.7, -74.0]);
while (stmt.step()) {
  console.log(stmt.getAsObject());
}
stmt.free();

// Always close when done
gtfs.close();
```

## Database Tables

Static: agency, stops, routes, trips, stop_times, calendar, calendar_dates, fare_attributes, fare_rules, shapes, frequencies, transfers, pathways, levels, feed_info, attributions

Realtime (created when RT data is loaded): alerts, vehicle_positions, trip_updates, stop_time_updates

## Key TypeScript Types

```typescript
import {
  GtfsSqlJs,
  type GtfsSqlJsOptions,
  // Static GTFS
  type Agency, type Stop, type Route, type Trip, type StopTime, type Shape,
  type Calendar, type CalendarDate,
  // Filters
  type StopFilters, type RouteFilters, type TripFilters, type StopTimeFilters, type ShapeFilters,
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
import { IndexedDBCacheStore } from './IndexedDBCacheStore';

const cache = new IndexedDBCacheStore();
const gtfs = await GtfsSqlJs.fromZip('https://example.com/gtfs.zip', { cache });
```

Implement the `CacheStore` interface for custom backends (Redis, S3, etc.).

## Important Notes

- Dates use YYYYMMDD string format (e.g., '20240115')
- ESM-only — use `import`, not `require`
- Requires Node.js 18+
- Always call `gtfs.close()` when done to free memory
- `fromZip()` accepts URLs only (not local file paths) — use `fromZipData()` for pre-loaded data
- The `skipFiles` option skips files during ZIP extraction to reduce memory (e.g., `['shapes.txt']`)
- For browser usage: the sql.js WASM file (`sql-wasm.wasm`) MUST be copied from `node_modules/sql.js/dist/` and served as a static asset, or loaded from a CDN
