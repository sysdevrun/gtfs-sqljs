/**
 * Example demonstrating SQL query logging feature
 *
 * This example shows how to enable query logging to see all SQL queries
 * executed by the gtfs-sqljs library in the console.
 */

import { GtfsSqlJs } from '../src/index';

async function queryLoggingDemo() {
  console.log('=== GTFS SQL Query Logging Demo ===\n');
  console.log('Loading GTFS data with query logging enabled...\n');

  // Enable query logging by setting enableQueryLogging to true
  const gtfs = await GtfsSqlJs.fromZip('./website/public/car-jaune.zip', {
    enableQueryLogging: true,  // <-- Enable query logging
    skipFiles: ['shapes.txt'],  // Skip shapes to speed up loading
    onProgress: (progress) => {
      // Show progress updates
      if (progress.phase === 'complete') {
        console.log(`\n✓ ${progress.message}\n`);
      }
    }
  });

  console.log('--- Querying stops by name ---');
  const stops = gtfs.getStops({ name: 'Station', limit: 3 });
  console.log(`Found ${stops.length} stops\n`);

  console.log('--- Querying routes ---');
  const routes = gtfs.getRoutes({ limit: 2 });
  console.log(`Found ${routes.length} routes\n`);

  if (routes.length > 0) {
    console.log('--- Querying trips for first route ---');
    const trips = gtfs.getTrips({ routeId: routes[0].route_id, limit: 1 });
    console.log(`Found ${trips.length} trip(s)\n`);

    if (trips.length > 0) {
      console.log('--- Querying stop times for first trip ---');
      const stopTimes = gtfs.getStopTimes({ tripId: trips[0].trip_id, limit: 5 });
      console.log(`Found ${stopTimes.length} stop times\n`);
    }
  }

  console.log('--- Getting active service IDs for today ---');
  const serviceIds = gtfs.getActiveServiceIds('20240115');
  console.log(`Found ${serviceIds.length} active services\n`);

  gtfs.close();
  console.log('Database closed');
}

// Run the demo
queryLoggingDemo().catch(console.error);
