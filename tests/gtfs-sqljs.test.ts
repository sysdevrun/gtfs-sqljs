/**
 * Tests for GtfsSqlJs class
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import initSqlJs, { type SqlJsStatic } from 'sql.js';
import { GtfsSqlJs } from '../src/gtfs-sqljs';
import { createSqlJsAdapter } from '../src/adapters/sql-js';
import { createTestDatabase } from './helpers/test-database';

describe('GtfsSqlJs', () => {
  let gtfs: GtfsSqlJs;
  let SQL: SqlJsStatic;

  beforeAll(async () => {
    // Initialize SQL.js
    SQL = await initSqlJs();

    // Create test database
    const dbBuffer = await createTestDatabase(SQL);

    // Initialize GtfsSqlJs with test data
    gtfs = await GtfsSqlJs.fromDatabase(dbBuffer, {
      adapter: await createSqlJsAdapter({ SQL }),
    });
  });

  afterAll(async () => {
    await gtfs?.close();
  });

  describe('Stop methods', () => {
    it('should get stop by ID using filters', async () => {
      const stops = await gtfs.getStops({ stopId: 'STOP1' });
      expect(stops.length).toBe(1);
      expect(stops[0].stop_id).toBe('STOP1');
      expect(stops[0].stop_name).toBe('First Street');
    });

    it('should get stop by code', async () => {
      const stops = await gtfs.getStops({ stopCode: 'FS' });
      expect(stops.length).toBe(1);
      expect(stops[0].stop_id).toBe('STOP1');
    });

    it('should search stops by name', async () => {
      const stops = await gtfs.getStops({ name: 'Street' });
      expect(stops.length).toBeGreaterThan(0);
      expect(stops[0].stop_name).toContain('Street');
    });

    it('should return empty array for non-existent stop ID', async () => {
      const stops = await gtfs.getStops({ stopId: 'NONEXISTENT' });
      expect(stops.length).toBe(0);
    });

    it('should get all stops', async () => {
      const stops = await gtfs.getStops();
      expect(stops.length).toBeGreaterThan(0);
    });

    it('should get multiple stops by ID array', async () => {
      const stops = await gtfs.getStops({ stopId: ['STOP1', 'STOP2'] });
      expect(stops.length).toBe(2);
    });
  });

  describe('Route methods', () => {
    it('should get route by ID using filters', async () => {
      const routes = await gtfs.getRoutes({ routeId: 'ROUTE1' });
      expect(routes.length).toBe(1);
      expect(routes[0].route_id).toBe('ROUTE1');
      expect(routes[0].route_short_name).toBe('1');
    });

    it('should get all routes', async () => {
      const routes = await gtfs.getRoutes();
      expect(routes.length).toBeGreaterThan(0);
    });

    it('should return empty array for non-existent route', async () => {
      const routes = await gtfs.getRoutes({ routeId: 'NONEXISTENT' });
      expect(routes.length).toBe(0);
    });

    it('should get multiple routes by ID array', async () => {
      const routes = await gtfs.getRoutes({ routeId: ['ROUTE1', 'ROUTE2'] });
      expect(routes.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Calendar methods', () => {
    it('should get active service IDs for a date', async () => {
      const serviceIds = await gtfs.getActiveServiceIds('20240101');
      expect(serviceIds.length).toBeGreaterThan(0);
      expect(serviceIds).toContain('WEEKDAY');
    });

    it('should get calendar by service ID', async () => {
      const calendar = await gtfs.getCalendarByServiceId('WEEKDAY');
      expect(calendar).toBeDefined();
      expect(calendar?.service_id).toBe('WEEKDAY');
      expect(calendar?.monday).toBe(1);
    });

    it('should return empty array for date with no service', async () => {
      const serviceIds = await gtfs.getActiveServiceIds('21000101');
      expect(serviceIds.length).toBe(0);
    });

    it('should get all calendars', async () => {
      const calendars = await gtfs.getCalendars();
      expect(calendars.length).toBe(2);
      expect(calendars.map((c) => c.service_id).sort()).toEqual(['WEEKDAY', 'WEEKEND']);
    });

    it('should get calendars filtered by service ID', async () => {
      const calendars = await gtfs.getCalendars({ serviceId: 'WEEKDAY' });
      expect(calendars.length).toBe(1);
      expect(calendars[0].service_id).toBe('WEEKDAY');
      expect(calendars[0].monday).toBe(1);
      expect(calendars[0].saturday).toBe(0);
    });

    it('should get calendars by service ID array', async () => {
      const calendars = await gtfs.getCalendars({ serviceId: ['WEEKDAY', 'WEEKEND'] });
      expect(calendars.length).toBe(2);
    });

    it('should respect limit on getCalendars', async () => {
      const calendars = await gtfs.getCalendars({ limit: 1 });
      expect(calendars.length).toBe(1);
    });

    it('should get all calendar dates without filters', async () => {
      const dates = await gtfs.getCalendarDates();
      expect(dates.length).toBe(2);
    });

    it('should get calendar dates filtered by service ID', async () => {
      const dates = await gtfs.getCalendarDates({ serviceId: 'WEEKDAY' });
      expect(dates.length).toBe(1);
      expect(dates[0].service_id).toBe('WEEKDAY');
      expect(dates[0].exception_type).toBe(2);
    });

    it('should get calendar dates filtered by date', async () => {
      const dates = await gtfs.getCalendarDates({ date: '20240704' });
      expect(dates.length).toBe(2);
    });

    it('should still accept legacy string form of getCalendarDates', async () => {
      const dates = await gtfs.getCalendarDates('WEEKEND');
      expect(dates.length).toBe(1);
      expect(dates[0].service_id).toBe('WEEKEND');
      expect(dates[0].exception_type).toBe(1);
    });
  });

  describe('Feed info methods', () => {
    it('should get feed info', async () => {
      const feedInfos = await gtfs.getFeedInfo();
      expect(feedInfos.length).toBe(1);
      expect(feedInfos[0].feed_publisher_name).toBe('Test Transit Publisher');
      expect(feedInfos[0].feed_lang).toBe('en');
      expect(feedInfos[0].feed_start_date).toBe('20240101');
      expect(feedInfos[0].feed_end_date).toBe('20241231');
      expect(feedInfos[0].feed_version).toBe('2024.1');
      expect(feedInfos[0].feed_contact_email).toBeUndefined();
    });
  });

  describe('Frequency methods', () => {
    it('should get all frequencies', async () => {
      const frequencies = await gtfs.getFrequencies();
      expect(frequencies.length).toBe(3);
    });

    it('should get frequencies filtered by trip ID', async () => {
      const frequencies = await gtfs.getFrequencies({ tripId: 'TRIP1' });
      expect(frequencies.length).toBe(2);
      expect(frequencies[0].start_time).toBe('06:00:00');
      expect(frequencies[0].headway_secs).toBe(600);
    });

    it('should preserve exact_times 0 and map null to undefined', async () => {
      const frequencies = await gtfs.getFrequencies({ tripId: 'TRIP1' });
      expect(frequencies[0].exact_times).toBe(0);
      expect(frequencies[1].exact_times).toBeUndefined();
    });

    it('should get frequencies by trip ID array with limit', async () => {
      const frequencies = await gtfs.getFrequencies({ tripId: ['TRIP1', 'TRIP4'], limit: 2 });
      expect(frequencies.length).toBe(2);
    });

    it('should return empty array for trip without frequencies', async () => {
      const frequencies = await gtfs.getFrequencies({ tripId: 'TRIP2' });
      expect(frequencies.length).toBe(0);
    });
  });

  describe('Trip methods', () => {
    it('should get trip by ID using filters', async () => {
      const trips = await gtfs.getTrips({ tripId: 'TRIP1' });
      expect(trips.length).toBe(1);
      expect(trips[0].trip_id).toBe('TRIP1');
      expect(trips[0].route_id).toBe('ROUTE1');
    });

    it('should get trips by route', async () => {
      const trips = await gtfs.getTrips({ routeId: 'ROUTE1' });
      expect(trips.length).toBeGreaterThan(0);
    });

    it('should get trips by route and date', async () => {
      const trips = await gtfs.getTrips({ routeId: 'ROUTE1', date: '20240101' });
      expect(trips.length).toBeGreaterThan(0);
    });

    it('should get trips by route, date, and direction', async () => {
      const trips = await gtfs.getTrips({ routeId: 'ROUTE1', date: '20240101', directionId: 0 });
      expect(trips.length).toBeGreaterThan(0);
      expect(trips.every(t => t.direction_id === 0)).toBe(true);
    });

    it('should return empty array for out-of-range date', async () => {
      const trips = await gtfs.getTrips({ date: '19700101' });
      expect(trips).toEqual([]);
    });

    it('should get multiple trips by ID array', async () => {
      const trips = await gtfs.getTrips({ tripId: ['TRIP1', 'TRIP2'] });
      expect(trips.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Stop time methods', () => {
    it('should get stop times by trip using filters', async () => {
      const stopTimes = await gtfs.getStopTimes({ tripId: 'TRIP1' });
      expect(stopTimes.length).toBeGreaterThan(0);
      expect(stopTimes[0].trip_id).toBe('TRIP1');
    });

    it('should get stop times by stop', async () => {
      const stopTimes = await gtfs.getStopTimes({ stopId: 'STOP1' });
      expect(stopTimes.length).toBeGreaterThan(0);
    });

    it('should get stop times for stop, route, and date', async () => {
      const stopTimes = await gtfs.getStopTimes({ stopId: 'STOP1', routeId: 'ROUTE1', date: '20240101' });
      expect(stopTimes.length).toBeGreaterThan(0);
    });

    it('should get stop times with direction filter', async () => {
      const stopTimes = await gtfs.getStopTimes({ stopId: 'STOP1', routeId: 'ROUTE1', date: '20240101', directionId: 0 });
      expect(stopTimes.length).toBeGreaterThan(0);
    });

    it('should return empty array for out-of-range date', async () => {
      const stopTimes = await gtfs.getStopTimes({ date: '19700101' });
      expect(stopTimes).toEqual([]);
    });

    it('should get multiple stop times by trip ID array', async () => {
      const stopTimes = await gtfs.getStopTimes({ tripId: ['TRIP1', 'TRIP2'] });
      expect(stopTimes.length).toBeGreaterThan(0);
    });
  });

  describe('Database export', () => {
    it('should export database to ArrayBuffer', async () => {
      const buffer = await gtfs.export();
      expect(buffer).toBeInstanceOf(ArrayBuffer);
      expect(buffer.byteLength).toBeGreaterThan(0);
    });

    it('should be able to reload exported database', async () => {
      const buffer = await gtfs.export();
      const newGtfs = await GtfsSqlJs.fromDatabase(buffer, {
        adapter: await createSqlJsAdapter({ SQL }),
      });

      const stops = await newGtfs.getStops({ stopId: 'STOP1' });
      expect(stops.length).toBe(1);
      expect(stops[0].stop_name).toBe('First Street');

      await newGtfs.close();
    });
  });

  describe('Error handling', () => {
    it('should throw error when accessing closed database', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const closedGtfs = new (GtfsSqlJs as any)();
      await expect(closedGtfs.getStops({ stopId: 'STOP1' })).rejects.toThrow('Database not initialized');
    });
  });
});
