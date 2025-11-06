/**
 * Test script to verify skipFiles option works correctly
 */

import { GtfsSqlJs } from './src/gtfs-sqljs';
import initSqlJs from 'sql.js';
import JSZip from 'jszip';
import fs from 'fs';

async function testSkipShapes() {
  console.log('Testing skipFiles functionality...\n');

  // Create a minimal GTFS ZIP with shapes.txt
  const zip = new JSZip();

  // Add required files
  zip.file('agency.txt', 'agency_id,agency_name,agency_url,agency_timezone\nAGENCY1,Test Agency,http://test.com,America/New_York');
  zip.file('stops.txt', 'stop_id,stop_name,stop_lat,stop_lon\nSTOP1,Test Stop,40.7,-74.0');
  zip.file('routes.txt', 'route_id,route_short_name,route_long_name,route_type\nROUTE1,1,Test Route,3');
  zip.file('trips.txt', 'trip_id,route_id,service_id,shape_id\nTRIP1,ROUTE1,SVC1,SHAPE1');
  zip.file('stop_times.txt', 'trip_id,arrival_time,departure_time,stop_id,stop_sequence\nTRIP1,08:00:00,08:00:00,STOP1,1');
  zip.file('calendar.txt', 'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\nSVC1,1,1,1,1,1,0,0,20240101,20241231');

  // Add shapes.txt with data
  const shapesData = `shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence
SHAPE1,40.7,-74.0,1
SHAPE1,40.71,-74.01,2
SHAPE1,40.72,-74.02,3
SHAPE1,40.73,-74.03,4
SHAPE1,40.74,-74.04,5`;
  zip.file('shapes.txt', shapesData);

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
  const testZipPath = '/tmp/test-gtfs-skip-shapes.zip';
  fs.writeFileSync(testZipPath, zipBuffer);

  console.log('Created test GTFS ZIP with shapes.txt containing 5 rows\n');

  // Test 1: Load WITHOUT skipFiles (shapes should be loaded)
  console.log('Test 1: Loading WITHOUT skipFiles...');
  const SQL = await initSqlJs();
  const gtfsWithShapes = await GtfsSqlJs.fromZip(testZipPath, { SQL });
  const db1 = gtfsWithShapes.getDatabase();

  // Check if shapes table exists
  const tableCheck1 = db1.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='shapes'");
  console.log(`  Shapes table exists: ${tableCheck1.length > 0}`);

  // Check if shapes table has data
  const countResult1 = db1.exec('SELECT COUNT(*) as count FROM shapes');
  const count1 = countResult1[0]?.values[0][0] || 0;
  console.log(`  Shapes table row count: ${count1}`);
  console.log(`  Expected: 5 rows\n`);

  gtfsWithShapes.close();

  // Test 2: Load WITH skipFiles (shapes should NOT be loaded)
  console.log('Test 2: Loading WITH skipFiles: [\'shapes.txt\']...');
  const gtfsSkipShapes = await GtfsSqlJs.fromZip(testZipPath, {
    SQL,
    skipFiles: ['shapes.txt']
  });
  const db2 = gtfsSkipShapes.getDatabase();

  // Check if shapes table exists
  const tableCheck2 = db2.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='shapes'");
  console.log(`  Shapes table exists: ${tableCheck2.length > 0}`);

  // Check if shapes table has data
  const countResult2 = db2.exec('SELECT COUNT(*) as count FROM shapes');
  const count2 = countResult2[0]?.values[0][0] || 0;
  console.log(`  Shapes table row count: ${count2}`);
  console.log(`  Expected: 0 rows (table created but empty)\n`);

  gtfsSkipShapes.close();

  // Summary
  console.log('=== RESULTS ===');
  if (count1 === 5) {
    console.log('✓ Test 1 PASSED: Shapes were loaded without skipFiles');
  } else {
    console.log(`✗ Test 1 FAILED: Expected 5 shapes, got ${count1}`);
  }

  if (count2 === 0 && tableCheck2.length > 0) {
    console.log('✓ Test 2 PASSED: Shapes table exists but is empty with skipFiles');
  } else {
    console.log(`✗ Test 2 FAILED: Expected 0 shapes (empty table), got ${count2}`);
  }

  // Cleanup
  fs.unlinkSync(testZipPath);
}

testSkipShapes().catch(console.error);
