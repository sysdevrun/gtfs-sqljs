---
title: Usage Guide
---

# Usage Guide

This guide covers all usage patterns for **gtfs-sqljs**, from basic setup to advanced features like GTFS Realtime and smart caching.

> **Breaking change in v0.6.** The library no longer hard-depends on sql.js. Pass an adapter explicitly via `options.adapter`, or hand a pre-opened handle to `GtfsSqlJs.attach()`. All query methods now return `Promise<T>` — use `await`.

## Adapters overview

gtfs-sqljs talks to a small async database interface (`GtfsDatabase`). Two adapters ship in the box:

| Subpath | Driver | When to use |
|---|---|---|
| `gtfs-sqljs/adapters/sql-js` | [sql.js](https://sql.js.org/) (WASM) | Browser; Node without native deps; always in-memory. |
| `gtfs-sqljs/adapters/better-sqlite3` | [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) (native) | Node; file-backed persistence; fastest native performance. |

Two entry points cover every scenario:

- **Factory path** — `fromZip` / `fromZipData` / `fromDatabase` take `options.adapter`. The library creates or opens the DB internally. Best for in-memory drivers.
- **Pre-opened handle** — `GtfsSqlJs.attach(db, options?)` takes a live `GtfsDatabase` you built yourself. Best for file-backed drivers where you want to control the file path, journal mode, readonly flag, etc.

## Loading the sql.js WASM File

sql.js requires a WASM file. You configure it via `createSqlJsAdapter({ locateFile })`.

### Node.js

sql.js locates its WASM automatically in Node.js. No extra setup needed:

```typescript
import { GtfsSqlJs } from 'gtfs-sqljs';
import { createSqlJsAdapter } from 'gtfs-sqljs/adapters/sql-js';

const gtfs = await GtfsSqlJs.fromZip('https://example.com/gtfs.zip', {
  adapter: await createSqlJsAdapter(),
});
```

### Browser with CDN

```typescript
import { GtfsSqlJs } from 'gtfs-sqljs';
import { createSqlJsAdapter } from 'gtfs-sqljs/adapters/sql-js';

const gtfs = await GtfsSqlJs.fromZip('https://example.com/gtfs.zip', {
  adapter: await createSqlJsAdapter({
    locateFile: (filename) => `https://sql.js.org/dist/${filename}`,
  }),
});
```

### Browser with Bundler (Vite / Webpack / …)

#### Vite

```typescript
import { GtfsSqlJs } from 'gtfs-sqljs';
import { createSqlJsAdapter } from 'gtfs-sqljs/adapters/sql-js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

const gtfs = await GtfsSqlJs.fromZip('https://example.com/gtfs.zip', {
  adapter: await createSqlJsAdapter({ locateFile: () => sqlWasmUrl }),
});
```

#### Webpack

```typescript
import { GtfsSqlJs } from 'gtfs-sqljs';
import { createSqlJsAdapter } from 'gtfs-sqljs/adapters/sql-js';

const gtfs = await GtfsSqlJs.fromZip('https://example.com/gtfs.zip', {
  adapter: await createSqlJsAdapter({
    locateFile: (filename) => `/path/to/public/${filename}`,
  }),
});
```

Copy `sql-wasm.wasm` from `node_modules/sql.js/dist/` to your public directory.

### Reusing an existing `SqlJsStatic`

If you already called `initSqlJs()` elsewhere, pass the instance in to skip re-initialization:

```typescript
import initSqlJs from 'sql.js';
import { createSqlJsAdapter } from 'gtfs-sqljs/adapters/sql-js';

const SQL = await initSqlJs({ locateFile: (f) => `/sqljs/${f}` });
const adapter = await createSqlJsAdapter({ SQL });
```

## Creating an Instance

This section covers the four typical starting points: ZIP on disk or as bytes, an existing `.db` as bytes, and a pre-opened native handle.

### sql.js — from a GTFS ZIP URL

```typescript
import { GtfsSqlJs } from 'gtfs-sqljs';
import { createSqlJsAdapter } from 'gtfs-sqljs/adapters/sql-js';

const gtfs = await GtfsSqlJs.fromZip('https://example.com/gtfs.zip', {
  adapter: await createSqlJsAdapter(),
});

// Skip importing specific files to reduce memory usage.
// Tables are still created; just no data is inserted for them.
const lean = await GtfsSqlJs.fromZip('https://example.com/gtfs.zip', {
  adapter: await createSqlJsAdapter(),
  skipFiles: ['shapes.txt', 'frequencies.txt'],
});
```

### sql.js — from GTFS ZIP bytes (no fetch or no file path)

If you already have the ZIP in memory (uploaded from a `<input type="file">`, pre-fetched, bundled as an asset…):

```typescript
import { GtfsSqlJs } from 'gtfs-sqljs';
import { createSqlJsAdapter } from 'gtfs-sqljs/adapters/sql-js';

const zipBytes: ArrayBuffer = /* from fetch / FileReader / fs.readFile / … */;

const gtfs = await GtfsSqlJs.fromZipData(zipBytes, {
  adapter: await createSqlJsAdapter(),
});

