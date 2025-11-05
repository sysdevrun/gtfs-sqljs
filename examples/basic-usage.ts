/**
 * Basic Usage Example for gtfs-sqljs
 *
 * This example demonstrates how to load GTFS data and perform basic queries.
 */

import { GtfsSqlJs } from '../src/index';

async function main() {
  console.log('Loading GTFS data...');

  // Load GTFS data from a ZIP file
  // Replace with your GTFS feed URL or local path
  const gtfs = await GtfsSqlJs.fromZip('path/to/gtfs.zip');

  console.log('GTFS data loaded successfully!\n');

  // Example 1: Find stops by name
  console.log('=== Example 1: Search for stops ===');
  const stops = gtfs.searchStopsByName('Station', 5);
  console.log(`Found ${stops.length} stops:`);
  stops.forEach(stop => {
    console.log(`  - ${stop.stop_name} (${stop.stop_id})`);
  });
  console.log();

  // Example 2: Get all routes
  console.log('=== Example 2: List all routes ===');
  const routes = gtfs.getAllRoutes(5);
  console.log(`Found ${routes.length} routes:`);
  routes.forEach(route => {
    console.log(`  - ${route.route_short_name}: ${route.route_long_name}`);
  });
  console.log();

  // Example 3: Get active services for today
  console.log('=== Example 3: Active services for a date ===');
  const date = '20240115'; // YYYYMMDD format
  const serviceIds = gtfs.getActiveServiceIds(date);
  console.log(`Active services on ${date}:`);
  serviceIds.forEach(serviceId => {
    console.log(`  - ${serviceId}`);
  });
  console.log();

  // Example 4: Get trips for a route on a specific date
  if (routes.length > 0) {
    console.log('=== Example 4: Trips for a route ===');
    const route = routes[0];
    const trips = gtfs.getTripsByRouteAndDate(route.route_id, date);
    console.log(`Trips for route ${route.route_short_name} on ${date}:`);
    trips.slice(0, 5).forEach(trip => {
      console.log(`  - ${trip.trip_id} (${trip.trip_headsign || 'No headsign'})`);
    });
    console.log();

    // Example 5: Get stop times for a trip
    if (trips.length > 0) {
      console.log('=== Example 5: Stop times for a trip ===');
      const trip = trips[0];
      const stopTimes = gtfs.getStopTimesByTrip(trip.trip_id);
      console.log(`Schedule for trip ${trip.trip_id}:`);
      stopTimes.forEach(st => {
        const stop = gtfs.getStopById(st.stop_id);
        console.log(`  ${st.arrival_time} - ${stop?.stop_name}`);
      });
      console.log();
    }
  }

  // Example 6: Export database for later use
  console.log('=== Example 6: Export database ===');
  const buffer = gtfs.export();
  console.log(`Database exported: ${buffer.byteLength} bytes`);
  console.log('You can save this buffer and load it later with GtfsSqlJs.fromDatabase()');
  console.log();

  // Clean up
  gtfs.close();
  console.log('Done!');
}

// Run the example
main().catch(console.error);
