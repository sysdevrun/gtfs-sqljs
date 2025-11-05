# gtfs-sqljs

A TypeScript library for loading GTFS (General Transit Feed Specification) data into a sql.js SQLite database for querying in both browser and Node.js environments.

## Author

**Théophile Helleboid / SysDevRun**

- Email: contact@sys-dev-run.fr
- Website: https://www.sys-dev-run.fr/

## Documentation & Demo

📚 **[View Documentation and Interactive Demo](https://sysdevrun.github.io/gtfs-sqljs/)**

Try the live demo to explore GTFS data, view routes with colors, and see trip schedules in action!

## Features

### GTFS Static Data
- ✅ Load GTFS data from ZIP files (URL or local path)
- ✅ Skip importing specific files (e.g., shapes.txt) to reduce memory usage
- ✅ Load existing SQLite databases
- ✅ Export databases to ArrayBuffer for persistence
- ✅ Flexible filter-based query API - combine multiple filters easily
- ✅ Agency query support with agency-based filtering
- ✅ Full TypeScript support with comprehensive types
- ✅ Works in both browser and Node.js
- ✅ Efficient querying with indexed SQLite database
- ✅ Proper handling of GTFS required/optional fields
- ✅ Active service detection based on calendar/calendar_dates

### GTFS Realtime Support
- ✅ Load GTFS-RT data from protobuf feeds (URLs or local files)
- ✅ Support for Alerts, Trip Updates, and Vehicle Positions
- ✅ Automatic staleness filtering (configurable threshold)
- ✅ Active alert period checking
- ✅ Merge realtime data with static schedules
- ✅ Filter alerts and vehicle positions by route, stop, or trip
- ✅ Store RT data in SQLite for consistent querying
- ✅ Include RT data in database exports

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

// Skip importing specific files to reduce memory usage
// Tables will be created but data won't be imported
const gtfs = await GtfsSqlJs.fromZip('https://example.com/gtfs.zip', {
  skipFiles: ['shapes.txt', 'frequencies.txt']
});
```

#### From an existing SQLite database

```typescript
import { GtfsSqlJs } from 'gtfs-sqljs';

// Load from ArrayBuffer
const dbBuffer = await fetch('https://example.com/gtfs.db').then(r => r.arrayBuffer());
const gtfs = await GtfsSqlJs.fromDatabase(dbBuffer);
```

### Querying Data

The library provides two ways to query GTFS data:
1. **Flexible filter-based methods** (recommended) - Pass an object with optional filters
2. **Convenience methods** - Direct methods for common use cases

#### Flexible Filter-Based Queries (Recommended)

The new flexible API allows you to pass multiple optional filters in a single method call:

```typescript
// Get stops - combine any filters
const stops = gtfs.getStops({
  name: 'Station',        // Search by name
  limit: 10               // Limit results
});

// Get routes - with or without filters
const allRoutes = gtfs.getRoutes();
const agencyRoutes = gtfs.getRoutes({ agencyId: 'AGENCY_1' });

// Get trips - combine multiple filters
const trips = gtfs.getTrips({
  routeId: 'ROUTE_1',     // Filter by route
  date: '20240115',       // Filter by date (gets active services)
  directionId: 0,         // Filter by direction
  limit: 50               // Limit results
});

// Get stop times - flexible filtering
const stopTimes = gtfs.getStopTimes({
  stopId: 'STOP_123',     // At a specific stop
  routeId: 'ROUTE_1',     // For a specific route
  date: '20240115',       // On a specific date
  directionId: 0          // In a specific direction
});
```

**Available Filter Options:**

- `getStops(filters?)`:
  - `stopId`: string - Filter by stop ID
  - `stopCode`: string - Filter by stop code
  - `name`: string - Search by stop name (partial match)
  - `tripId`: string - Get stops for a trip
  - `limit`: number - Limit results

- `getRoutes(filters?)`:
  - `routeId`: string - Filter by route ID
  - `agencyId`: string - Filter by agency
  - `limit`: number - Limit results

- `getTrips(filters?)`:
  - `tripId`: string - Filter by trip ID
  - `routeId`: string - Filter by route
  - `date`: string - Filter by date (YYYYMMDD format)
  - `directionId`: number - Filter by direction
  - `limit`: number - Limit results

- `getStopTimes(filters?)`:
  - `tripId`: string - Filter by trip
  - `stopId`: string - Filter by stop
  - `routeId`: string - Filter by route
  - `date`: string - Filter by date (YYYYMMDD format)
  - `directionId`: number - Filter by direction
  - `limit`: number - Limit results

#### Get Stop Information

```typescript
// Get stop by ID
const stop = gtfs.getStopById('STOP_123');
console.log(stop?.stop_name);

// Get stop by code (using filters)
const stops = gtfs.getStops({ stopCode: 'ABC' });
const stop = stops[0];

// Search stops by name (using filters)
const stops = gtfs.getStops({ name: 'Main Street' });

// Get all stops (using filters with no parameters)
const allStops = gtfs.getStops();

// Get stops with limit
const stops = gtfs.getStops({ limit: 10 });

// Get stops for a specific trip
const stops = gtfs.getStops({ tripId: 'TRIP_123' });
```

#### Get Route Information

```typescript
// Get route by ID
const route = gtfs.getRouteById('ROUTE_1');

// Get all routes (using filters with no parameters)
const routes = gtfs.getRoutes();

// Get routes by agency (using filters)
const agencyRoutes = gtfs.getRoutes({ agencyId: 'AGENCY_1' });

// Get routes with limit
const routes = gtfs.getRoutes({ limit: 10 });
```

#### Get Agency Information

```typescript
// Get agency by ID
const agency = gtfs.getAgencyById('AGENCY_1');

// Get all agencies
const agencies = gtfs.getAgencies();

// Get agencies with limit
const agencies = gtfs.getAgencies({ limit: 5 });
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

// Get trips by route (using filters)
const trips = gtfs.getTrips({ routeId: 'ROUTE_1' });

// Get trips by route and date (using filters)
const trips = gtfs.getTrips({ routeId: 'ROUTE_1', date: '20240115' });

// Get trips by route, date, and direction (using filters)
const trips = gtfs.getTrips({
  routeId: 'ROUTE_1',
  date: '20240115',
  directionId: 0
});

// Get all trips for a date
const trips = gtfs.getTrips({ date: '20240115' });

// Get trips by agency
const trips = gtfs.getTrips({ agencyId: 'AGENCY_1' });
```

#### Get Stop Time Information

```typescript
// Get stop times for a trip (ordered by stop_sequence)
const stopTimes = gtfs.getStopTimesByTrip('TRIP_123');

// Get stop times for a stop (using filters)
const stopTimes = gtfs.getStopTimes({ stopId: 'STOP_123' });

// Get stop times for a stop and route (using filters)
const stopTimes = gtfs.getStopTimes({
  stopId: 'STOP_123',
  routeId: 'ROUTE_1'
});

// Get stop times for a stop, route, and date (using filters)
const stopTimes = gtfs.getStopTimes({
  stopId: 'STOP_123',
  routeId: 'ROUTE_1',
  date: '20240115'
});

// Get stop times with direction filter (using filters)
const stopTimes = gtfs.getStopTimes({
  stopId: 'STOP_123',
  routeId: 'ROUTE_1',
  date: '20240115',
  directionId: 0
});

// Get stop times by agency
const stopTimes = gtfs.getStopTimes({
  agencyId: 'AGENCY_1',
  date: '20240115'
});
```

### GTFS Realtime Support

This library supports GTFS Realtime data (alerts, trip updates, and vehicle positions) with automatic merging into static schedule data.

#### Loading Realtime Data

```typescript
// Configure RT feed URLs (optional - can also pass directly to fetchRealtimeData)
const gtfs = await GtfsSqlJs.fromZip('https://example.com/gtfs.zip', {
  realtimeFeedUrls: [
    'https://example.com/gtfs-rt/alerts',
    'https://example.com/gtfs-rt/trip-updates',
    'https://example.com/gtfs-rt/vehicle-positions'
  ],
  stalenessThreshold: 120 // seconds (default: 120)
});

// Fetch RT data (uses configured URLs or pass custom URLs)
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
```

#### Querying Alerts

```typescript
// Get all active alerts
const activeAlerts = gtfs.getAlerts({ activeOnly: true });

// Filter alerts by route
const routeAlerts = gtfs.getAlerts({
  routeId: 'ROUTE_1',
  activeOnly: true
});

// Filter alerts by stop
const stopAlerts = gtfs.getAlerts({
  stopId: 'STOP_123',
  activeOnly: true
});

// Filter alerts by trip
const tripAlerts = gtfs.getAlerts({
  tripId: 'TRIP_456'
});

// Get alert by ID
const alert = gtfs.getAlertById('alert:12345');

// Alert structure
console.log(alert.header_text);      // TranslatedString
console.log(alert.description_text); // TranslatedString
console.log(alert.cause);            // AlertCause enum
console.log(alert.effect);           // AlertEffect enum
console.log(alert.active_period);    // TimeRange[]
console.log(alert.informed_entity);  // EntitySelector[]
```

#### Querying Vehicle Positions

```typescript
// Get all vehicle positions
const vehicles = gtfs.getVehiclePositions();

// Filter by route
const routeVehicles = gtfs.getVehiclePositions({
  routeId: 'ROUTE_1'
});

// Filter by trip
const tripVehicle = gtfs.getVehiclePositions({
  tripId: 'TRIP_123'
});

// Get vehicle by trip ID
const vehicle = gtfs.getVehiclePositionByTripId('TRIP_123');

// Vehicle structure
console.log(vehicle.position);           // { latitude, longitude, bearing, speed }
console.log(vehicle.current_stop_sequence);
console.log(vehicle.current_status);     // VehicleStopStatus enum
console.log(vehicle.timestamp);
```

#### Merging Realtime with Static Data

The library automatically merges realtime data with static schedules when requested:

```typescript
// Get trips with realtime data
const tripsWithRT = gtfs.getTrips({
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
const stopTimesWithRT = gtfs.getStopTimes({
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

#### Clearing Realtime Data

```typescript
// Clear all realtime data
gtfs.clearRealtimeData();

// Then fetch fresh data
await gtfs.fetchRealtimeData();
```

#### GTFS-RT Enums

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

### Export Database

```typescript
// Export to ArrayBuffer for storage (includes RT data)
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
  // Load GTFS data (skip shapes.txt to reduce memory usage)
  const gtfs = await GtfsSqlJs.fromZip('https://example.com/gtfs.zip', {
    skipFiles: ['shapes.txt']
  });

  // Find a stop using flexible filters
  const stops = gtfs.getStops({ name: 'Central Station' });
  const stop = stops[0];
  console.log(`Found stop: ${stop.stop_name}`);

  // Find routes serving this stop (via stop_times and trips)
  const allStopTimes = gtfs.getStopTimes({ stopId: stop.stop_id });
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

  // Get trips for a specific route on a date using flexible filters
  const today = '20240115'; // YYYYMMDD format
  const trips = gtfs.getTrips({
    routeId: Array.from(routeIds)[0]!,
    date: today
  });
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

#### Flexible Filter-Based Methods (Recommended)
- `getStops(filters?)` - Get stops with optional filters (stopId, stopCode, name, tripId, limit)
- `getRoutes(filters?)` - Get routes with optional filters (routeId, agencyId, limit)
- `getTrips(filters?)` - Get trips with optional filters (tripId, routeId, date, directionId, agencyId, limit)
- `getStopTimes(filters?)` - Get stop times with optional filters (tripId, stopId, routeId, date, directionId, agencyId, limit)
- `getAgencies(filters?)` - Get agencies with optional filters (agencyId, limit)

#### Direct Lookup Methods
- `getStopById(stopId)` - Get stop by stop_id
- `getRouteById(routeId)` - Get route by route_id
- `getTripById(tripId)` - Get trip by trip_id
- `getAgencyById(agencyId)` - Get agency by agency_id

#### Calendar Methods
- `getActiveServiceIds(date)` - Get active service IDs for a date
- `getCalendarByServiceId(serviceId)` - Get calendar by service_id
- `getCalendarDates(serviceId)` - Get calendar date exceptions
- `getCalendarDatesForDate(date)` - Get exceptions for a specific date

#### Special Methods
- `getStopTimesByTrip(tripId)` - Get stop times for a trip (ordered by stop_sequence)

#### GTFS Realtime Methods
- `fetchRealtimeData(urls?)` - Fetch and load RT data from protobuf feeds
- `clearRealtimeData()` - Clear all realtime data from database
- `setRealtimeFeedUrls(urls)` - Configure RT feed URLs
- `getRealtimeFeedUrls()` - Get configured RT feed URLs
- `setStalenessThreshold(seconds)` - Set staleness threshold (default: 120)
- `getStalenessThreshold()` - Get staleness threshold
- `getAlerts(filters?)` - Get alerts with optional filters (routeId, stopId, tripId, activeOnly)
- `getAlertById(alertId)` - Get alert by ID
- `getVehiclePositions(filters?)` - Get vehicle positions with optional filters (routeId, tripId, vehicleId)
- `getVehiclePositionByTripId(tripId)` - Get vehicle position by trip ID

#### Database Methods
- `export()` - Export database to ArrayBuffer (includes RT data)
- `getDatabase()` - Get direct access to sql.js database
- `close()` - Close database connection

## TypeScript Support

This library is written in TypeScript and provides full type definitions for all GTFS entities, filter options, and GTFS-RT types:

```typescript
import type {
  // Static GTFS types
  Stop, Route, Trip, StopTime,
  TripFilters, StopTimeFilters,
  // GTFS-RT types
  Alert, VehiclePosition, TripWithRealtime, StopTimeWithRealtime,
  AlertFilters, VehiclePositionFilters,
  // GTFS-RT enums
  AlertCause, AlertEffect, ScheduleRelationship
} from 'gtfs-sqljs';

const stop: Stop = gtfs.getStopById('STOP_123')!;

// Use filter types for better type safety
const filters: TripFilters = {
  routeId: 'ROUTE_1',
  directionId: 0,
  includeRealtime: true
};
const trips = gtfs.getTrips(filters);

// RT types
const alerts: Alert[] = gtfs.getAlerts({ activeOnly: true });
const vehicles: VehiclePosition[] = gtfs.getVehiclePositions();
```

## GTFS Specification

This library implements:
- [GTFS Schedule Reference](https://gtfs.org/schedule/reference/) with proper handling of required and optional fields
- [GTFS Realtime Reference v2.0](https://gtfs.org/realtime/reference/) with support for Alerts, Trip Updates, and Vehicle Positions

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Issues

If you encounter any problems or have suggestions, please [open an issue](https://github.com/sysdevrun/gtfs-sqljs/issues).