const routes = await gtfs.getRoutes();
```

### sql.js — from an existing SQLite database

Use this when you have a pre-built `.db` (e.g. an earlier `gtfs.export()` saved to disk or shipped as a static asset):

```typescript
import { GtfsSqlJs } from 'gtfs-sqljs';
import { createSqlJsAdapter } from 'gtfs-sqljs/adapters/sql-js';

// Browser
const dbBytes = await fetch('https://example.com/gtfs.db').then(r => r.arrayBuffer());

// Node
// const dbBytes = (await fs.readFile('./gtfs.db')).buffer;

const gtfs = await GtfsSqlJs.fromDatabase(dbBytes, {
  adapter: await createSqlJsAdapter(),
});
```

### better-sqlite3 — attach to a pre-opened file

The idiomatic better-sqlite3 pattern: **you** create the connection (path, readonly, pragmas…) and hand the wrapped handle to `attach()`.

```typescript
import BetterSqlite3 from 'better-sqlite3';
import { GtfsSqlJs } from 'gtfs-sqljs';
import { wrapBetterSqlite3 } from 'gtfs-sqljs/adapters/better-sqlite3';

// Read-only attach to an existing GTFS DB on disk.
const raw = new BetterSqlite3('./gtfs.db', { readonly: true });
const gtfs = await GtfsSqlJs.attach(wrapBetterSqlite3(raw), {
  skipSchema: true, // the file already has the GTFS schema
});

const routes = await gtfs.getRoutes();

// attach() does not own the handle by default — you close both.
await gtfs.close();
raw.close();
```

If the file is **empty** or you want the library to create the schema, omit `skipSchema`:

```typescript
const raw = new BetterSqlite3('./gtfs.db');
const gtfs = await GtfsSqlJs.attach(wrapBetterSqlite3(raw));
// CREATE TABLE IF NOT EXISTS … runs automatically.
```

Pass `ownsDatabase: true` if you want `gtfs.close()` to also close the raw handle:

```typescript
const gtfs = await GtfsSqlJs.attach(wrapBetterSqlite3(raw), { ownsDatabase: true });
// Later: await gtfs.close();  // raw is closed too
```

### better-sqlite3 — factory path (in-memory)

Use the factory when you want the library to manage an in-memory better-sqlite3 DB — typical for ingesting a GTFS ZIP you have in memory without writing anything to disk:

```typescript
import { GtfsSqlJs } from 'gtfs-sqljs';
import { createBetterSqlite3Adapter } from 'gtfs-sqljs/adapters/better-sqlite3';

const zipBytes: ArrayBuffer = /* … */;

const gtfs = await GtfsSqlJs.fromZipData(zipBytes, {
  adapter: createBetterSqlite3Adapter(), // defaults to ':memory:'
});

const trips = await gtfs.getTrips({ routeId: 'AB' });
```

Pass a path to create / open a file-backed DB via the factory:

```typescript
const gtfs = await GtfsSqlJs.fromZipData(zipBytes, {
  adapter: createBetterSqlite3Adapter('./gtfs.db'),
});
```

### Decision table

| You have… | sql.js | better-sqlite3 |
|---|---|---|
| A GTFS **ZIP URL** | `fromZip(url, { adapter: await createSqlJsAdapter(...) })` | `fromZip(url, { adapter: createBetterSqlite3Adapter(path?) })` |
| GTFS **ZIP bytes** | `fromZipData(zip, { adapter: await createSqlJsAdapter(...) })` | `fromZipData(zip, { adapter: createBetterSqlite3Adapter(path?) })` |
| An **existing `.db` as bytes** | `fromDatabase(bytes, { adapter: await createSqlJsAdapter(...) })` | Write the bytes to a file first, then `attach()` — better-sqlite3 opens paths, not buffers, for file-backed use |
| A **pre-opened handle** you control | *(uncommon for sql.js)* | `attach(wrapBetterSqlite3(raw), { skipSchema? })` |

### Bringing your own adapter (op-sqlite / expo-sqlite / …)

Implement the `GtfsDatabase` / `GtfsDatabaseAdapter` interfaces from `gtfs-sqljs`. The full contract is small — `prepare`, `run`, `export`, `close` on the DB, and `bind`, `step`, `getAsObject`, `run`, `free` on statements. File-backed drivers that cannot serialize should throw `ExportNotSupportedError` from `export()`; the cache layer catches it and no-ops.

```typescript
import type { GtfsDatabase, GtfsDatabaseAdapter, GtfsStatement, Row, SqlValue } from 'gtfs-sqljs';
import { ExportNotSupportedError } from 'gtfs-sqljs';

function wrapMyDriver(raw: MyDriverDb): GtfsDatabase {
  return {
    prepare: async (sql) => /* … wrap into GtfsStatement … */,
    run: async (sql) => { raw.exec(sql); },
    export: async () => { throw new ExportNotSupportedError(); },
    close: async () => { raw.close(); },
  };
}
```

See `src/adapters/better-sqlite3/index.ts` in the repository for a complete reference implementation (~130 lines).

## Progress Tracking

Track loading progress with a callback function - perfect for displaying progress bars or updating UI:

```typescript
import { GtfsSqlJs, type ProgressInfo } from 'gtfs-sqljs';

