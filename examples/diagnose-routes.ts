/**
 * Diagnostic script to check route combinations between Saint Joseph and Saint Denis
 */

import { GtfsSqlJs } from '../src/index';
import * as path from 'path';

async function main() {
  console.log('🔍 Diagnostic: Checking route combinations\n');

  const zipPath = path.join(__dirname, '..', 'website', 'public', 'car-jaune.zip');
  const gtfs = await GtfsSqlJs.fromZip(zipPath);

  const testDate = '20250310';
  const serviceIds = gtfs.getActiveServiceIds(testDate);
  console.log(`Active services on ${testDate}: ${serviceIds.length}\n`);

  const allStops = gtfs.getStops();
  const stJoseph = allStops.find(s => s.stop_name.toLowerCase().includes('gare st-joseph'));
  const stDenis = allStops.find(s => s.stop_name.toLowerCase().includes('gare de st-denis'));

  if (!stJoseph || !stDenis) {
    console.log('Could not find stops');
    gtfs.close();
    return;
  }

  console.log(`Origin: ${stJoseph.stop_name} (${stJoseph.stop_id})`);
  console.log(`Destination: ${stDenis.stop_name} (${stDenis.stop_id})\n`);

  // Check what routes serve each stop
  const db = gtfs.getDatabase();

  console.log('=== Routes serving Saint Joseph ===');
  const stjQuery = `
    SELECT DISTINCT r.route_id, r.route_short_name, r.route_long_name, t.direction_id
    FROM routes r
    JOIN trips t ON t.route_id = r.route_id
    JOIN stop_times st ON st.trip_id = t.trip_id
    WHERE st.stop_id = ?
      AND t.service_id IN (${serviceIds.map(() => '?').join(', ')})
  `;
  const stjStmt = db.prepare(stjQuery);
  stjStmt.bind([stJoseph.stop_id, ...serviceIds]);

  const stjRoutes: Array<{ id: string; name: string; dir: number }> = [];
  while (stjStmt.step()) {
    const row = stjStmt.getAsObject();
    stjRoutes.push({
      id: row.route_id as string,
      name: (row.route_short_name || row.route_long_name) as string,
      dir: (row.direction_id ?? 0) as number
    });
  }
  stjStmt.free();

  console.log(`Found ${stjRoutes.length} route-direction combinations:`);
  stjRoutes.forEach(r => console.log(`  - ${r.name} (${r.id}) direction ${r.dir}`));

  console.log('\n=== Routes serving Saint Denis ===');
  const stdQuery = `
    SELECT DISTINCT r.route_id, r.route_short_name, r.route_long_name, t.direction_id
    FROM routes r
    JOIN trips t ON t.route_id = r.route_id
    JOIN stop_times st ON st.trip_id = t.trip_id
    WHERE st.stop_id = ?
      AND t.service_id IN (${serviceIds.map(() => '?').join(', ')})
  `;
  const stdStmt = db.prepare(stdQuery);
  stdStmt.bind([stDenis.stop_id, ...serviceIds]);

  const stdRoutes: Array<{ id: string; name: string; dir: number }> = [];
  while (stdStmt.step()) {
    const row = stdStmt.getAsObject();
    stdRoutes.push({
      id: row.route_id as string,
      name: (row.route_short_name || row.route_long_name) as string,
      dir: (row.direction_id ?? 0) as number
    });
  }
  stdStmt.free();

  console.log(`Found ${stdRoutes.length} route-direction combinations:`);
  stdRoutes.forEach(r => console.log(`  - ${r.name} (${r.id}) direction ${r.dir}`));

  // Check for common transfer points
  console.log('\n=== Checking for potential transfer points ===');

  for (const stjRoute of stjRoutes.slice(0, 3)) {
    for (const stdRoute of stdRoutes.slice(0, 3)) {
      const connectionQuery = `
        SELECT DISTINCT s.stop_id, s.stop_name
        FROM stop_times st1
        JOIN trips t1 ON t1.trip_id = st1.trip_id
        JOIN stop_times st2 ON st2.stop_id = st1.stop_id
        JOIN trips t2 ON t2.trip_id = st2.trip_id
        JOIN stops s ON s.stop_id = st1.stop_id
        WHERE t1.route_id = ?
          AND t1.direction_id = ?
          AND t1.service_id IN (${serviceIds.map(() => '?').join(', ')})
          AND t2.route_id = ?
          AND t2.direction_id = ?
          AND t2.service_id IN (${serviceIds.map(() => '?').join(', ')})
        LIMIT 5
      `;

      const connStmt = db.prepare(connectionQuery);
      connStmt.bind([
        stjRoute.id,
        stjRoute.dir,
        ...serviceIds,
        stdRoute.id,
        stdRoute.dir,
        ...serviceIds
      ]);

      const connections: string[] = [];
      while (connStmt.step()) {
        const row = connStmt.getAsObject();
        connections.push(row.stop_name as string);
      }
      connStmt.free();

      if (connections.length > 0) {
        console.log(`\n${stjRoute.name} (dir ${stjRoute.dir}) → ${stdRoute.name} (dir ${stdRoute.dir})`);
        console.log(`  Connection points: ${connections.join(', ')}`);
      }
    }
  }

  gtfs.close();
  console.log('\n✓ Diagnostic complete');
}

main().catch(console.error);
