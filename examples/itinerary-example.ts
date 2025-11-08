/**
 * Itinerary Computation Example for gtfs-sqljs
 *
 * This example demonstrates how to compute itineraries between two stops
 * using the Car Jaune GTFS feed from Réunion Island.
 */

import { GtfsSqlJs } from '../src/index';
import * as path from 'path';

/**
 * Format duration in seconds to human-readable format
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Get today's date in YYYYMMDD format
 */
function getTodayDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

async function main() {
  console.log('🚌 GTFS Itinerary Computation Example\n');
  console.log('Loading Car Jaune GTFS data from Réunion Island...');

  // Load GTFS data from the car-jaune.zip file
  const zipPath = path.join(__dirname, '..', 'website', 'public', 'car-jaune.zip');
  const gtfs = await GtfsSqlJs.fromZip(zipPath, {
    onProgress: (progress) => {
      if (progress.phase === 'complete') {
        console.log('✓ GTFS data loaded successfully!\n');
      }
    },
  });

  // Find stops by name
  console.log('=== Finding Stops ===');
  const allStops = gtfs.getStops();
  console.log(`Total stops in feed: ${allStops.length}`);

  const originStop = allStops.find(s =>
    s.stop_name.toLowerCase().includes('gare st-joseph') ||
    s.stop_name.toLowerCase().includes('gare saint-joseph')
  );

  const destinationStop = allStops.find(s =>
    s.stop_name.toLowerCase().includes('gare de st-denis') ||
    s.stop_name.toLowerCase().includes('gare de saint-denis')
  );

  if (!originStop || !destinationStop) {
    console.log('\nSearching for stops with "gare" in name:');
    const gareStops = allStops.filter(s => s.stop_name.toLowerCase().includes('gare'));
    gareStops.forEach(stop => {
      console.log(`  - ${stop.stop_name} (${stop.stop_id})`);
    });

    if (!originStop) {
      console.error('\n❌ Could not find origin stop "Gare St-Joseph"');
    }
    if (!destinationStop) {
      console.error('❌ Could not find destination stop "Gare De St-Denis"');
    }

    gtfs.close();
    return;
  }

  console.log(`\nOrigin: ${originStop.stop_name} (${originStop.stop_id})`);
  console.log(`Destination: ${destinationStop.stop_name} (${destinationStop.stop_id})\n`);

  // Compute itineraries
  console.log('=== Computing Itineraries ===');
  const today = getTodayDate();
  const departureTime = '08:00:00';

  console.log(`Date: ${today}`);
  console.log(`Departure after: ${departureTime}`);
  console.log(`Maximum transfers: 3`);
  console.log(`Minimum transfer time: 5 minutes\n`);

  console.log('Searching for itineraries...\n');

  const itineraries = gtfs.computeItineraries({
    fromStopId: originStop.stop_id,
    toStopId: destinationStop.stop_id,
    date: today,
    departureTimeAfter: departureTime,
    config: {
      maxTransfers: 3,
      minTransferTime: 300, // 5 minutes
      maxResults: 5,
      maxSearchDepth: 10,
    },
  });

  if (itineraries.length === 0) {
    console.log('❌ No itineraries found for this date and time.');
    console.log('\nTrying with a wider time window (next 6 hours)...');

    const itinerariesWide = gtfs.computeItineraries({
      fromStopId: originStop.stop_id,
      toStopId: destinationStop.stop_id,
      date: today,
      departureTimeAfter: departureTime,
      departureTimeBefore: '14:00:00',
      config: {
        maxTransfers: 3,
        minTransferTime: 300,
        maxResults: 5,
      },
    });

    if (itinerariesWide.length === 0) {
      console.log('❌ Still no itineraries found. The route might not be served on this date.');

      // Show active services for debugging
      const serviceIds = gtfs.getActiveServiceIds(today);
      console.log(`\nActive services for ${today}: ${serviceIds.length}`);
      if (serviceIds.length === 0) {
        console.log('⚠️  No active services found for this date!');
      }

      gtfs.close();
      return;
    }

    console.log(`\n✓ Found ${itinerariesWide.length} itinerary/ies:\n`);
    displayItineraries(itinerariesWide);
  } else {
    console.log(`✓ Found ${itineraries.length} itinerary/ies:\n`);
    displayItineraries(itineraries);
  }

  // Clean up
  gtfs.close();
  console.log('\n✓ Done!');
}

/**
 * Display itineraries in a user-friendly format
 */
function displayItineraries(itineraries: any[]): void {
  itineraries.forEach((itinerary, index) => {
    console.log(`${'='.repeat(60)}`);
    console.log(`Itinerary #${index + 1}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Departure: ${itinerary.departureTime}`);
    console.log(`Arrival:   ${itinerary.arrivalTime}`);
    console.log(`Duration:  ${formatDuration(itinerary.totalDuration)}`);
    console.log(`Transfers: ${itinerary.numberOfTransfers}`);

    if (itinerary.numberOfTransfers > 0) {
      console.log(`In-vehicle time: ${formatDuration(itinerary.inVehicleTime)}`);
      console.log(`Waiting time:    ${formatDuration(itinerary.waitingTime)}`);
    }

    console.log(`\nJourney Details:`);
    console.log(`${'-'.repeat(60)}`);

    itinerary.legs.forEach((leg: any, legIndex: number) => {
      const routeName = leg.route.route_short_name || leg.route.route_long_name;
      const headsign = leg.trip.trip_headsign ? ` → ${leg.trip.trip_headsign}` : '';

      console.log(`\nLeg ${legIndex + 1}: ${routeName}${headsign}`);
      console.log(`  Depart: ${leg.departureTime} from ${leg.fromStop.stop_name}`);
      console.log(`  Arrive: ${leg.arrivalTime} at ${leg.toStop.stop_name}`);
      console.log(`  Duration: ${formatDuration(leg.duration)}`);
      console.log(`  Stops: ${leg.stopTimes.length}`);

      // Show transfer if not last leg
      if (legIndex < itinerary.legs.length - 1) {
        const transfer = itinerary.transfers[legIndex];
        console.log(`\n  ⏱️  Transfer at ${transfer.stop.stop_name}`);
        console.log(`     Wait time: ${formatDuration(transfer.waitTime)}`);
      }
    });

    console.log(`\n${'='.repeat(60)}\n`);
  });
}

// Run the example
main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