const gtfs = await GtfsSqlJs.fromZip('https://example.com/gtfs.zip', {
  onProgress: (progress: ProgressInfo) => {
    console.log(`${progress.percentComplete}% - ${progress.message}`);

    // Progress information available:
    console.log('Phase:', progress.phase);              // Current phase
    console.log('File:', progress.currentFile);         // Current file being processed
    console.log('Files:', progress.filesCompleted, '/', progress.totalFiles);
    console.log('Rows:', progress.rowsProcessed, '/', progress.totalRows);
  }
});
```

### Progress Phases

The loading process goes through these phases:

1. **`checking_cache`** - Checking if cached database exists (0%)
2. **`loading_from_cache`** - Loading from cache (if found, jumps to 100%)
3. **`downloading`** - Downloading GTFS ZIP file (1-30%)
4. **`extracting`** - Extracting GTFS ZIP file (35%)
5. **`creating_schema`** - Creating database tables (40%)
6. **`inserting_data`** - Importing data from CSV files (40-75%)
7. **`creating_indexes`** - Building database indexes (75-85%)
8. **`analyzing`** - Optimizing query performance (85-90%)
9. **`loading_realtime`** - Loading realtime data from feeds (90-95%) *(if configured)*
10. **`saving_cache`** - Saving to cache (95-98%)
11. **`complete`** - Load complete (100%)

**Note:** When a cached database is found, phases 3-10 are skipped, and loading completes in <1 second.

**Note:** The `loading_realtime` phase only occurs if `realtimeFeedUrls` are configured during initialization.

### Web Worker Example

The progress callback is especially useful for web workers:

```typescript
// In your web worker
import { GtfsSqlJs } from 'gtfs-sqljs';

self.onmessage = async (event) => {
  if (event.data.type === 'load') {
    const gtfs = await GtfsSqlJs.fromZip(event.data.url, {
      onProgress: (progress) => {
        // Send progress updates to main thread
        self.postMessage({
          type: 'progress',
          data: progress
        });
      }
    });

    self.postMessage({ type: 'complete' });
  }
};
```

```typescript
// In your main thread
const worker = new Worker('gtfs-worker.js');

worker.onmessage = (event) => {
  if (event.data.type === 'progress') {
    const progress = event.data.data;
    updateProgressBar(progress.percentComplete);
    updateStatusText(progress.message);
  }
};

worker.postMessage({ type: 'load', url: 'https://example.com/gtfs.zip' });
```

### ProgressInfo Type

```typescript
interface ProgressInfo {
  phase: 'checking_cache' | 'loading_from_cache' | 'downloading' | 'extracting' |
         'creating_schema' | 'inserting_data' | 'creating_indexes' | 'analyzing' |
         'loading_realtime' | 'saving_cache' | 'complete';
  currentFile: string | null;        // e.g., "stop_times.txt"
  filesCompleted: number;            // Files processed so far
  totalFiles: number;                // Total number of files
  rowsProcessed: number;             // CSV rows imported so far
  totalRows: number;                 // Total CSV rows to import
  bytesDownloaded?: number;          // Bytes downloaded (during 'downloading' phase)
  totalBytes?: number;               // Total bytes to download (during 'downloading' phase)
  percentComplete: number;           // 0-100
  message: string;                   // Human-readable status message
}
```

## Querying Data

The library provides flexible filter-based methods for querying GTFS data. Pass an object with optional filters to combine multiple criteria:

```typescript
// Get stops - combine any filters
const stops = await gtfs.getStops({
  name: 'Station',        // Search by name
  limit: 10               // Limit results
});

// Get routes - with or without filters
const allRoutes = await gtfs.getRoutes();
const agencyRoutes = await gtfs.getRoutes({ agencyId: 'AGENCY_1' });

// Get trips - combine multiple filters
const trips = await gtfs.getTrips({
  routeId: 'ROUTE_1',     // Filter by route
  date: '20240115',       // Filter by date (gets active services)
  directionId: 0,         // Filter by direction
  limit: 50               // Limit results
});

