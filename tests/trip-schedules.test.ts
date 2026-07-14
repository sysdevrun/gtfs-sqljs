/**
 * End-to-end tests for getTripSchedules: static schedule + GTFS-RT protobuf
 * loading + resolution, including the loader regressions (zero delay,
 * stop_id-only updates).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import initSqlJs, { type SqlJsStatic } from 'sql.js';
import { GtfsSqlJs } from '../src/gtfs-sqljs';
import { createSqlJsAdapter } from '../src/adapters/sql-js';
import { TripScheduleRelationship } from '../src/types/gtfs-rt';
import { createTestDatabase } from './helpers/test-database';
import { encodeTripUpdatesFeed } from './helpers/rt-feed';

// Test feed agency is America/New_York; 2024-01-15 is a Monday (WEEKDAY service), EST (UTC-5).
const DATE = '20240115';
const DAY = Date.UTC(2024, 0, 15, 5) / 1000;

describe('getTripSchedules', () => {
  let gtfs: GtfsSqlJs;
  let SQL: SqlJsStatic;

  beforeAll(async () => {
    SQL = await initSqlJs();
    const dbBuffer = await createTestDatabase(SQL);
    gtfs = await GtfsSqlJs.fromDatabase(dbBuffer, {
      adapter: await createSqlJsAdapter({ SQL }),
    });

    const feed = encodeTripUpdatesFeed([
      // Delay-only update mid-trip
      {
        trip: { tripId: 'TRIP1' },
        stopTimeUpdate: [{ stopSequence: 2, departure: { delay: 120 } }],
      },
      // stop_id-only update (no stop_sequence)
      {
        trip: { tripId: 'TRIP2' },
        stopTimeUpdate: [{ stopId: 'STOP2', arrival: { delay: 60 } }],
      },
      // Explicit zero delay (must survive the loader)
      {
        trip: { tripId: 'TRIP3' },
        stopTimeUpdate: [{ stopSequence: 1, departure: { delay: 0 } }],
      },
      // Canceled trip
      {
        trip: { tripId: 'TRIP4', scheduleRelationship: TripScheduleRelationship.CANCELED },
      },
    ]);
    await gtfs.loadRealtimeDataFromBuffers([feed]);
  });

  afterAll(async () => {
    await gtfs?.close();
  });

  it('resolves scheduled epochs in the agency timezone with stop names joined', async () => {
    const [schedule] = await gtfs.getTripSchedules({ tripId: 'TRIP1', date: DATE });

    expect(schedule.timezone).toBe('America/New_York');
    expect(schedule.service_date).toBe(DATE);
    expect(schedule.stops).toHaveLength(3);
    expect(schedule.stops[0].stop_name).toBe('First Street');
    expect(schedule.stops[0].scheduled_departure_seconds).toBe(28800);
    expect(schedule.stops[0].scheduled_departure_epoch).toBe(DAY + 28800);
    expect(schedule.stops[0].is_first).toBe(true);
    expect(schedule.stops[2].is_last).toBe(true);
  });

  it('applies an exact update and propagates it to later stops', async () => {
    const [schedule] = await gtfs.getTripSchedules({ tripId: 'TRIP1', date: DATE });
    const [first, second, third] = schedule.stops;

    expect(first.rt_source).toBe('none');
    expect(second.rt_source).toBe('exact');
    expect(second.departure_delay).toBe(120);
    expect(second.rt_departure_epoch).toBe(DAY + 29400 + 120);
    expect(third.rt_source).toBe('propagated');
    expect(third.arrival_delay).toBe(120);
    // Last stop displays the (realtime) arrival
    expect(third.display_epoch).toBe(DAY + 30000 + 120);
    expect(third.display_is_realtime).toBe(true);
    expect(schedule.has_realtime).toBe(true);
    expect(schedule.canceled).toBe(false);
  });

  it('matches updates sent with stop_id only', async () => {
    const [schedule] = await gtfs.getTripSchedules({ tripId: 'TRIP2', date: DATE });
    // TRIP2 serves STOP3 -> STOP2 -> STOP1; the update targets STOP2 (sequence 2)
    const second = schedule.stops[1];
    expect(second.stop_id).toBe('STOP2');
    expect(second.rt_source).toBe('exact');
    expect(second.arrival_delay).toBe(60);
    expect(schedule.stops[2].rt_source).toBe('propagated');
  });

  it('keeps an explicit zero delay as on-time realtime', async () => {
    const updates = await gtfs.getStopTimeUpdates({ tripId: 'TRIP3' });
    expect(updates).toHaveLength(1);
    expect(updates[0].departure?.delay).toBe(0);

    const [schedule] = await gtfs.getTripSchedules({ tripId: 'TRIP3', date: DATE });
    expect(schedule.stops[0].rt_source).toBe('exact');
    expect(schedule.stops[0].departure_delay).toBe(0);
    expect(schedule.stops[0].display_is_realtime).toBe(true);
    expect(schedule.stops[1].rt_source).toBe('propagated');
  });

  it('reports canceled trips and shows only the schedule', async () => {
    const [schedule] = await gtfs.getTripSchedules({ tripId: 'TRIP4', date: DATE });
    expect(schedule.canceled).toBe(true);
    expect(schedule.schedule_relationship).toBe(TripScheduleRelationship.CANCELED);
    expect(schedule.has_realtime).toBe(true);
    expect(schedule.stops.every(s => !s.display_is_realtime)).toBe(true);
  });

  it('selects trips by route and date, ordered by first departure', async () => {
    const schedules = await gtfs.getTripSchedules({ routeId: 'ROUTE1', date: DATE });
    // TRIP3 runs on WEEKEND service and must be excluded on a Monday
    expect(schedules.map(s => s.trip.trip_id)).toEqual(['TRIP1', 'TRIP2']);
  });

  it('filters by directionId', async () => {
    const schedules = await gtfs.getTripSchedules({ routeId: 'ROUTE1', date: DATE, directionId: 1 });
    expect(schedules.map(s => s.trip.trip_id)).toEqual(['TRIP2']);
  });

  it('treats realtime as stale relative to the provided now', async () => {
    const future = Math.floor(Date.now() / 1000) + 10_000;
    const [schedule] = await gtfs.getTripSchedules({ tripId: 'TRIP1', date: DATE, now: future });
    expect(schedule.has_realtime).toBe(false);
    expect(schedule.stops.every(s => s.rt_source === 'none')).toBe(true);
  });

  it('honors a timezone override', async () => {
    const [schedule] = await gtfs.getTripSchedules({ tripId: 'TRIP1', date: DATE, timezone: 'UTC' });
    expect(schedule.timezone).toBe('UTC');
    expect(schedule.stops[0].scheduled_departure_epoch).toBe(Date.UTC(2024, 0, 15) / 1000 + 28800);
  });

  it("supports the 'arrival' display mode", async () => {
    const [schedule] = await gtfs.getTripSchedules({ tripId: 'TRIP1', date: DATE, displayMode: 'arrival' });
    // First stop shows departure, intermediate stops show arrival
    expect(schedule.stops[0].display_epoch).toBe(DAY + 28800);
    expect(schedule.stops[1].display_epoch).toBe(DAY + 29400 + 120);
  });

  it('requires date and tripId/routeId', async () => {
    // @ts-expect-error date is required
    await expect(gtfs.getTripSchedules({ tripId: 'TRIP1' })).rejects.toThrow(/date/);
    await expect(gtfs.getTripSchedules({ date: DATE })).rejects.toThrow(/tripId/);
  });
});
