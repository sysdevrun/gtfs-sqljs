/**
 * Test multi-leg itineraries between Saint Joseph and Saint Denis
 * These two stops don't have a direct route, so transfers are required
 */

import { GtfsSqlJs } from '../src/index';
import * as path from 'path';

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

async function main() {
  console.log('🚌 Testing Multi-Leg Itineraries: Saint Joseph → Saint Denis\n');

  const zipPath = path.join(__dirname, '..', 'website', 'public', 'car-jaune.zip');
  console.log('Loading Car Jaune GTFS data...');

  const gtfs = await GtfsSqlJs.fromZip(zipPath, {
    onProgress: (progress) => {
      if (progress.phase === 'complete') {
        console.log('✓ Data loaded!\n');
      }
    },
  });

  // Use a valid weekday date
  const testDate = '20250310'; // Monday, March 10, 2025
  console.log(`Date: ${testDate}`);

  const serviceIds = gtfs.getActiveServiceIds(testDate);
  console.log(`Active services: ${serviceIds.length}\n`);

  if (serviceIds.length === 0) {
    console.log('❌ No active services for this date');
    gtfs.close();
    return;
  }

  // Find the stops
  const allStops = gtfs.getStops();

  const stJoseph = allStops.find(s =>
    s.stop_name.toLowerCase().includes('gare st-joseph') ||
    s.stop_name.toLowerCase().includes('gare saint-joseph')
  );

  const stDenis = allStops.find(s =>
    s.stop_name.toLowerCase().includes('gare de st-denis') ||
    s.stop_name.toLowerCase().includes('gare de saint-denis')
  );

  if (!stJoseph || !stDenis) {
    console.log('❌ Could not find both stops');
    gtfs.close();
    return;
  }

  console.log(`Origin: ${stJoseph.stop_name} (${stJoseph.stop_id})`);
  console.log(`Destination: ${stDenis.stop_name} (${stDenis.stop_id})\n`);

  // Search for itineraries with transfers
  console.log('Searching for itineraries (including transfers)...');
  console.log('Configuration:');
  console.log('  - Departure after: 08:00:00');
  console.log('  - Max transfers: 3');
  console.log('  - Min transfer time: 5 minutes');
  console.log('  - Max results: 10\n');

  const startTime = Date.now();

  const itineraries = gtfs.computeItineraries({
    fromStopId: stJoseph.stop_id,
    toStopId: stDenis.stop_id,
    date: testDate,
    departureTimeAfter: '08:00:00',
    departureTimeBefore: '18:00:00',
    config: {
      maxTransfers: 3,
      minTransferTime: 300, // 5 minutes
      maxResults: 10,
      maxSearchDepth: 15, // Increased for multi-leg journeys
    },
  });

  const searchTime = Date.now() - startTime;
  console.log(`Search completed in ${searchTime}ms\n`);

  if (itineraries.length === 0) {
    console.log('❌ No itineraries found');
    console.log('\nThis might be because:');
    console.log('  - There are no connecting routes on this date');
    console.log('  - The required transfers exceed the maximum allowed');
    console.log('  - The time constraints are too restrictive\n');

    // Debug: Check what routes serve each stop
    console.log('Debug information:');
    const db = gtfs.getDatabase();

    const stJosephTrips = gtfs.getStopTimes({ stopId: stJoseph.stop_id, date: testDate, limit: 5 });
    console.log(`\nTrips serving Saint Joseph (${stJosephTrips.length} found):`);
    stJosephTrips.slice(0, 3).forEach(st => {
      const trip = gtfs.getTrips({ tripId: st.trip_id })[0];
      if (trip) {
        const route = gtfs.getRoutes({ routeId: trip.route_id })[0];
        console.log(`  - ${route.route_short_name || route.route_long_name} at ${st.departure_time}`);
      }
    });

    const stDenisTrips = gtfs.getStopTimes({ stopId: stDenis.stop_id, date: testDate, limit: 5 });
    console.log(`\nTrips serving Saint Denis (${stDenisTrips.length} found):`);
    stDenisTrips.slice(0, 3).forEach(st => {
      const trip = gtfs.getTrips({ tripId: st.trip_id })[0];
      if (trip) {
        const route = gtfs.getRoutes({ routeId: trip.route_id })[0];
        console.log(`  - ${route.route_short_name || route.route_long_name} at ${st.arrival_time}`);
      }
    });

    gtfs.close();
    return;
  }

  console.log(`✓ Found ${itineraries.length} itinerary/ies:\n`);

  // Display summary
  console.log('Summary:');
  itineraries.forEach((itinerary, index) => {
    const transfersText = itinerary.numberOfTransfers === 0
      ? 'direct'
      : `${itinerary.numberOfTransfers} transfer${itinerary.numberOfTransfers > 1 ? 's' : ''}`;

    console.log(`  ${index + 1}. ${itinerary.departureTime} → ${itinerary.arrivalTime} (${formatDuration(itinerary.totalDuration)}, ${transfersText})`);
  });
  console.log();

  // Display detailed itineraries
  itineraries.forEach((itinerary, index) => {
    console.log(`${'='.repeat(70)}`);
    console.log(`Itinerary #${index + 1}`);
    console.log(`${'='.repeat(70)}`);
    console.log(`Departure: ${itinerary.departureTime}`);
    console.log(`Arrival:   ${itinerary.arrivalTime}`);
    console.log(`Total Duration: ${formatDuration(itinerary.totalDuration)}`);
    console.log(`Transfers: ${itinerary.numberOfTransfers}`);

    if (itinerary.numberOfTransfers > 0) {
      console.log(`In-vehicle time: ${formatDuration(itinerary.inVehicleTime)}`);
      console.log(`Waiting time:    ${formatDuration(itinerary.waitingTime)}`);
    }

    console.log(`\nJourney Details:`);
    console.log(`${'-'.repeat(70)}`);

    itinerary.legs.forEach((leg, legIndex) => {
      const routeName = leg.route.route_short_name || leg.route.route_long_name;
      const headsign = leg.trip.trip_headsign ? ` → ${leg.trip.trip_headsign}` : '';

      console.log(`\nLeg ${legIndex + 1}: ${routeName}${headsign}`);
      console.log(`  From: ${leg.fromStop.stop_name}`);
      console.log(`  To:   ${leg.toStop.stop_name}`);
      console.log(`  Depart: ${leg.departureTime}`);
      console.log(`  Arrive: ${leg.arrivalTime}`);
      console.log(`  Duration: ${formatDuration(leg.duration)}`);
      console.log(`  Stops: ${leg.stopTimes.length}`);

      // Show transfer if not last leg
      if (legIndex < itinerary.legs.length - 1) {
        const transfer = itinerary.transfers[legIndex];
        console.log(`\n  🔄 Transfer at ${transfer.stop.stop_name}`);
        console.log(`     Arrive: ${transfer.arrivalTime}`);
        console.log(`     Depart: ${transfer.departureTime}`);
        console.log(`     Wait time: ${formatDuration(transfer.waitTime)}`);
      }
    });

    console.log(`\n${'='.repeat(70)}\n`);
  });

  gtfs.close();
  console.log('✓ Test completed!');
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