// Get stop times - flexible filtering
const stopTimes = await gtfs.getStopTimes({
  stopId: 'STOP_123',     // At a specific stop
  routeId: 'ROUTE_1',     // For a specific route
  date: '20240115',       // On a specific date
  directionId: 0          // In a specific direction
});
```

### Available Filter Options

- {@link GtfsSqlJs.getStops | getStops(filters?)}:
  - `stopId`: string - Filter by stop ID
  - `stopCode`: string - Filter by stop code
  - `name`: string - Search by stop name (partial match)
  - `tripId`: string - Get stops for a trip
  - `limit`: number - Limit results

- {@link GtfsSqlJs.getRoutes | getRoutes(filters?)}:
  - `routeId`: string - Filter by route ID
  - `agencyId`: string - Filter by agency
  - `limit`: number - Limit results

- {@link GtfsSqlJs.getTrips | getTrips(filters?)}:
  - `tripId`: string - Filter by trip ID
  - `routeId`: string - Filter by route
  - `date`: string - Filter by date (YYYYMMDD format)
  - `directionId`: number - Filter by direction
  - `limit`: number - Limit results

- {@link GtfsSqlJs.getStopTimes | getStopTimes(filters?)}:
  - `tripId`: string - Filter by trip
  - `stopId`: string - Filter by stop
  - `routeId`: string - Filter by route
  - `date`: string - Filter by date (YYYYMMDD format)
  - `directionId`: number - Filter by direction
  - `limit`: number - Limit results

- {@link GtfsSqlJs.getShapes | getShapes(filters?)}:
  - `shapeId`: string | string[] - Filter by shape ID
  - `routeId`: string | string[] - Filter by route (via trips table)
  - `tripId`: string | string[] - Filter by trip
  - `limit`: number - Limit results

- {@link GtfsSqlJs.getShapesToGeojson | getShapesToGeojson(filters?, precision?)}:
  - Same filters as `getShapes`
  - `precision`: number - Decimal places for coordinates (default: 6)

### Get Stop Information

```typescript
// Get stop by ID
const stops = await gtfs.getStops({ stopId: 'STOP_123' });
const stop = stops.length > 0 ? stops[0] : null;
console.log(stop?.stop_name);

// Get stop by code (using filters)
const stops = await gtfs.getStops({ stopCode: 'ABC' });
const stop = stops[0];

// Search stops by name (using filters)
const stops = await gtfs.getStops({ name: 'Main Street' });

// Get all stops (using filters with no parameters)
const allStops = await gtfs.getStops();

// Get stops with limit
const stops = await gtfs.getStops({ limit: 10 });

// Get stops for a specific trip
const stops = await gtfs.getStops({ tripId: 'TRIP_123' });
```

### Get Route Information

```typescript
// Get route by ID
const routes = await gtfs.getRoutes({ routeId: 'ROUTE_1' });
const route = routes.length > 0 ? routes[0] : null;

// Get all routes (using filters with no parameters)
const routes = await gtfs.getRoutes();

// Get routes by agency (using filters)
const agencyRoutes = await gtfs.getRoutes({ agencyId: 'AGENCY_1' });

// Get routes with limit
const routes = await gtfs.getRoutes({ limit: 10 });
```

### Get Agency Information

```typescript
// Get agency by ID
const agencies = await gtfs.getAgencies({ agencyId: 'AGENCY_1' });
const agency = agencies.length > 0 ? agencies[0] : null;

// Get all agencies
const allAgencies = await gtfs.getAgencies();

// Get agencies with limit
const agencies = await gtfs.getAgencies({ limit: 5 });
```

### Get Calendar Information

```typescript
// Get active services for a date (YYYYMMDD format)
const serviceIds = await gtfs.getActiveServiceIds('20240115');

// Get calendar by service ID (returns Calendar | null)
const calendar = await gtfs.getCalendarByServiceId('WEEKDAY');

// Get calendar date exceptions for a service
const exceptions = await gtfs.getCalendarDates('WEEKDAY');

// Get calendar date exceptions for a specific date
const exceptionsForDate = await gtfs.getCalendarDatesForDate('20240115');
```

### Get Trip Information

```typescript
// Get trip by ID
const trips = await gtfs.getTrips({ tripId: 'TRIP_123' });
const trip = trips.length > 0 ? trips[0] : null;

// Get trips by route (using filters)
const trips = await gtfs.getTrips({ routeId: 'ROUTE_1' });

// Get trips by route and date (using filters)
const trips = await gtfs.getTrips({ routeId: 'ROUTE_1', date: '20240115' });

// Get trips by route, date, and direction (using filters)
const trips = await gtfs.getTrips({
  routeId: 'ROUTE_1',
  date: '20240115',
  directionId: 0
});

// Get all trips for a date
const trips = await gtfs.getTrips({ date: '20240115' });

// Get trips by agency
const trips = await gtfs.getTrips({ agencyId: 'AGENCY_1' });
```

### Get Stop Time Information

```typescript
// Get stop times for a trip (ordered by stop_sequence)
const stopTimes = await gtfs.getStopTimes({ tripId: 'TRIP_123' });

// Get stop times for a stop (using filters)
const stopTimes = await gtfs.getStopTimes({ stopId: 'STOP_123' });

// Get stop times for a stop and route (using filters)
const stopTimes = await gtfs.getStopTimes({
  stopId: 'STOP_123',
  routeId: 'ROUTE_1'
});

// Get stop times for a stop, route, and date (using filters)
const stopTimes = await gtfs.getStopTimes({
  stopId: 'STOP_123',
  routeId: 'ROUTE_1',
  date: '20240115'
});

// Get stop times with direction filter (using filters)
const stopTimes = await gtfs.getStopTimes({
  stopId: 'STOP_123',
  routeId: 'ROUTE_1',
  date: '20240115',
  directionId: 0
});

