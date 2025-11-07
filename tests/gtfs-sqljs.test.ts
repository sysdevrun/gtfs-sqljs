/**
 * Tests for GtfsSqlJs class
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import initSqlJs from 'sql.js';
import { GtfsSqlJs } from '../src/gtfs-sqljs';
import { createTestDatabase } from './helpers/test-database';

describe('GtfsSqlJs', () => {
  let gtfs: GtfsSqlJs;
  let SQL: any;

  beforeAll(async () => {
    // Initialize SQL.js
    SQL = await initSqlJs();

    // Create test database
    const dbBuffer = await createTestDatabase(SQL);

    // Initialize GtfsSqlJs with test data
    gtfs = await GtfsSqlJs.fromDatabase(dbBuffer, { SQL });
  });

  afterAll(() => {
    gtfs?.close();
  });

  describe('Stop methods', () => {
    it('should get stop by ID using filters', () => {
      const stops = gtfs.getStops({ stopId: 'STOP1' });
      expect(stops.length).toBe(1);
      expect(stops[0].stop_id).toBe('STOP1');
      expect(stops[0].stop_name).toBe('First Street');
    });

    it('should get stop by code', () => {
      const stops = gtfs.getStops({ stopCode: 'FS' });
      expect(stops.length).toBe(1);
      expect(stops[0].stop_id).toBe('STOP1');
    });

    it('should search stops by name', () => {
      const stops = gtfs.getStops({ name: 'Street' });
      expect(stops.length).toBeGreaterThan(0);
      expect(stops[0].stop_name).toContain('Street');
    });

    it('should return empty array for non-existent stop ID', () => {
      const stops = gtfs.getStops({ stopId: 'NONEXISTENT' });
      expect(stops.length).toBe(0);
    });

    it('should get all stops', () => {
      const stops = gtfs.getStops();
      expect(stops.length).toBeGreaterThan(0);
    });

    it('should get multiple stops by ID array', () => {
      const stops = gtfs.getStops({ stopId: ['STOP1', 'STOP2'] });
      expect(stops.length).toBe(2);
    });
  });

  describe('Route methods', () => {
    it('should get route by ID using filters', () => {
      const routes = gtfs.getRoutes({ routeId: 'ROUTE1' });
      expect(routes.length).toBe(1);
      expect(routes[0].route_id).toBe('ROUTE1');
      expect(routes[0].route_short_name).toBe('1');
    });

    it('should get all routes', () => {
      const routes = gtfs.getRoutes();
      expect(routes.length).toBeGreaterThan(0);
    });

    it('should return empty array for non-existent route', () => {
      const routes = gtfs.getRoutes({ routeId: 'NONEXISTENT' });
      expect(routes.length).toBe(0);
    });

    it('should get multiple routes by ID array', () => {
      const routes = gtfs.getRoutes({ routeId: ['ROUTE1', 'ROUTE2'] });
      expect(routes.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Calendar methods', () => {
    it('should get active service IDs for a date', () => {
      const serviceIds = gtfs.getActiveServiceIds('20240101');
      expect(serviceIds.length).toBeGreaterThan(0);
      expect(serviceIds).toContain('WEEKDAY');
    });

    it('should get calendar by service ID', () => {
      const calendar = gtfs.getCalendarByServiceId('WEEKDAY');
      expect(calendar).toBeDefined();
      expect(calendar?.service_id).toBe('WEEKDAY');
      expect(calendar?.monday).toBe(1);
    });

    it('should return empty array for date with no service', () => {
      const serviceIds = gtfs.getActiveServiceIds('21000101');
      expect(serviceIds.length).toBe(0);
    });
  });

  describe('Trip methods', () => {
    it('should get trip by ID using filters', () => {
      const trips = gtfs.getTrips({ tripId: 'TRIP1' });
      expect(trips.length).toBe(1);
      expect(trips[0].trip_id).toBe('TRIP1');
      expect(trips[0].route_id).toBe('ROUTE1');
    });

    it('should get trips by route', () => {
      const trips = gtfs.getTrips({ routeId: 'ROUTE1' });
      expect(trips.length).toBeGreaterThan(0);
    });

    it('should get trips by route and date', () => {
      const trips = gtfs.getTrips({ routeId: 'ROUTE1', date: '20240101' });
      expect(trips.length).toBeGreaterThan(0);
    });

    it('should get trips by route, date, and direction', () => {
      const trips = gtfs.getTrips({ routeId: 'ROUTE1', date: '20240101', directionId: 0 });
      expect(trips.length).toBeGreaterThan(0);
      expect(trips.every(t => t.direction_id === 0)).toBe(true);
    });

    it('should get multiple trips by ID array', () => {
      const trips = gtfs.getTrips({ tripId: ['TRIP1', 'TRIP2'] });
      expect(trips.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Stop time methods', () => {
    it('should get stop times by trip using filters', () => {
      const stopTimes = gtfs.getStopTimes({ tripId: 'TRIP1' });
      expect(stopTimes.length).toBeGreaterThan(0);
      expect(stopTimes[0].trip_id).toBe('TRIP1');
    });

    it('should get stop times by stop', () => {
      const stopTimes = gtfs.getStopTimes({ stopId: 'STOP1' });
      expect(stopTimes.length).toBeGreaterThan(0);
    });

    it('should get stop times for stop, route, and date', () => {
      const stopTimes = gtfs.getStopTimes({ stopId: 'STOP1', routeId: 'ROUTE1', date: '20240101' });
      expect(stopTimes.length).toBeGreaterThan(0);
    });

    it('should get stop times with direction filter', () => {
      const stopTimes = gtfs.getStopTimes({ stopId: 'STOP1', routeId: 'ROUTE1', date: '20240101', directionId: 0 });
      expect(stopTimes.length).toBeGreaterThan(0);
    });

    it('should get multiple stop times by trip ID array', () => {
      const stopTimes = gtfs.getStopTimes({ tripId: ['TRIP1', 'TRIP2'] });
      expect(stopTimes.length).toBeGreaterThan(0);
    });
  });

  describe('Database export', () => {
    it('should export database to ArrayBuffer', () => {
      const buffer = gtfs.export();
      expect(buffer).toBeInstanceOf(ArrayBuffer);
      expect(buffer.byteLength).toBeGreaterThan(0);
    });

    it('should be able to reload exported database', async () => {
      const buffer = gtfs.export();
      const newGtfs = await GtfsSqlJs.fromDatabase(buffer, { SQL });

      const stops = newGtfs.getStops({ stopId: 'STOP1' });
      expect(stops.length).toBe(1);
      expect(stops[0].stop_name).toBe('First Street');

      newGtfs.close();
    });
  });

  describe('Error handling', () => {
    it('should throw error when accessing closed database', () => {
      const closedGtfs = new (GtfsSqlJs as any)();
      expect(() => closedGtfs.getStops({ stopId: 'STOP1' })).toThrow('Database not initialized');
    });
  });
});
