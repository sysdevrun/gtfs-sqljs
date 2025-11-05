# gtfs-sqljs

A TypeScript library for loading GTFS (General Transit Feed Specification) data into a sql.js SQLite database for querying in both browser and Node.js environments.

## Author

**Théophile Helleboid / SysDevRun**

- Email: contact@sys-dev-run.fr
- Website: https://www.sys-dev-run.fr/

## Features

- ✅ Load GTFS data from ZIP files (URL or local path)
- ✅ Load existing SQLite databases
- ✅ Export databases to ArrayBuffer for persistence
- ✅ Full TypeScript support with comprehensive types
- ✅ Works in both browser and Node.js
- ✅ Efficient querying with indexed SQLite database
- ✅ Proper handling of GTFS required/optional fields
- ✅ Active service detection based on calendar/calendar_dates

## Installation

```bash
npm install gtfs-sqljs
```

You also need to install sql.js as a peer dependency:

```bash
npm install sql.js
```

## Loading the sql.js WASM File

sql.js requires a WASM file to be loaded. There are several ways to handle this:

### Node.js

In Node.js, sql.js will automatically locate the WASM file from the installed package:

```typescript
import { GtfsSqlJs } from 'gtfs-sqljs';

// The WASM file is loaded automatically
const gtfs = await GtfsSqlJs.fromZip('path/to/gtfs.zip');
```

### Browser with CDN

You can use a CDN to serve the WASM file:

```typescript
import initSqlJs from 'sql.js';
import { GtfsSqlJs } from 'gtfs-sqljs';

// Initialize sql.js with CDN WASM file
const SQL = await initSqlJs({
  locateFile: (filename) => `https://sql.js.org/dist/${filename}`
});

// Pass the SQL instance to GtfsSqlJs
const gtfs = await GtfsSqlJs.fromZip('https://example.com/gtfs.zip', { SQL });
```

### Browser with Bundler (Webpack, Vite, etc.)

If you're using a bundler, you need to configure it to handle the WASM file:

#### Vite

```typescript
import initSqlJs from 'sql.js';
import { GtfsSqlJs } from 'gtfs-sqljs';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

const SQL = await initSqlJs({
  locateFile: () => sqlWasmUrl
});

const gtfs = await GtfsSqlJs.fromZip('https://example.com/gtfs.zip', { SQL });
```

#### Webpack

```typescript
import initSqlJs from 'sql.js';
import { GtfsSqlJs } from 'gtfs-sqljs';

const SQL = await initSqlJs({
  locateFile: (filename) => `/path/to/public/${filename}`
});

const gtfs = await GtfsSqlJs.fromZip('https://example.com/gtfs.zip', { SQL });
```

Make sure to copy `sql-wasm.wasm` from `node_modules/sql.js/dist/` to your public directory.

## Usage

### Creating an Instance

#### From a GTFS ZIP file

```typescript
import { GtfsSqlJs } from 'gtfs-sqljs';

// From URL
const gtfs = await GtfsSqlJs.fromZip('https://example.com/gtfs.zip');

// From local file (Node.js)
const gtfs = await GtfsSqlJs.fromZip('./path/to/gtfs.zip');
```

#### From an existing SQLite database

```typescript
import { GtfsSqlJs } from 'gtfs-sqljs';

// Load from ArrayBuffer
const dbBuffer = await fetch('https://example.com/gtfs.db').then(r => r.arrayBuffer());
const gtfs = await GtfsSqlJs.fromDatabase(dbBuffer);
```

### Querying Data

#### Get Stop Information

```typescript
// Get stop by ID
const stop = gtfs.getStopById('STOP_123');
console.log(stop?.stop_name);

// Get stop by code
const stop = gtfs.getStopByCode('ABC');

// Search stops by name
const stops = gtfs.searchStopsByName('Main Street');

// Get all stops
const allStops = gtfs.getAllStops();
```

#### Get Route Information

```typescript
// Get route by ID
const route = gtfs.getRouteById('ROUTE_1');

// Get all routes
const routes = gtfs.getAllRoutes();

// Get routes by agency
const agencyRoutes = gtfs.getRoutesByAgency('AGENCY_1');
```

#### Get Calendar Information

```typescript
// Get active services for a date (YYYYMMDD format)
const serviceIds = gtfs.getActiveServiceIds('20240115');

// Get calendar by service ID
const calendar = gtfs.getCalendarByServiceId('WEEKDAY');

// Get calendar date exceptions
const exceptions = gtfs.getCalendarDates('WEEKDAY');
```

#### Get Trip Information

```typescript
// Get trip by ID
const trip = gtfs.getTripById('TRIP_123');

// Get trips by route
const trips = gtfs.getTripsByRoute('ROUTE_1');

// Get trips by route and date
const trips = gtfs.getTripsByRouteAndDate('ROUTE_1', '20240115');

// Get trips by route, date, and direction
const trips = gtfs.getTripsByRouteAndDateAndDirection('ROUTE_1', '20240115', 0);
```

#### Get Stop Time Information

```typescript
// Get stop times for a trip
const stopTimes = gtfs.getStopTimesByTrip('TRIP_123');

// Get stop times for a stop
const stopTimes = gtfs.getStopTimesByStop('STOP_123');

