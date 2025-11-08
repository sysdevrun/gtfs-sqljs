/**
 * Itinerary Search Demo
 * Demonstrates the itinerary search functionality with Car Jaune GTFS data
 */

import { GtfsSqlJs } from './src/gtfs-sqljs';
import path from 'path';

async function main() {
  console.log('='.repeat(80));
  console.log('GTFS Itinerary Search Demo - Car Jaune GTFS');
  console.log('='.repeat(80));

  const zipPath = path.join(__dirname, 'website/public/car-jaune.zip');
  console.log('\nLoading GTFS data...');

  const gtfs = await GtfsSqlJs.fromZip(zipPath);
  console.log('Data loaded!\n');

  // Get parent stops (stops without parent_station)
  const allStops = gtfs.getStops();
  const parentStops = allStops.filter(s => !s.parent_station);
  console.log(`Total parent stops: ${parentStops.length}\n`);

  // Build graph for January 15, 2025
  const date = '20250115';
  console.log(`Building transit graph for ${date}...`);
  const graph = gtfs.buildItineraryGraph(date);
  console.log(`Graph built: ${graph.graph.nodeCount()} nodes, ${graph.graph.edgeCount()} edges\n`);

  // Test 5 different combinations
  const testCases = [
    { name: 'Case 1: Short trip', from: parentStops[0], to: parentStops[4], time: '08:00:00' },
    { name: 'Case 2: Mid-distance', from: parentStops[10], to: parentStops[20], time: '09:00:00' },
    { name: 'Case 3: Long trip', from: parentStops[0], to: parentStops[Math.floor(parentStops.length / 2)], time: '10:00:00' },
    { name: 'Case 4: Reverse trip', from: parentStops[Math.floor(parentStops.length / 2)], to: parentStops[0], time: '14:00:00' },
    { name: 'Case 5: Different pair', from: parentStops[30], to: parentStops[60], time: '16:00:00' }
  ];

  for (const testCase of testCases) {
    console.log('='.repeat(80));
    console.log(testCase.name);
    console.log('='.repeat(80));
    console.log(`From: ${testCase.from.stop_name} (${testCase.from.stop_id})`);
    console.log(`To: ${testCase.to.stop_name} (${testCase.to.stop_id})`);
    console.log(`Departure after: ${testCase.time}\n`);

    // Find path
    const path = gtfs.findItineraryPath(testCase.from.stop_id, testCase.to.stop_id, graph);

    if (!path) {
      console.log('❌ No path found (stops not connected)\n');
      continue;
    }

    console.log(`✓ Path found with ${path.segments.length} segment(s) and ${path.totalTransfers} transfer(s)\n`);

    console.log('Route segments:');
    path.segments.forEach((seg, idx) => {
      console.log(`  ${idx + 1}. Route ${seg.routeShortName || seg.routeId} (${seg.routeLongName || 'N/A'})`);
      console.log(`     From: ${seg.boardStopId} → To: ${seg.alightStopId}`);
    });
    console.log();

    // Find trips
    const itinerary = gtfs.findItineraryTrips(path, date, testCase.time, 3);

    if (itinerary.options.length === 0) {
      console.log('❌ No trips found for this path at the requested time\n');
      continue;
    }

    console.log(`✓ Found ${itinerary.options.length} departure option(s):\n`);

    itinerary.options.forEach((option, idx) => {
      console.log(`Option ${idx + 1}:`);
      console.log(`  Depart: ${option.departureTime} → Arrive: ${option.arrivalTime}`);
      console.log(`  Duration: ${Math.floor(option.totalDuration / 60)} minutes`);

      option.segments.forEach((seg, segIdx) => {
        console.log(`\n  Segment ${segIdx + 1}: ${seg.routeId} (Trip ${seg.tripId})`);
        console.log(`    Board at:  ${seg.boardStopName} (${seg.boardTime})`);

        if (seg.intermediateStops.length > 0) {
          console.log(`    Via: ${seg.intermediateStops.length} stop(s)`);
          seg.intermediateStops.slice(0, 3).forEach(stop => {
            console.log(`      - ${stop.stopName} (${stop.arrivalTime})`);
          });
          if (seg.intermediateStops.length > 3) {
            console.log(`      ... and ${seg.intermediateStops.length - 3} more`);
          }
        }

        console.log(`    Alight at: ${seg.alightStopName} (${seg.alightTime})`);
      });
      console.log();
    });
  }

  gtfs.close();
  console.log('='.repeat(80));
  console.log('Demo complete!');
  console.log('='.repeat(80));
}

main().catch(console.error);
