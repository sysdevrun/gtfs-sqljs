/**
 * Itinerary Computation Demo
 * Demonstrates finding itineraries between two stops that have direct connections
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
  console.log('🚌 GTFS Itinerary Computation Demo\n');

  const zipPath = path.join(__dirname, '..', 'website', 'public', 'car-jaune.zip');
  console.log('Loading Car Jaune GTFS data...');
  const gtfs = await GtfsSqlJs.fromZip(zipPath, {
    onProgress: (progress) => {
      if (progress.phase === 'complete') {
        console.log('✓ Data loaded!\n');
      }
    },
  });

  // Use a valid date (weekday in the service period)
  const testDate = '20250310'; // Monday, March 10, 2025
  console.log(`Using date: ${testDate}`);

  const serviceIds = gtfs.getActiveServiceIds(testDate);
  console.log(`Active services: ${serviceIds.length}\n`);

  if (serviceIds.length === 0) {
    console.log('❌ No active services for this date');
    gtfs.close();
    return;
  }

  // Find a route with multiple stops
  console.log('Finding a route with multiple stops...');
  const routes = gtfs.getRoutes({ limit: 10 });

  for (const route of routes) {
    const trips = gtfs.getTrips({ routeId: route.route_id, date: testDate, limit: 1 });
    if (trips.length === 0) continue;

    const stopTimes = gtfs.getStopTimes({ tripId: trips[0].trip_id });
    if (stopTimes.length < 5) continue; // Need at least 5 stops

    console.log(`\nUsing route: ${route.route_short_name || route.route_long_name} (${route.route_id})`);
    console.log(`Trip has ${stopTimes.length} stops`);

    // Get the first and a middle stop
    const originStopId = stopTimes[0].stop_id;
    const destStopId = stopTimes[Math.floor(stopTimes.length / 2)].stop_id;

    const originStop = gtfs.getStops({ stopId: originStopId })[0];
    const destStop = gtfs.getStops({ stopId: destStopId })[0];

    console.log(`\nOrigin: ${originStop.stop_name}`);
    console.log(`Destination: ${destStop.stop_name}`);

    // Find itineraries
    console.log(`\nSearching for itineraries departing after 08:00:00...\n`);

    const itineraries = gtfs.computeItineraries({
      fromStopId: originStopId,
      toStopId: destStopId,
      date: testDate,
      departureTimeAfter: '08:00:00',
      config: {
        maxTransfers: 3,
        minTransferTime: 300,
        maxResults: 5,
      },
    });

    if (itineraries.length === 0) {
      console.log('No itineraries found, trying next route...');
      continue;
    }

    console.log(`✓ Found ${itineraries.length} itinerary/ies:\n`);

    itineraries.forEach((itinerary, index) => {
      console.log(`${'='.repeat(60)}`);
      console.log(`Itinerary #${index + 1}`);
      console.log(`${'='.repeat(60)}`);
      console.log(`Departure: ${itinerary.departureTime}`);
      console.log(`Arrival:   ${itinerary.arrivalTime}`);
      console.log(`Duration:  ${formatDuration(itinerary.totalDuration)}`);
      console.log(`Transfers: ${itinerary.numberOfTransfers}`);

      console.log(`\nJourney Details:`);
      console.log(`${'-'.repeat(60)}`);

      itinerary.legs.forEach((leg, legIndex) => {
        const routeName = leg.route.route_short_name || leg.route.route_long_name;
        const headsign = leg.trip.trip_headsign ? ` → ${leg.trip.trip_headsign}` : '';

        console.log(`\nLeg ${legIndex + 1}: ${routeName}${headsign}`);
        console.log(`  Depart: ${leg.departureTime} from ${leg.fromStop.stop_name}`);
        console.log(`  Arrive: ${leg.arrivalTime} at ${leg.toStop.stop_name}`);
        console.log(`  Duration: ${formatDuration(leg.duration)}`);
        console.log(`  Stops: ${leg.stopTimes.length}`);

        if (legIndex < itinerary.legs.length - 1) {
          const transfer = itinerary.transfers[legIndex];
          console.log(`\n  ⏱️  Transfer at ${transfer.stop.stop_name}`);
          console.log(`     Wait time: ${formatDuration(transfer.waitTime)}`);
        }
      });

      console.log(`\n${'='.repeat(60)}\n`);
    });

    // Found working example, exit
    gtfs.close();
    console.log('✓ Done!');
    return;
  }

  console.log('\n❌ Could not find a suitable route for demonstration');
  gtfs.close();
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
