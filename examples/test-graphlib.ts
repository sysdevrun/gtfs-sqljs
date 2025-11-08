/**
 * Test graphlib-based itinerary computation
 * Saint Joseph → Saint Denis with transfers
 */

import { GtfsSqlJs } from '../src/index';
import { computeItinerariesGraphlib } from '../src/queries/itineraries-graphlib';
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
  console.log('🚀 Testing Graphlib-Based Itinerary Computation\n');
  console.log('Route: Saint Joseph → Saint Denis (with transfers)\n');

  const zipPath = path.join(__dirname, '..', 'website', 'public', 'car-jaune.zip');
  console.log('Loading GTFS data...');

  const gtfs = await GtfsSqlJs.fromZip(zipPath, {
    onProgress: (progress) => {
      if (progress.phase === 'complete') {
        console.log('✓ Data loaded!\n');
      }
    },
  });

  const testDate = '20250310'; // Monday, March 10, 2025
  console.log(`Date: ${testDate}`);

  const serviceIds = gtfs.getActiveServiceIds(testDate);
  console.log(`Active services: ${serviceIds.length}\n`);

  if (serviceIds.length === 0) {
    console.log('❌ No active services for this date');
    gtfs.close();
    return;
  }

  // Find stops
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

  console.log('Search parameters:');
  console.log('  - Departure after: 08:00:00');
  console.log('  - Departure before: 18:00:00');
  console.log('  - Min transfer time: 5 minutes');
  console.log('  - Max results: 10\n');

  console.log('Searching for itineraries...\n');

  const startTime = Date.now();

  const itineraries = computeItinerariesGraphlib(
    gtfs.getDatabase(),
    {
      fromStopId: stJoseph.stop_id,
      toStopId: stDenis.stop_id,
      date: testDate,
      departureTimeAfter: '08:00:00',
      departureTimeBefore: '18:00:00',
      config: {
        minTransferTime: 300,
        maxResults: 10,
      },
    }
  );

  const searchTime = Date.now() - startTime;
  console.log(`\n✓ Search completed in ${searchTime}ms\n`);

  if (itineraries.length === 0) {
    console.log('❌ No itineraries found\n');
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
  itineraries.slice(0, 3).forEach((itinerary, index) => {
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

  if (itineraries.length > 3) {
    console.log(`... and ${itineraries.length - 3} more itineraries\n`);
  }

  gtfs.close();
  console.log('✓ Test completed!');
}

main().catch((error) => {
  console.error('Error:', error);
  console.error(error.stack);
  process.exit(1);
});
