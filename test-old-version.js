/**
 * Test OLD version (before optimizations)
 */

const { GtfsSqlJs } = require('./dist/index.js');

async function testOldVersion() {
  console.log('\n🐌 Testing OLD VERSION (before optimizations)...\n');

  const startTime = Date.now();

  const gtfs = await GtfsSqlJs.fromZip('/tmp/irigo-gtfs.zip');

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  // Get stats
  const stops = gtfs.getStops();
  const routes = gtfs.getRoutes();
  const trips = gtfs.getTrips();
  const stopTimes = gtfs.getStopTimes();

  console.log(`\n❌ OLD Version Load Complete!`);
  console.log(`   Time: ${duration}s`);
  console.log(`   Data loaded:`);
  console.log(`     - ${stops.length} stops`);
  console.log(`     - ${routes.length} routes`);
  console.log(`     - ${trips.length} trips`);
  console.log(`     - ${stopTimes.length} stop times`);

  gtfs.close();

  return parseFloat(duration);
}

testOldVersion().then((duration) => {
  console.log('\n✅ Test complete!');
  console.log(`\n   OLD VERSION: ${duration}s`);
  console.log(`   (Compare to NEW VERSION: ~5.76s)`);
  console.log(`   Expected speedup: ~100-200x\n`);
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});
