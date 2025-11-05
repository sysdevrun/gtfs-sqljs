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
    it('should get stop by ID', () => {
      const stop = gtfs.getStopById('STOP1');
      expect(stop).toBeDefined();
      expect(stop?.stop_id).toBe('STOP1');
      expect(stop?.stop_name).toBe('First Street');
    });

    it('should get stop by code', () => {
      const stop = gtfs.getStopByCode('FS');
      expect(stop).toBeDefined();
      expect(stop?.stop_id).toBe('STOP1');
    });

    it('should search stops by name', () => {
      const stops = gtfs.searchStopsByName('Street');
      expect(stops.length).toBeGreaterThan(0);
      expect(stops[0].stop_name).toContain('Street');
    });

    it('should return null for non-existent stop ID', () => {
      const stop = gtfs.getStopById('NONEXISTENT');
      expect(stop).toBeNull();
    });

    it('should get all stops', () => {
      const stops = gtfs.getAllStops();
      expect(stops.length).toBeGreaterThan(0);
    });
  });

  describe('Route methods', () => {
    it('should get route by ID', () => {
      const route = gtfs.getRouteById('ROUTE1');
      expect(route).toBeDefined();
      expect(route?.route_id).toBe('ROUTE1');
      expect(route?.route_short_name).toBe('1');
    });

    it('should get all routes', () => {
      const routes = gtfs.getAllRoutes();
      expect(routes.length).toBeGreaterThan(0);
    });

    it('should return null for non-existent route', () => {
      const route = gtfs.getRouteById('NONEXISTENT');
      expect(route).toBeNull();
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
    it('should get trip by ID', () => {
      const trip = gtfs.getTripById('TRIP1');
      expect(trip).toBeDefined();
      expect(trip?.trip_id).toBe('TRIP1');
      expect(trip?.route_id).toBe('ROUTE1');
    });

    it('should get trips by route', () => {
      const trips = gtfs.getTripsByRoute('ROUTE1');
      expect(trips.length).toBeGreaterThan(0);
    });

    it('should get trips by route and date', () => {
      const trips = gtfs.getTripsByRouteAndDate('ROUTE1', '20240101');
      expect(trips.length).toBeGreaterThan(0);
    });

    it('should get trips by route, date, and direction', () => {
      const trips = gtfs.getTripsByRouteAndDateAndDirection('ROUTE1', '20240101', 0);
      expect(trips.length).toBeGreaterThan(0);
      expect(trips.every(t => t.direction_id === 0)).toBe(true);
    });
  });

  describe('Stop time methods', () => {
    it('should get stop times by trip', () => {
      const stopTimes = gtfs.getStopTimesByTrip('TRIP1');
      expect(stopTimes.length).toBeGreaterThan(0);
      expect(stopTimes[0].trip_id).toBe('TRIP1');
    });

    it('should get stop times by stop', () => {
      const stopTimes = gtfs.getStopTimesByStop('STOP1');
      expect(stopTimes.length).toBeGreaterThan(0);
    });

    it('should get stop times for stop, route, and date', () => {
      const stopTimes = gtfs.getStopTimesForStopRouteAndDate('STOP1', 'ROUTE1', '20240101');
      expect(stopTimes.length).toBeGreaterThan(0);
    });

    it('should get stop times with direction filter', () => {
      const stopTimes = gtfs.getStopTimesForStopRouteAndDate('STOP1', 'ROUTE1', '20240101', 0);
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

      const stop = newGtfs.getStopById('STOP1');
      expect(stop).toBeDefined();
      expect(stop?.stop_name).toBe('First Street');

      newGtfs.close();
    });
  });

  describe('Error handling', () => {
    it('should throw error when accessing closed database', () => {
      const closedGtfs = new (GtfsSqlJs as any)();
      expect(() => closedGtfs.getStopById('STOP1')).toThrow('Database not initialized');
    });
  });
});