// Get stop times by agency
const stopTimes = await gtfs.getStopTimes({
  agencyId: 'AGENCY_1',
  date: '20240115'
});
```

### Building Ordered Stop Lists for Multiple Trips

When displaying timetables for routes where different trips may stop at different stops (e.g., express vs local service, or trips with varying start/end points), use {@link GtfsSqlJs.buildOrderedStopList | buildOrderedStopList()} to build an optimal ordered list of all unique stops:

```typescript
// Get all trips for a route in one direction
const trips = await gtfs.getTrips({
  routeId: 'ROUTE_1',
  directionId: 0,
  date: '20240115'
});

// Build ordered list of all stops served by these trips
const tripIds = trips.map(t => t.trip_id);
const orderedStops = await gtfs.buildOrderedStopList(tripIds);

// Now display a timetable with all possible stops
console.log('Route stops:');
orderedStops.forEach(stop => {
  console.log(`- ${stop.stop_name}`);
});

// For each trip, you can now show which stops it serves
for (const trip of trips) {
  const tripStopTimes = await gtfs.getStopTimes({ tripId: trip.trip_id });
  console.log(`\nTrip ${trip.trip_headsign}:`);

  // Show all stops, marking which ones this trip serves
  orderedStops.forEach(stop => {
    const stopTime = tripStopTimes.find(st => st.stop_id === stop.stop_id);
    if (stopTime) {
      console.log(`  ${stopTime.arrival_time} - ${stop.stop_name}`);
    } else {
      console.log(`  --- (not served) - ${stop.stop_name}`);
    }
  });
}
```

**Use Cases:**
- **Express vs Local Service** - Some trips skip stops that others serve
- **Different Start/End Points** - Short-turn trips or extended service trips
- **Peak vs Off-Peak Service** - Different stop coverage based on time of day
- **Route Variations** - Multiple branches or patterns on the same route

**How it works:**
The method intelligently merges stop sequences from all provided trips:
1. Fetches stop times for all trips
2. Processes each trip's stops in sequence order
3. When encountering a new stop, finds the best insertion position by analyzing stops before and after it
4. Returns full Stop objects in the determined order

**Example - Real-world scenario:**
```typescript
// You have a bus route with:
// - Local trips: A -> B -> C -> D -> E -> F
// - Express trips: A -> C -> E -> F (skips B and D)
// - Short trips: B -> C -> D (doesn't go to end of line)

const allTrips = await gtfs.getTrips({ routeId: 'BUS_42', directionId: 0 });
const tripIds = allTrips.map(t => t.trip_id);
const stops = await gtfs.buildOrderedStopList(tripIds);

// Result: [A, B, C, D, E, F] - all stops in correct order
// Now you can create a timetable showing all stops with departure times
```

### Get Shape Information

Shapes define the path a vehicle takes along a route. Use {@link GtfsSqlJs.getShapes | getShapes()} to get raw shape point data and {@link GtfsSqlJs.getShapesToGeojson | getShapesToGeojson()} to get shapes as GeoJSON for mapping.

```typescript
// Get all shape points for a specific shape
const shapePoints = await gtfs.getShapes({ shapeId: 'SHAPE_1' });
console.log(`Shape has ${shapePoints.length} points`);

// Get shapes for a specific route
const routeShapes = await gtfs.getShapes({ routeId: 'ROUTE_1' });

// Get shapes for multiple trips
const tripShapes = await gtfs.getShapes({ tripId: ['TRIP_1', 'TRIP_2'] });

// Each shape point contains:
// - shape_id: string
// - shape_pt_lat: number
// - shape_pt_lon: number
// - shape_pt_sequence: number
// - shape_dist_traveled?: number (optional)
```

### Get Shapes as GeoJSON

Convert shapes to GeoJSON format for use with mapping libraries (Leaflet, Mapbox, etc.):

```typescript
// Get all shapes as GeoJSON FeatureCollection
const geojson = await gtfs.getShapesToGeojson();

// Get shapes for a specific route
const routeGeojson = await gtfs.getShapesToGeojson({ routeId: 'ROUTE_1' });

// Customize coordinate precision (default: 6 decimals = ~10cm)
const lowPrecision = await gtfs.getShapesToGeojson({ routeId: 'ROUTE_1' }, 4); // ~11m precision

// GeoJSON structure:
// {
//   type: 'FeatureCollection',
//   features: [{
//     type: 'Feature',
//     properties: {
//       shape_id: 'SHAPE_1',
//       route_id: 'ROUTE_1',
//       route_short_name: '1',
//       route_long_name: 'Main Street',
//       route_type: 3,
//       route_color: 'FF0000',
//       route_text_color: 'FFFFFF',
//       agency_id: 'AGENCY_1'
//     },
//     geometry: {
//       type: 'LineString',
//       coordinates: [[-122.123456, 37.123456], [-122.234567, 37.234567], ...]
//     }
//   }]
// }