// Get stop times for a stop, route, and date
const stopTimes = gtfs.getStopTimesForStopRouteAndDate(
  'STOP_123',
  'ROUTE_1',
  '20240115'
);

// Get stop times with direction filter
const stopTimes = gtfs.getStopTimesForStopRouteAndDate(
  'STOP_123',
  'ROUTE_1',
  '20240115',
  0 // direction_id
);
```

### Export Database

```typescript
// Export to ArrayBuffer for storage
const buffer = gtfs.export();

// Save to file (Node.js)
import fs from 'fs';
fs.writeFileSync('gtfs.db', Buffer.from(buffer));

// Store in IndexedDB (Browser)
// ... use IndexedDB API to store the ArrayBuffer
```

### Advanced Usage

#### Direct Database Access

For advanced queries not covered by the API:

```typescript
const db = gtfs.getDatabase();

const stmt = db.prepare('SELECT * FROM stops WHERE stop_lat > ? AND stop_lon < ?');
stmt.bind([40.7, -74.0]);

while (stmt.step()) {
  const row = stmt.getAsObject();
  console.log(row);
}

stmt.free();
```

#### Close Database

```typescript
// Close the database when done
gtfs.close();
```

## Complete Example

```typescript
import { GtfsSqlJs } from 'gtfs-sqljs';

async function example() {
  // Load GTFS data
  const gtfs = await GtfsSqlJs.fromZip('https://example.com/gtfs.zip');

  // Find a stop
  const stops = gtfs.searchStopsByName('Central Station');
  const stop = stops[0];
  console.log(`Found stop: ${stop.stop_name}`);

  // Find routes serving this stop (via stop_times and trips)
  const allStopTimes = gtfs.getStopTimesByStop(stop.stop_id);
  const routeIds = new Set(
    allStopTimes.map(st => {
      const trip = gtfs.getTripById(st.trip_id);
      return trip?.route_id;
    })
  );

  // Get route details
  for (const routeId of routeIds) {
    if (!routeId) continue;
    const route = gtfs.getRouteById(routeId);
    console.log(`Route: ${route?.route_short_name} - ${route?.route_long_name}`);
  }

  // Get trips for a specific route on a date
  const today = '20240115'; // YYYYMMDD format
  const trips = gtfs.getTripsByRouteAndDate(Array.from(routeIds)[0]!, today);
  console.log(`Found ${trips.length} trips for today`);

  // Get stop times for a specific trip
  const stopTimes = gtfs.getStopTimesByTrip(trips[0].trip_id);
  console.log('Trip schedule:');
  for (const st of stopTimes) {
    const stop = gtfs.getStopById(st.stop_id);
    console.log(`  ${st.arrival_time} - ${stop?.stop_name}`);
  }

  // Export database for later use
  const buffer = gtfs.export();
  // ... save buffer to file or storage

  // Clean up
  gtfs.close();
}

example();
```

## API Reference

### Static Methods

- `GtfsSqlJs.fromZip(zipPath, options?)` - Create instance from GTFS ZIP file
- `GtfsSqlJs.fromDatabase(database, options?)` - Create instance from existing database

### Instance Methods

#### Stop Methods
- `getStopById(stopId)` - Get stop by stop_id
- `getStopByCode(stopCode)` - Get stop by stop_code
- `searchStopsByName(name, limit?)` - Search stops by name
- `getAllStops(limit?)` - Get all stops

#### Route Methods
- `getRouteById(routeId)` - Get route by route_id
- `getAllRoutes(limit?)` - Get all routes
- `getRoutesByAgency(agencyId)` - Get routes by agency

#### Calendar Methods
- `getActiveServiceIds(date)` - Get active service IDs for a date
- `getCalendarByServiceId(serviceId)` - Get calendar by service_id
- `getCalendarDates(serviceId)` - Get calendar date exceptions
- `getCalendarDatesForDate(date)` - Get exceptions for a specific date

#### Trip Methods
- `getTripById(tripId)` - Get trip by trip_id
- `getTripsByRoute(routeId)` - Get trips for a route
- `getTripsByRouteAndDate(routeId, date)` - Get trips for route and date
- `getTripsByRouteAndDateAndDirection(routeId, date, directionId)` - Get trips with direction filter

#### Stop Time Methods
- `getStopTimesByTrip(tripId)` - Get stop times for a trip
- `getStopTimesByStop(stopId, limit?)` - Get stop times for a stop
- `getStopTimesForStopRouteAndDate(stopId, routeId, date, directionId?)` - Get stop times with filters

#### Database Methods
- `export()` - Export database to ArrayBuffer
- `getDatabase()` - Get direct access to sql.js database
- `close()` - Close database connection

## TypeScript Support

This library is written in TypeScript and provides full type definitions for all GTFS entities:

```typescript
import type { Stop, Route, Trip, StopTime } from 'gtfs-sqljs';

const stop: Stop = gtfs.getStopById('STOP_123')!;
```

## GTFS Specification

This library implements the [GTFS Schedule Reference](https://gtfs.org/schedule/reference/) with proper handling of required and optional fields.

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Issues

If you encounter any problems or have suggestions, please [open an issue](https://github.com/sysdevrun/gtfs-sqljs/issues).
