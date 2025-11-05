/**
 * Test script for GTFS Realtime with local Car Jaune RT file
 */

import { GtfsSqlJs } from './src/gtfs-sqljs';

async function testRealtimeLocalFile() {
  console.log('🚀 Testing GTFS-RT with local Car Jaune RT file...\n');

  try {
    // Load GTFS static data from local file
    console.log('📦 Loading GTFS static data from local file...');
    const gtfs = await GtfsSqlJs.fromZip('./website/public/car-jaune.zip', {
      skipFiles: ['shapes.txt'],
      stalenessThreshold: 120
    });
    console.log('✅ GTFS static data loaded\n');

    // Show some basic GTFS info
    const agencies = gtfs.getAgencies();
    console.log(`📍 Agencies: ${agencies.length}`);
    agencies.forEach(agency => {
      console.log(`   - ${agency.agency_name} (${agency.agency_id})`);
    });

    const routes = gtfs.getRoutes({ limit: 5 });
    console.log(`\n🚌 Routes: ${gtfs.getRoutes().length} total (showing first 5):`);
    routes.forEach(route => {
      console.log(`   - ${route.route_short_name}: ${route.route_long_name}`);
    });

    // Load realtime data from local file
    console.log('\n\n📡 Loading GTFS-RT data from local file: ./car-jaune-rt.pb');
    await gtfs.fetchRealtimeData(['./car-jaune-rt.pb']);
    console.log('✅ GTFS-RT data loaded\n');

    // Check alerts
    console.log('🚨 Checking alerts...');
    const allAlerts = gtfs.getAlerts();
    console.log(`   Total alerts: ${allAlerts.length}`);

    const activeAlerts = gtfs.getAlerts({ activeOnly: true });
    console.log(`   Active alerts: ${activeAlerts.length}`);

    if (allAlerts.length > 0) {
      console.log('\n📋 Alert Details:');
      allAlerts.forEach((alert, idx) => {
        console.log(`\n   Alert #${idx + 1} (ID: ${alert.id})`);

        if (alert.header_text) {
          try {
            const header = typeof alert.header_text === 'string'
              ? JSON.parse(alert.header_text)
              : alert.header_text;
            console.log(`   Header: ${header.translation[0]?.text || 'N/A'}`);
          } catch (e) {
            console.log(`   Header: [Unable to parse]`);
          }
        }

        if (alert.description_text) {
          try {
            const desc = typeof alert.description_text === 'string'
              ? JSON.parse(alert.description_text)
              : alert.description_text;
            const text = desc.translation[0]?.text || 'N/A';
            // Truncate long descriptions
            const truncated = text.length > 150 ? text.substring(0, 150) + '...' : text;
            console.log(`   Description: ${truncated}`);
          } catch (e) {
            console.log(`   Description: [Unable to parse]`);
          }
        }

        console.log(`   Cause: ${alert.cause || 'N/A'}`);
        console.log(`   Effect: ${alert.effect || 'N/A'}`);

        if (alert.informed_entity && alert.informed_entity.length > 0) {
          console.log(`   Affected entities: ${alert.informed_entity.length}`);
          const routes = alert.informed_entity.filter(e => e.route_id).slice(0, 5);
          if (routes.length > 0) {
            console.log(`     Routes: ${routes.map(e => e.route_id).join(', ')}${alert.informed_entity.filter(e => e.route_id).length > 5 ? ' ...' : ''}`);
          }
          const stops = alert.informed_entity.filter(e => e.stop_id).slice(0, 5);
          if (stops.length > 0) {
            console.log(`     Stops: ${stops.map(e => e.stop_id).join(', ')}${alert.informed_entity.filter(e => e.stop_id).length > 5 ? ' ...' : ''}`);
          }
        }

        if (alert.active_period && alert.active_period.length > 0) {
          console.log(`   Active periods: ${alert.active_period.length}`);
          alert.active_period.slice(0, 2).forEach(period => {
            const start = period.start ? new Date(period.start * 1000).toISOString() : 'N/A';
            const end = period.end ? new Date(period.end * 1000).toISOString() : 'N/A';
            console.log(`     - ${start} to ${end}`);
          });
        }

        console.log(`   Last updated: ${new Date(alert.rt_last_updated * 1000).toISOString()}`);
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
        if (vp.vehicle?.label) console.log(`   Vehicle Label: ${vp.vehicle.label}`);
        if (vp.position) {
          console.log(`   Position: ${vp.position.latitude.toFixed(6)}, ${vp.position.longitude.toFixed(6)}`);
          if (vp.position.speed !== undefined) console.log(`   Speed: ${vp.position.speed.toFixed(1)} m/s`);
          if (vp.position.bearing !== undefined) console.log(`   Bearing: ${vp.position.bearing.toFixed(0)}°`);
        }
        if (vp.current_stop_sequence) console.log(`   Current stop sequence: ${vp.current_stop_sequence}`);
        if (vp.stop_id) console.log(`   Stop ID: ${vp.stop_id}`);
        if (vp.timestamp) console.log(`   Timestamp: ${new Date(vp.timestamp * 1000).toISOString()}`);
        console.log(`   Last updated: ${new Date(vp.rt_last_updated * 1000).toISOString()}`);
      });
    }

    // Check trips with realtime data
    console.log('\n\n🕐 Checking trips with realtime data...');
    const tripsWithRT = gtfs.getTrips({ limit: 20, includeRealtime: true });
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
          if (vp.vehicle?.id) {
            console.log(`     Vehicle ID: ${vp.vehicle.id}`);
          }
        }

        if (trip.realtime?.trip_update) {
          const tu = trip.realtime.trip_update;
          console.log(`   ✓ Has trip update`);
          if (tu.delay !== undefined) {
            console.log(`     Delay: ${tu.delay} seconds`);
          }
          if (tu.schedule_relationship !== undefined) {
            console.log(`     Schedule relationship: ${tu.schedule_relationship}`);
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
        limit: 10
      });

      console.log(`   Stop times for trip ${sampleTrip.trip_id}: ${stopTimes.length}`);

      const stopTimesWithRT = stopTimes.filter((st: any) => st.realtime);
      console.log(`   Stop times with RT data: ${stopTimesWithRT.length}`);

      if (stopTimesWithRT.length > 0) {
        console.log('\n   Stop Time RT Details (first 5):');
        stopTimesWithRT.slice(0, 5).forEach((st: any) => {
          const stop = gtfs.getStopById(st.stop_id);
          console.log(`\n     Stop: ${stop?.stop_name || st.stop_id}`);
          console.log(`     Sequence: ${st.stop_sequence}`);
          console.log(`     Scheduled arrival: ${st.arrival_time}`);
          if (st.realtime?.arrival_delay !== undefined) {
            console.log(`     Arrival delay: ${st.realtime.arrival_delay} seconds`);
          }
          if (st.realtime?.departure_delay !== undefined) {
            console.log(`     Departure delay: ${st.realtime.departure_delay} seconds`);
          }
          if (st.realtime?.schedule_relationship !== undefined) {
            console.log(`     Schedule relationship: ${st.realtime.schedule_relationship}`);
          }
        });
      }
    }

    console.log('\n\n✅ Test completed successfully!');
    console.log('\nSummary:');
    console.log(`  - Alerts: ${allAlerts.length} total, ${activeAlerts.length} active`);
    console.log(`  - Vehicle Positions: ${vehiclePositions.length}`);
    console.log(`  - Trips with RT data: ${tripsWithData.length}`);

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

testRealtimeLocalFile();
