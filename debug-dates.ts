/**
 * Debug script to find valid service dates in the Car Jaune GTFS
 */

import { GtfsSqlJs } from './src/gtfs-sqljs';
import path from 'path';

async function main() {
  const zipPath = path.join(__dirname, 'website/public/car-jaune.zip');
  console.log('Loading GTFS data...');

  const gtfs = await GtfsSqlJs.fromZip(zipPath);
  console.log('Data loaded!\n');

  // Check calendar entries
  const db = gtfs.getDatabase();
  const stmt = db.prepare('SELECT * FROM calendar LIMIT 10');

  console.log('=== CALENDAR ENTRIES ===');
  while (stmt.step()) {
    const row = stmt.getAsObject();
    console.log(JSON.stringify(row, null, 2));
  }
  stmt.free();

  // Check some actual dates
  const testDates = [
    '20240101',
    '20240115',
    '20250101',
    '20250115',
    '20241201',
    '20230101'
  ];

  console.log('\n=== CHECKING DATES ===');
  for (const date of testDates) {
    const serviceIds = gtfs.getActiveServiceIds(date);
    console.log(`${date}: ${serviceIds.length} active services`);
    if (serviceIds.length > 0) {
      console.log(`  Service IDs: ${serviceIds.join(', ')}`);
    }
  }

  // Find a date with services
  console.log('\n=== FINDING VALID DATE ===');
  const calendarStmt = db.prepare('SELECT start_date, end_date FROM calendar LIMIT 1');
  if (calendarStmt.step()) {
    const row = calendarStmt.getAsObject() as { start_date: string; end_date: string };
    console.log(`Calendar range: ${row.start_date} to ${row.end_date}`);

    // Try a date in the middle of the range
    const startDate = new Date(
      parseInt(row.start_date.substring(0, 4)),
      parseInt(row.start_date.substring(4, 6)) - 1,
      parseInt(row.start_date.substring(6, 8))
    );
    const endDate = new Date(
      parseInt(row.end_date.substring(0, 4)),
      parseInt(row.end_date.substring(4, 6)) - 1,
      parseInt(row.end_date.substring(6, 8))
    );
    const midDate = new Date((startDate.getTime() + endDate.getTime()) / 2);
    const midDateStr = midDate.toISOString().split('T')[0].replace(/-/g, '');

    console.log(`Trying middle date: ${midDateStr}`);
    const serviceIds = gtfs.getActiveServiceIds(midDateStr);
    console.log(`Services on ${midDateStr}: ${serviceIds.length}`);
  }
  calendarStmt.free();

  // Get all stops
  console.log('\n=== STOPS SAMPLE ===');
  const stops = gtfs.getStops({ limit: 10 });
  stops.forEach(stop => {
    console.log(`${stop.stop_id}: ${stop.stop_name} (parent: ${stop.parent_station || 'none'})`);
  });

  // Get parent stops only
  console.log('\n=== PARENT STOPS (for graph) ===');
  const allStops = gtfs.getStops();
  const parentStops = allStops.filter(s => !s.parent_station);
  console.log(`Total parent stops: ${parentStops.length}`);
  parentStops.slice(0, 20).forEach(stop => {
    console.log(`${stop.stop_id}: ${stop.stop_name}`);
  });

  // Get all routes
  console.log('\n=== ROUTES ===');
  const routes = gtfs.getRoutes();
  routes.forEach(route => {
    console.log(`${route.route_id}: ${route.route_short_name} - ${route.route_long_name}`);
  });

  gtfs.close();
}

main().catch(console.error);