// Use with Leaflet
const geoJsonLayer = L.geoJSON(geojson, {
  style: (feature) => ({
    color: `#${feature.properties.route_color || '000000'}`,
    weight: 3
  })
}).addTo(map);
```

**Precision values:**
- `6` decimals: ~10cm precision (default)
- `5` decimals: ~1m precision
- `4` decimals: ~11m precision
- `3` decimals: ~111m precision

## GTFS Realtime Support

This library supports [GTFS Realtime](https://gtfs.org/documentation/realtime/reference/) data (alerts, trip updates, and vehicle positions) with automatic merging into static schedule data.

### Loading Realtime Data

```typescript
// Configure RT feed URLs - data will be fetched automatically after GTFS load
const gtfs = await GtfsSqlJs.fromZip('https://example.com/gtfs.zip', {
  adapter: await createSqlJsAdapter(),
  realtimeFeedUrls: [
    'https://example.com/gtfs-rt/alerts',
    'https://example.com/gtfs-rt/trip-updates',
    'https://example.com/gtfs-rt/vehicle-positions'
  ],
  stalenessThreshold: 120 // seconds (default: 120)
});
// RT data is already loaded and ready to use!

// Or manually fetch RT data later (uses configured URLs or pass custom URLs)
await gtfs.fetchRealtimeData();

// Or fetch from specific URLs
await gtfs.fetchRealtimeData([
  'https://example.com/gtfs-rt/combined-feed'
]);

// Support local files in Node.js
await gtfs.fetchRealtimeData(['./path/to/feed.pb']);

// Update configuration
gtfs.setRealtimeFeedUrls(['https://example.com/new-feed']);
gtfs.setStalenessThreshold(60); // 60 seconds

// Check when realtime data was last fetched
const lastFetch = gtfs.getLastRealtimeFetchTimestamp();
if (lastFetch) {
  const ageSeconds = Math.floor(Date.now() / 1000) - lastFetch;
  console.log(`RT data is ${ageSeconds} seconds old`);
} else {
  console.log('No RT data has been fetched yet');
}
```

### Querying Alerts

```typescript
// Get all active alerts
const activeAlerts = await gtfs.getAlerts({ activeOnly: true });

// Filter alerts by route
const routeAlerts = await gtfs.getAlerts({
  routeId: 'ROUTE_1',
  activeOnly: true
});

// Filter alerts by stop
const stopAlerts = await gtfs.getAlerts({
  stopId: 'STOP_123',
  activeOnly: true
});

// Filter alerts by trip
const tripAlerts = await gtfs.getAlerts({
  tripId: 'TRIP_456'
});

// Get alert by ID
const alerts = await gtfs.getAlerts({ alertId: 'alert:12345' });
const alert = alerts.length > 0 ? alerts[0] : null;

// Alert structure
console.log(alert.header_text);      // TranslatedString
console.log(alert.description_text); // TranslatedString
console.log(alert.cause);            // AlertCause enum
console.log(alert.effect);           // AlertEffect enum
console.log(alert.active_period);    // TimeRange[]
console.log(alert.informed_entity);  // EntitySelector[]
```

### Querying Vehicle Positions

```typescript
// Get all vehicle positions
const vehicles = await gtfs.getVehiclePositions();

// Filter by route
const routeVehicles = await gtfs.getVehiclePositions({
  routeId: 'ROUTE_1'
});

// Filter by trip
const tripVehicles = await gtfs.getVehiclePositions({
  tripId: 'TRIP_123'
});
const vehicle = tripVehicles.length > 0 ? tripVehicles[0] : null;

// Vehicle structure
console.log(vehicle.position);           // { latitude, longitude, bearing, speed }
console.log(vehicle.current_stop_sequence);
console.log(vehicle.current_status);     // VehicleStopStatus enum
console.log(vehicle.timestamp);
```

### Merging Realtime with Static Data

The library automatically merges realtime data with static schedules when requested:

```typescript
// Get trips with realtime data
const tripsWithRT = await gtfs.getTrips({
  routeId: 'ROUTE_1',
  date: '20240115',
  includeRealtime: true  // Include RT data
});

for (const trip of tripsWithRT) {
  if (trip.realtime?.vehicle_position) {
    console.log('Vehicle location:', trip.realtime.vehicle_position.position);
  }
  if (trip.realtime?.trip_update) {
    console.log('Trip delay:', trip.realtime.trip_update.delay, 'seconds');
  }
}

// Get stop times with realtime delays
const stopTimesWithRT = await gtfs.getStopTimes({
  tripId: 'TRIP_123',
  includeRealtime: true  // Include RT data
});

for (const st of stopTimesWithRT) {
  console.log(`Stop: ${st.stop_id}`);
  console.log(`Scheduled: ${st.arrival_time}`);
  if (st.realtime?.arrival_delay) {
    console.log(`Delay: ${st.realtime.arrival_delay} seconds`);
  }
}
```

### Clearing Realtime Data

```typescript
// Clear all realtime data
await gtfs.clearRealtimeData();

// Then fetch fresh data
await gtfs.fetchRealtimeData();
```

### GTFS-RT Enums

The library exports all GTFS-RT enums for type checking:

```typescript
import {
  AlertCause,
  AlertEffect,
  ScheduleRelationship,
  VehicleStopStatus,
  CongestionLevel,
  OccupancyStatus
} from 'gtfs-sqljs';

