/**
 * Test script for GTFS Realtime API with local Car Jaune data
 * Demonstrates RT functionality and API structure
 */

import { GtfsSqlJs, AlertCause, AlertEffect } from './src/gtfs-sqljs';

async function testRealtimeLocal() {
  console.log('🚀 Testing GTFS-RT API with Car Jaune data...\n');

  try {
    // Load GTFS static data from local file
    console.log('📦 Loading GTFS static data from local file...');
    const gtfs = await GtfsSqlJs.fromZip('./website/public/car-jaune.zip', {
      skipFiles: ['shapes.txt'],
      stalenessThreshold: 120
    });
    console.log('✅ GTFS static data loaded\n');

    // Show some basic GTFS info
    const agencies = gtfs.getAgencies();
    console.log(`📍 Agencies: ${agencies.length}`);
    agencies.forEach(agency => {
      console.log(`   - ${agency.agency_name} (${agency.agency_id})`);
    });

    const routes = gtfs.getRoutes({ limit: 5 });
    console.log(`\n🚌 Sample Routes (showing 5 of many):`);
    routes.forEach(route => {
      console.log(`   - ${route.route_short_name}: ${route.route_long_name}`);
    });

    const stops = gtfs.getStops({ limit: 5 });
    console.log(`\n🛑 Sample Stops (showing 5 of many):`);
    stops.forEach(stop => {
      console.log(`   - ${stop.stop_name}`);
    });

    // Demonstrate RT configuration
    console.log('\n\n📡 GTFS-RT Configuration:');
    console.log('-----------------------------------');

    // Set RT feed URLs
    gtfs.setRealtimeFeedUrls([
      'https://pysae.com/api/v2/groups/car-jaune/gtfs-rt'
    ]);
    console.log('✓ RT feed URLs configured');
    console.log(`  URLs: ${gtfs.getRealtimeFeedUrls().join(', ')}`);

    // Check staleness threshold
    console.log(`✓ Staleness threshold: ${gtfs.getStalenessThreshold()} seconds`);

    // Demonstrate RT API (without fetching real data)
    console.log('\n\n🔧 GTFS-RT API Methods Available:');
    console.log('-----------------------------------');

    console.log('\n1. fetchRealtimeData(urls?)');
    console.log('   - Fetches and loads RT data from configured URLs');
    console.log('   - Example: await gtfs.fetchRealtimeData()');
    console.log('   - Or: await gtfs.fetchRealtimeData(["https://custom-url"])');

    console.log('\n2. getAlerts(filters?)');
    console.log('   - Get service alerts with optional filtering');
    console.log('   - Filters: activeOnly, routeId, stopId, tripId, cause, effect, limit');
    console.log('   - Example: gtfs.getAlerts({ activeOnly: true, routeId: "1" })');

    console.log('\n3. getAlertById(alertId)');
    console.log('   - Get specific alert by ID');
    console.log('   - Example: gtfs.getAlertById("alert_123")');

    console.log('\n4. getVehiclePositions(filters?)');
    console.log('   - Get vehicle positions with optional filtering');
    console.log('   - Filters: tripId, routeId, vehicleId, limit');
    console.log('   - Example: gtfs.getVehiclePositions({ routeId: "1" })');

    console.log('\n5. getVehiclePositionByTripId(tripId)');
    console.log('   - Get vehicle position for specific trip');
    console.log('   - Example: gtfs.getVehiclePositionByTripId("trip_123")');

    console.log('\n6. getTrips({ includeRealtime: true })');
    console.log('   - Get trips with realtime data merged');
    console.log('   - Returns vehicle position and trip update data');
    console.log('   - Example: gtfs.getTrips({ routeId: "1", includeRealtime: true })');

    console.log('\n7. getStopTimes({ includeRealtime: true })');
    console.log('   - Get stop times with realtime delays merged');
    console.log('   - Returns nested realtime object with delays');
    console.log('   - Example: gtfs.getStopTimes({ tripId: "trip_123", includeRealtime: true })');

    console.log('\n8. clearRealtimeData()');
    console.log('   - Clear all realtime data from database');

    // Demonstrate data structure
    console.log('\n\n📊 GTFS-RT Data Structures:');
    console.log('-----------------------------------');

    console.log('\nAlert structure:');
    console.log(`{
  id: string,
  active_period: [{ start?: number, end?: number }],
  informed_entity: [{ route_id?, stop_id?, trip?: {...} }],
  cause?: AlertCause (enum),
  effect?: AlertEffect (enum),
  header_text?: TranslatedString,
  description_text?: TranslatedString,
  rt_last_updated: number
}`);

    console.log('\nVehiclePosition structure:');
    console.log(`{
  trip_id: string,
  route_id?: string,
  vehicle?: { id?, label?, license_plate? },
  position?: { latitude, longitude, bearing?, speed? },
  current_stop_sequence?: number,
  stop_id?: string,
  current_status?: VehicleStopStatus,
  timestamp?: number,
  rt_last_updated: number
}`);

    console.log('\nTripWithRealtime structure:');
    console.log(`{
  ...Trip (all static trip fields),
  realtime?: {
    vehicle_position: VehiclePosition | null,
    trip_update: {
      delay?: number,
      schedule_relationship?: ScheduleRelationship
    } | null
  }
}`);

    console.log('\nStopTimeWithRealtime structure:');
    console.log(`{
  ...StopTime (all static stop time fields),
  realtime?: {
    arrival_delay?: number,
    departure_delay?: number,
    schedule_relationship?: ScheduleRelationship
  }
}`);

    // Test with empty RT data (no fetch)
    console.log('\n\n🧪 Testing RT Queries (no data yet):');
    console.log('-----------------------------------');

    const alerts = gtfs.getAlerts();
    console.log(`✓ getAlerts(): ${alerts.length} alerts (expected 0 without fetch)`);

    const vehiclePositions = gtfs.getVehiclePositions();
    console.log(`✓ getVehiclePositions(): ${vehiclePositions.length} positions (expected 0 without fetch)`);

    const tripsWithRT = gtfs.getTrips({ limit: 3, includeRealtime: true }) as any[];
    console.log(`✓ getTrips({ includeRealtime: true }): ${tripsWithRT.length} trips`);
    console.log(`  First trip realtime structure: ${JSON.stringify(tripsWithRT[0]?.realtime || {})}`);

    const stopTimesWithRT = gtfs.getStopTimes({ tripId: tripsWithRT[0]?.trip_id, limit: 3, includeRealtime: true }) as any[];
    console.log(`✓ getStopTimes({ includeRealtime: true }): ${stopTimesWithRT.length} stop times`);
    console.log(`  First stop time realtime structure: ${JSON.stringify(stopTimesWithRT[0]?.realtime || 'undefined')}`);

    // Show how to use in production
    console.log('\n\n📚 Production Usage Example:');
    console.log('-----------------------------------');
    console.log(`
// Initialize with RT feed URLs
const gtfs = await GtfsSqlJs.fromZip('gtfs.zip', {
  realtimeFeedUrls: ['https://pysae.com/api/v2/groups/car-jaune/gtfs-rt'],
  stalenessThreshold: 120
});

// Fetch RT data (call periodically, e.g., every 30 seconds)
await gtfs.fetchRealtimeData();

// Get active alerts
const alerts = gtfs.getAlerts({ activeOnly: true });
alerts.forEach(alert => {
  console.log(\`Alert: \${alert.header_text}\`);
  console.log(\`Affected routes: \${alert.informed_entity.filter(e => e.route_id).length}\`);
});

// Get trips with vehicle positions
const trips = gtfs.getTrips({
  routeId: '1',
  date: '20250105',
  includeRealtime: true
});

trips.forEach(trip => {
  if (trip.realtime?.vehicle_position?.position) {
    const pos = trip.realtime.vehicle_position.position;
    console.log(\`Trip \${trip.trip_id} at \${pos.latitude}, \${pos.longitude}\`);
  }
  if (trip.realtime?.trip_update?.delay) {
    console.log(\`  Delayed by \${trip.realtime.trip_update.delay} seconds\`);
  }
});

// Get stop times with realtime delays
const stopTimes = gtfs.getStopTimes({
  stopId: 'STOP_123',
  routeId: '1',
  date: '20250105',
  includeRealtime: true
});

stopTimes.forEach(st => {
  const delay = st.realtime?.arrival_delay || 0;
  console.log(\`\${st.arrival_time} (delay: \${delay}s)\`);
});
`);

    console.log('\n✅ GTFS-RT API test completed successfully!');
    console.log('\nNote: To test with real data, use the URLs:');
    console.log('  GTFS: https://pysae.com/api/v2/groups/car-jaune/gtfs/pub');
    console.log('  GTFS-RT: https://pysae.com/api/v2/groups/car-jaune/gtfs-rt');

    // Cleanup
    gtfs.close();

  } catch (error) {
    console.error('\n❌ Error during test:', error);
    if (error instanceof Error) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

testRealtimeLocal();
