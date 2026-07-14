/**
 * Trip schedules example: display-ready departure times with realtime resolved.
 *
 * getTripSchedules() pre-computes everything a departure board needs:
 * - seconds since the start of the service day (past-midnight times > 86400)
 * - unix epochs computed in the agency's timezone (render them in any timezone)
 * - realtime delays resolved per the GTFS-RT spec (delay-only or absolute-time
 *   feeds, propagation to later stops, trip-level delay fallback)
 * - display_epoch: the one time to show (departure, or arrival at the terminus)
 * - skipped / canceled flags, stop names joined in
 */

import { GtfsSqlJs, parseGtfsTime, gtfsTimeToEpoch } from '../src/index';
import { createSqlJsAdapter } from '../src/adapters/sql-js';

async function main() {
  const gtfs = await GtfsSqlJs.fromZip('https://example.com/gtfs.zip', {
    adapter: await createSqlJsAdapter(),
    realtimeFeedUrls: ['https://example.com/gtfs-rt/trip-updates'],
  });

  const today = new Date();
  const date = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('');

  console.log('=== Example 1: Departure board for a route ===');
  const [route] = await gtfs.getRoutes({ limit: 1 });
  const schedules = await gtfs.getTripSchedules({ routeId: route.route_id, date });

  for (const schedule of schedules.slice(0, 3)) {
    const headsign = schedule.trip.trip_headsign ?? schedule.trip.trip_id;
    console.log(`\nTrip ${schedule.trip.trip_id} → ${headsign}` + (schedule.canceled ? ' [CANCELED]' : ''));

    for (const stop of schedule.stops) {
      if (stop.display_epoch === undefined) continue; // interpolated stop, no time

      // display_epoch is a unix timestamp: render it in any timezone you like.
      // Here: the network's own timezone (schedule.timezone).
      const wallClock = new Date(stop.display_epoch * 1000).toLocaleTimeString('en-GB', {
        timeZone: schedule.timezone,
        hour: '2-digit',
        minute: '2-digit',
      });

      const delay = stop.display_delay ?? 0;
      const suffix = stop.skipped
        ? ' (skipped)'
        : stop.display_is_realtime
          ? delay === 0
            ? ' (on time)'
            : ` (${delay > 0 ? '+' : ''}${Math.round(delay / 60)} min)`
          : '';

      const label = stop.is_last ? 'arr' : 'dep';
      console.log(`  ${wallClock} ${label}  ${stop.stop_name ?? stop.stop_id}${suffix}`);
    }
  }

  console.log('\n=== Example 2: Countdown to the next departure at a stop ===');
  const nowEpoch = Math.floor(Date.now() / 1000);
  const upcoming = schedules
    .flatMap(s => s.stops)
    .filter(st => !st.is_last && !st.skipped && st.display_epoch !== undefined && st.display_epoch > nowEpoch)
    .sort((a, b) => (a.display_epoch ?? 0) - (b.display_epoch ?? 0));

  if (upcoming.length > 0) {
    const next = upcoming[0];
    const minutes = Math.round((next.display_epoch! - nowEpoch) / 60);
    console.log(`Next departure at ${next.stop_name}: in ${minutes} min` + (next.display_is_realtime ? ' (realtime)' : ' (scheduled)'));
  }

  console.log('\n=== Example 3: Pure helpers, no database needed ===');
  // parseGtfsTime handles past-midnight times; gtfsTimeToEpoch is DST-safe.
  const daySeconds = parseGtfsTime('25:30:00'); // 91800
  const epoch = gtfsTimeToEpoch(daySeconds!, date, 'Europe/Paris');
  console.log(`25:30:00 on ${date} in Europe/Paris = ${new Date(epoch * 1000).toISOString()}`);

  await gtfs.close();
}

main().catch(console.error);
