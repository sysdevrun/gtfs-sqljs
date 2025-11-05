/**
 * Test script for GTFS Realtime with Car Jaune data
 */

import { GtfsSqlJs } from './src/gtfs-sqljs';

async function testRealtime() {
  console.log('🚀 Testing GTFS-RT with Car Jaune data...\n');

  try {
    // Load GTFS static data
    console.log('📦 Loading GTFS static data...');
    const gtfs = await GtfsSqlJs.fromZip('https://pysae.com/api/v2/groups/car-jaune/gtfs/pub', {
      skipFiles: ['shapes.txt'],
      realtimeFeedUrls: ['https://pysae.com/api/v2/groups/car-jaune/gtfs-rt'],
      stalenessThreshold: 120
    });
    console.log('✅ GTFS static data loaded\n');

    // Show some basic GTFS info
    const agencies = gtfs.getAgencies();
    console.log(`📍 Agencies: ${agencies.length}`);
    agencies.forEach(agency => {
      console.log(`   - ${agency.agency_name}`);
    });

    const routes = gtfs.getRoutes();
    console.log(`🚌 Routes: ${routes.length}`);

    const stops = gtfs.getStops();
    console.log(`🛑 Stops: ${stops.length}\n`);

    // Fetch realtime data
    console.log('📡 Fetching GTFS-RT data from: https://pysae.com/api/v2/groups/car-jaune/gtfs-rt');
    await gtfs.fetchRealtimeData();
    console.log('✅ GTFS-RT data fetched\n');

    // Check alerts
    console.log('🚨 Checking alerts...');
    const allAlerts = gtfs.getAlerts();
    console.log(`   Total alerts: ${allAlerts.length}`);

    const activeAlerts = gtfs.getAlerts({ activeOnly: true });
    console.log(`   Active alerts: ${activeAlerts.length}`);

    if (activeAlerts.length > 0) {
      console.log('\n📋 Active Alert Details:');
      activeAlerts.forEach((alert, idx) => {
        console.log(`\n   Alert #${idx + 1} (ID: ${alert.id})`);

        if (alert.header_text) {
          const header = JSON.parse(alert.header_text as any);
          console.log(`   Header: ${header.translation[0]?.text || 'N/A'}`);
        }

        if (alert.description_text) {
          const desc = JSON.parse(alert.description_text as any);
          console.log(`   Description: ${desc.translation[0]?.text || 'N/A'}`);
        }

        console.log(`   Cause: ${alert.cause || 'N/A'}`);
        console.log(`   Effect: ${alert.effect || 'N/A'}`);

        if (alert.informed_entity && alert.informed_entity.length > 0) {
          console.log(`   Affected entities: ${alert.informed_entity.length}`);
          alert.informed_entity.slice(0, 3).forEach(entity => {
            if (entity.route_id) console.log(`     - Route: ${entity.route_id}`);
            if (entity.stop_id) console.log(`     - Stop: ${entity.stop_id}`);
            if (entity.trip?.trip_id) console.log(`     - Trip: ${entity.trip.trip_id}`);
          });
        }

        if (alert.active_period && alert.active_period.length > 0) {
          console.log(`   Active periods: ${alert.active_period.length}`);
          alert.active_period.slice(0, 2).forEach(period => {
            const start = period.start ? new Date(period.start * 1000).toISOString() : 'N/A';
            const end = period.end ? new Date(period.end * 1000).toISOString() : 'N/A';
            console.log(`     - ${start} to ${end}`);
          });
        }
      });
    }

    // Check vehicle positions
    console.log('\n\n🚗 Checking vehicle positions...');
    const vehiclePositions = gtfs.getVehiclePositions();
    console.log(`   Total vehicle positions: ${vehiclePositions.length}`);

    if (vehiclePositions.length > 0) {
      console.log('\n📍 Vehicle Position Details (first 5):');
      vehiclePositions.slice(0, 5).forEach((vp, idx) => {
        console.log(`\n   Vehicle #${idx + 1}`);
        console.log(`   Trip ID: ${vp.trip_id}`);
        console.log(`   Route ID: ${vp.route_id || 'N/A'}`);
        if (vp.vehicle?.id) console.log(`   Vehicle ID: ${vp.vehicle.id}`);
        if (vp.position) {
          console.log(`   Position: ${vp.position.latitude.toFixed(6)}, ${vp.position.longitude.toFixed(6)}`);
          if (vp.position.speed) console.log(`   Speed: ${vp.position.speed.toFixed(1)} m/s`);
          if (vp.position.bearing) console.log(`   Bearing: ${vp.position.bearing.toFixed(0)}°`);
        }
        if (vp.current_stop_sequence) console.log(`   Current stop sequence: ${vp.current_stop_sequence}`);
        if (vp.timestamp) console.log(`   Timestamp: ${new Date(vp.timestamp * 1000).toISOString()}`);
      });
    }

    // Check trip updates
    console.log('\n\n🕐 Checking trip updates...');
    // Get a sample trip with realtime data
    const tripsWithRT = gtfs.getTrips({ limit: 10, includeRealtime: true });
    console.log(`   Checked ${tripsWithRT.length} trips for realtime data`);

    const tripsWithData = tripsWithRT.filter((t: any) =>
      t.realtime?.vehicle_position !== null || t.realtime?.trip_update !== null
    );
    console.log(`   Trips with RT data: ${tripsWithData.length}`);

    if (tripsWithData.length > 0) {
      console.log('\n📊 Trip Realtime Details (first 3):');
      tripsWithData.slice(0, 3).forEach((trip: any, idx: number) => {
        console.log(`\n   Trip #${idx + 1} (ID: ${trip.trip_id})`);
        console.log(`   Route: ${trip.route_id}`);
        console.log(`   Headsign: ${trip.trip_headsign || 'N/A'}`);

        if (trip.realtime?.vehicle_position) {
          const vp = trip.realtime.vehicle_position;
          console.log(`   ✓ Has vehicle position`);
          if (vp.position) {
            console.log(`     Position: ${vp.position.latitude.toFixed(6)}, ${vp.position.longitude.toFixed(6)}`);
          }
        }

        if (trip.realtime?.trip_update) {
          const tu = trip.realtime.trip_update;
          console.log(`   ✓ Has trip update`);
          if (tu.delay !== undefined) {
            console.log(`     Delay: ${tu.delay} seconds`);
          }
        }
      });
    }

    // Check stop times with realtime
    console.log('\n\n⏰ Checking stop times with realtime...');
    if (tripsWithData.length > 0) {
      const sampleTrip = tripsWithData[0];
      const stopTimes = gtfs.getStopTimes({
        tripId: sampleTrip.trip_id,
        includeRealtime: true,
        limit: 5
      });

      console.log(`   Stop times for trip ${sampleTrip.trip_id}: ${stopTimes.length}`);

      const stopTimesWithRT = stopTimes.filter((st: any) => st.realtime);
      console.log(`   Stop times with RT data: ${stopTimesWithRT.length}`);

      if (stopTimesWithRT.length > 0) {
        console.log('\n   Stop Time RT Details:');
        stopTimesWithRT.slice(0, 3).forEach((st: any) => {
          const stop = gtfs.getStopById(st.stop_id);
          console.log(`\n     Stop: ${stop?.stop_name || st.stop_id}`);
          console.log(`     Scheduled arrival: ${st.arrival_time}`);
          if (st.realtime?.arrival_delay) {
            console.log(`     Arrival delay: ${st.realtime.arrival_delay} seconds`);
          }
          if (st.realtime?.departure_delay) {
            console.log(`     Departure delay: ${st.realtime.departure_delay} seconds`);
          }
          if (st.realtime?.schedule_relationship !== undefined) {
            console.log(`     Schedule relationship: ${st.realtime.schedule_relationship}`);
          }
        });
      }
    }

    console.log('\n\n✅ Test completed successfully!');

    // Cleanup
    gtfs.close();

  } catch (error) {
    console.error('\n❌ Error during test:', error);
    if (error instanceof Error) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

testRealtime();