// Use enums for filtering or comparison
if (alert.cause === AlertCause.ACCIDENT) {
  console.log('Alert is due to an accident');
}
```

## Smart Caching

The library supports optional caching of processed GTFS databases to dramatically speed up subsequent loads. The first load processes the GTFS zip file (~5-10 seconds), but subsequent loads use the cached database (<1 second).

### Setting Up Caching

Cache store implementations are available in `examples/cache/`. Copy the appropriate implementation to your project:

**Browser - IndexedDB:**
```typescript
// Copy examples/cache/IndexedDBCacheStore.ts to your project
import { GtfsSqlJs } from 'gtfs-sqljs';
import { createSqlJsAdapter } from 'gtfs-sqljs/adapters/sql-js';
import { IndexedDBCacheStore } from './IndexedDBCacheStore';

const cache = new IndexedDBCacheStore();
const adapter = await createSqlJsAdapter();

// First load: processes GTFS zip file and caches the result
const gtfs = await GtfsSqlJs.fromZip('gtfs.zip', { adapter, cache });

// Second load: uses cached database (much faster!)
const gtfs2 = await GtfsSqlJs.fromZip('gtfs.zip', { adapter, cache });
```

**Node.js - FileSystem:**
```typescript
// Copy examples/cache/FileSystemCacheStore.ts to your project
import { GtfsSqlJs } from 'gtfs-sqljs';
import { createSqlJsAdapter } from 'gtfs-sqljs/adapters/sql-js';
import { FileSystemCacheStore } from './FileSystemCacheStore';

const cache = new FileSystemCacheStore({ dir: './.cache/gtfs' });

const gtfs = await GtfsSqlJs.fromZip('gtfs.zip', {
  adapter: await createSqlJsAdapter(),
  cache,
});
```

**Note:** `FileSystemCacheStore` uses Node.js built-in modules (`fs`, `path`, `os`) and is **NOT compatible** with browser or React Native environments.

**Caching with file-backed adapters (better-sqlite3, op-sqlite, …):** file-backed drivers persist their own database on disk, so the library's cache is redundant. If you plug in a file-backed adapter and enable the cache, the cache layer catches `ExportNotSupportedError` from `export()` and logs a warning instead of failing the load.

### Cache Invalidation

The cache is automatically invalidated when any of these change:
- **File checksum** (SHA-256) - Different GTFS data
- **File size** - Quick check before computing checksum
- **Library version** - Schema or processing logic updated
- **Data version** - User-specified version (see below)
- **Skipped files** - Different `skipFiles` options

### Data Versioning

Use `cacheVersion` to control cache invalidation:

```typescript
const adapter = await createSqlJsAdapter();

// Load with version 1.0
const gtfs = await GtfsSqlJs.fromZip('gtfs.zip', {
  adapter,
  cache,
  cacheVersion: '1.0',
});

// Load with version 2.0 - will reprocess and create new cache
const gtfs2 = await GtfsSqlJs.fromZip('gtfs.zip', {
  adapter,
  cache,
  cacheVersion: '2.0',
});
```

**When to increment version:**
- GTFS data is updated but filename stays the same
- You want to force cache refresh
- Testing different processing configurations

### Cache Store Options

**IndexedDBCacheStore options:**
```typescript
import { IndexedDBCacheStore } from './IndexedDBCacheStore';

const cache = new IndexedDBCacheStore({
  dbName: 'my-app-gtfs-cache'  // Custom database name
});
```

**FileSystemCacheStore options:**
```typescript
import { FileSystemCacheStore } from './FileSystemCacheStore';

const cache = new FileSystemCacheStore({
  dir: './my-cache-dir'  // Custom cache directory
});
```

### Cache Management

Cache management methods require passing the cache store instance:

**Get cache statistics:**
```typescript
import { IndexedDBCacheStore } from './IndexedDBCacheStore';

const cache = new IndexedDBCacheStore();
const stats = await GtfsSqlJs.getCacheStats(cache);

console.log(`Total entries: ${stats.totalEntries}`);
console.log(`Active entries: ${stats.activeEntries}`);
console.log(`Expired entries: ${stats.expiredEntries}`);
console.log(`Total size: ${stats.totalSizeMB} MB`);
```

**List cache entries:**
```typescript
const entries = await GtfsSqlJs.listCache(cache);

entries.forEach(entry => {
  console.log(`Key: ${entry.key}`);
  console.log(`Source: ${entry.metadata.source}`);
  console.log(`Size: ${(entry.metadata.size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Age: ${((Date.now() - entry.metadata.timestamp) / 1000 / 60 / 60).toFixed(1)} hours`);
});
```

**Clean expired entries:**
```typescript
// Remove entries older than 7 days (default)
const deletedCount = await GtfsSqlJs.cleanExpiredCache(cache);
console.log(`Deleted ${deletedCount} expired entries`);

