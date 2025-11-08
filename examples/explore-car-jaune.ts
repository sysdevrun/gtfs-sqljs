/**
 * Explore Car Jaune data to find valid dates and routes
 */

import { GtfsSqlJs } from '../src/index';
import * as path from 'path';

async function main() {
  console.log('Loading Car Jaune GTFS data...\n');

  const zipPath = path.join(__dirname, '..', 'website', 'public', 'car-jaune.zip');
  const gtfs = await GtfsSqlJs.fromZip(zipPath);

  console.log('=== Calendar Info ===');
  const db = gtfs.getDatabase();

  // Check calendar table for date ranges
  const calendarStmt = db.prepare('SELECT * FROM calendar LIMIT 5');
  console.log('\nCalendar entries:');
  while (calendarStmt.step()) {
    const row = calendarStmt.getAsObject();
    console.log(`Service ${row.service_id}: ${row.start_date} to ${row.end_date}`);
    console.log(`  Days: M:${row.monday} T:${row.tuesday} W:${row.wednesday} Th:${row.thursday} F:${row.friday} Sa:${row.saturday} Su:${row.sunday}`);
  }
  calendarStmt.free();

  // Check for a recent weekday
  const testDate = '20240115'; // Monday, January 15, 2024
  console.log(`\n=== Testing date: ${testDate} ===`);

  const serviceIds = gtfs.getActiveServiceIds(testDate);
  console.log(`Active services: ${serviceIds.length}`);
  if (serviceIds.length > 0) {
    console.log(`Service IDs: ${serviceIds.join(', ')}`);
  }

  // Find stops
  console.log('\n=== Finding Stops ===');
  const allStops = gtfs.getStops();
  const gareStops = allStops.filter(s => s.stop_name.toLowerCase().includes('gare'));

  console.log(`Stops with "gare" in name (${gareStops.length}):`);
  gareStops.forEach(stop => {
    console.log(`  - ${stop.stop_name} (${stop.stop_id})`);
  });

  // Find the two specific stops
  const stJoseph = allStops.find(s =>
    s.stop_name.toLowerCase().includes('gare st-joseph') ||
    s.stop_name.toLowerCase().includes('gare saint-joseph')
  );

  const stDenis = allStops.find(s =>
    s.stop_name.toLowerCase().includes('gare de st-denis') ||
    s.stop_name.toLowerCase().includes('gare de saint-denis')
  );

  if (!stJoseph || !stDenis) {
    console.log('\n❌ Could not find both stops');
    gtfs.close();
    return;
  }

  console.log(`\nOrigin: ${stJoseph.stop_name} (${stJoseph.stop_id})`);
  console.log(`Destination: ${stDenis.stop_name} (${stDenis.stop_id})`);

  // Find routes serving these stops
  console.log('\n=== Routes serving these stops ===');

  const stopTimesStJoseph = gtfs.getStopTimes({ stopId: stJoseph.stop_id, limit: 10 });
  const routeIdsStJoseph = new Set(stopTimesStJoseph.map(st => {
    const trips = gtfs.getTrips({ tripId: st.trip_id });
    return trips.length > 0 ? trips[0].route_id : null;
  }).filter(Boolean));

  const stopTimesStDenis = gtfs.getStopTimes({ stopId: stDenis.stop_id, limit: 10 });
  const routeIdsStDenis = new Set(stopTimesStDenis.map(st => {
    const trips = gtfs.getTrips({ tripId: st.trip_id });
    return trips.length > 0 ? trips[0].route_id : null;
  }).filter(Boolean));

  console.log(`Routes serving St-Joseph: ${Array.from(routeIdsStJoseph).join(', ')}`);
  console.log(`Routes serving St-Denis: ${Array.from(routeIdsStDenis).join(', ')}`);

  // Find common routes
  const commonRoutes = Array.from(routeIdsStJoseph).filter(r => routeIdsStDenis.has(r));
  console.log(`\nCommon routes: ${commonRoutes.length ? commonRoutes.join(', ') : 'None'}`);

  if (commonRoutes.length > 0) {
    console.log('\n=== Testing itinerary search ===');

    const itineraries = gtfs.computeItineraries({
      fromStopId: stJoseph.stop_id,
      toStopId: stDenis.stop_id,
      date: testDate,
      departureTimeAfter: '06:00:00',
      departureTimeBefore: '22:00:00',
      config: {
        maxTransfers: 3,
        minTransferTime: 300,
        maxResults: 5,
      },
    });

    console.log(`Found ${itineraries.length} itineraries`);

    if (itineraries.length > 0) {
      const first = itineraries[0];
      console.log(`\nFirst itinerary:`);
      console.log(`  Departure: ${first.departureTime}`);
      console.log(`  Arrival: ${first.arrivalTime}`);
      console.log(`  Transfers: ${first.numberOfTransfers}`);
      first.legs.forEach((leg, i) => {
        console.log(`  Leg ${i + 1}: ${leg.route.route_short_name || leg.route.route_long_name}`);
      });
    }
  }

  gtfs.close();
  console.log('\n✓ Done!');
}

main().catch(console.error);
