/**
 * Basic Usage Example for gtfs-sqljs (v0.5+ async / pluggable-adapter API).
 *
 * This example shows the sql.js path. For a file-backed native driver
 * (better-sqlite3, op-sqlite, expo-sqlite), open a connection yourself and
 * pass the wrapped handle to `GtfsSqlJs.attach()` instead.
 */

import { GtfsSqlJs } from '../src/index';
import { createSqlJsAdapter } from '../src/adapters/sql-js';

async function main() {
  console.log('Loading GTFS data...');

  const gtfs = await GtfsSqlJs.fromZip('path/to/gtfs.zip', {
    adapter: await createSqlJsAdapter(),
  });

  console.log('GTFS data loaded successfully!\n');

  console.log('=== Example 1: Search for stops ===');
  const stops = await gtfs.getStops({ name: 'Station', limit: 5 });
  console.log(`Found ${stops.length} stops:`);
  stops.forEach(stop => {
    console.log(`  - ${stop.stop_name} (${stop.stop_id})`);
  });
  console.log();

  console.log('=== Example 2: List all routes ===');
  const routes = await gtfs.getRoutes({ limit: 5 });
  console.log(`Found ${routes.length} routes:`);
  routes.forEach(route => {
    console.log(`  - ${route.route_short_name}: ${route.route_long_name}`);
  });
  console.log();

  console.log('=== Example 3: Active services for a date ===');
  const date = '20240115';
  const serviceIds = await gtfs.getActiveServiceIds(date);
  console.log(`Active services on ${date}:`);
  serviceIds.forEach(serviceId => {
    console.log(`  - ${serviceId}`);
  });
  console.log();

  if (routes.length > 0) {
    console.log('=== Example 4: Trips for a route ===');
    const route = routes[0];
    const trips = await gtfs.getTrips({ routeId: route.route_id, date });
    console.log(`Trips for route ${route.route_short_name} on ${date}:`);
    trips.slice(0, 5).forEach(trip => {
      console.log(`  - ${trip.trip_id} (${trip.trip_headsign || 'No headsign'})`);
    });
    console.log();

    if (trips.length > 0) {
      console.log('=== Example 5: Stop times for a trip ===');
      const trip = trips[0];
      const stopTimes = await gtfs.getStopTimes({ tripId: trip.trip_id });
      const stopsForTrip = await gtfs.getStops({ tripId: trip.trip_id });
      const stopById = new Map(stopsForTrip.map(s => [s.stop_id, s]));
      console.log(`Schedule for trip ${trip.trip_id}:`);
      stopTimes.forEach(st => {
        console.log(`  ${st.arrival_time} - ${stopById.get(st.stop_id)?.stop_name ?? st.stop_id}`);
      });
      console.log();
    }
  }

  console.log('=== Example 6: Export database ===');
  const buffer = await gtfs.export();
  console.log(`Database exported: ${buffer.byteLength} bytes`);

  await gtfs.close();
  console.log('Done!');
}

main().catch(console.error);