// Custom expiration time (3 days)
const threeDays = 3 * 24 * 60 * 60 * 1000;
await GtfsSqlJs.cleanExpiredCache(cache, threeDays);
```

**Clear all cache:**
```typescript
await GtfsSqlJs.clearCache(cache);
```

### Without Caching

By default, caching is disabled. Simply omit the `cache` option:

```typescript
const gtfs = await GtfsSqlJs.fromZip('gtfs.zip', {
  adapter: await createSqlJsAdapter(),
});
// No caching - GTFS is processed fresh each time
```

### Custom Cache Expiration

Change the default expiration time (default: 7 days):

```typescript
const gtfs = await GtfsSqlJs.fromZip('gtfs.zip', {
  adapter: await createSqlJsAdapter(),
  cache,
  cacheExpirationMs: 3 * 24 * 60 * 60 * 1000, // 3 days
});
```

### Custom Cache Store Implementation

Implement your own cache store (e.g., Redis, S3):

```typescript
import type { CacheStore, CacheMetadata } from 'gtfs-sqljs';

class RedisCacheStore implements CacheStore {
  async get(key: string): Promise<ArrayBuffer | null> {
    // Implement Redis get
  }

  async set(key: string, data: ArrayBuffer, metadata: CacheMetadata): Promise<void> {
    // Implement Redis set
  }

  async has(key: string): Promise<boolean> {
    // Implement Redis exists check
  }

  async delete(key: string): Promise<void> {
    // Implement Redis delete
  }

  async clear(): Promise<void> {
    // Implement Redis clear
  }

  async list(): Promise<CacheEntry[]> {
    // Optional: Implement list
  }
}

const cache = new RedisCacheStore();
const gtfs = await GtfsSqlJs.fromZip('gtfs.zip', {
  adapter: await createSqlJsAdapter(),
  cache,
});
```

## Export Database

```typescript
// Export to ArrayBuffer for storage (includes RT data)
const buffer = await gtfs.export();

// Save to file (Node.js)
import fs from 'fs';
fs.writeFileSync('gtfs.db', Buffer.from(buffer));

// Store in IndexedDB (Browser)
// ... use IndexedDB API to store the ArrayBuffer
```

## Advanced Usage

### Direct Database Access

For advanced queries not covered by the API, use `getDatabase()` — it returns the adapter's `GtfsDatabase`, which exposes `prepare`, `run`, `export`, `close`. Every method is async:

```typescript
const db = gtfs.getDatabase();

const stmt = await db.prepare('SELECT * FROM stops WHERE stop_lat > ? AND stop_lon < ?');
await stmt.bind([40.7, -74.0]);

while (await stmt.step()) {
  const row = await stmt.getAsObject();
  console.log(row);
}

await stmt.free();
```

If you need the underlying raw driver (sql.js `Database`, better-sqlite3 `Database`, …) for driver-specific features, keep a reference to it at the point you created the adapter — gtfs-sqljs deliberately does not re-expose it, to keep the library driver-agnostic.

### Close Database

```typescript
// Close the database when done
await gtfs.close();
```

For `GtfsSqlJs.attach()` with a handle you created yourself, `close()` does **not** release the underlying handle by default — you are responsible for closing it. Pass `ownsDatabase: true` to `attach()` if you want the library to close it for you.

## Complete Example

```typescript
import { GtfsSqlJs } from 'gtfs-sqljs';
import { createSqlJsAdapter } from 'gtfs-sqljs/adapters/sql-js';

async function example() {
  // Load GTFS data (skip shapes.txt to reduce memory usage)
  const gtfs = await GtfsSqlJs.fromZip('https://example.com/gtfs.zip', {
    adapter: await createSqlJsAdapter(),
    skipFiles: ['shapes.txt'],
  });

  // Find a stop using flexible filters
  const stops = await gtfs.getStops({ name: 'Central Station' });
  const stop = stops[0];
  console.log(`Found stop: ${stop.stop_name}`);

  // Find routes serving this stop (via stop_times and trips)
  const allStopTimes = await gtfs.getStopTimes({ stopId: stop.stop_id });
  const routeIds = new Set<string>();
  for (const st of allStopTimes) {
    const trips = await gtfs.getTrips({ tripId: st.trip_id });
    if (trips.length > 0) routeIds.add(trips[0].route_id);
  }

  // Get route details
  for (const routeId of routeIds) {
    const routes = await gtfs.getRoutes({ routeId });
    const route = routes.length > 0 ? routes[0] : null;
    console.log(`Route: ${route?.route_short_name} - ${route?.route_long_name}`);
  }

  // Get trips for a specific route on a date using flexible filters
  const today = '20240115'; // YYYYMMDD format
  const trips = await gtfs.getTrips({
    routeId: Array.from(routeIds)[0]!,
    date: today,
  });
  console.log(`Found ${trips.length} trips for today`);

  // Get stop times for a specific trip
  const stopTimes = await gtfs.getStopTimes({ tripId: trips[0].trip_id });
  console.log('Trip schedule:');
  for (const st of stopTimes) {
    const matched = await gtfs.getStops({ stopId: st.stop_id });
    const matchedStop = matched.length > 0 ? matched[0] : null;
    console.log(`  ${st.arrival_time} - ${matchedStop?.stop_name}`);
  }

  // Export database for later use
  const buffer = await gtfs.export();
  // ... save buffer to file or storage

  // Clean up
  await gtfs.close();
}

example();
```
