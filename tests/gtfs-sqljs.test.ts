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
