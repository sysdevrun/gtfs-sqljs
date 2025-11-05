/**
 * Tests using the official Google GTFS sample feed
 *
 * This test file uses the real sample feed from:
 * https://developers.google.com/transit/gtfs/examples/gtfs-feed
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GtfsSqlJs } from '../src/gtfs-sqljs';
import path from 'path';

describe('Sample GTFS Feed Tests', () => {
  let gtfs: GtfsSqlJs;

  beforeAll(async () => {
    // Load the sample GTFS feed
    const feedPath = path.join(__dirname, 'fixtures', 'sample-feed.zip');
    gtfs = await GtfsSqlJs.fromZip(feedPath);
  });

  afterAll(() => {
    gtfs?.close();
  });

  describe('Agency', () => {
    it('should load agency information', () => {
      const db = gtfs.getDatabase();
      const stmt = db.prepare('SELECT * FROM agency');

      const agencies: any[] = [];
      while (stmt.step()) {
        agencies.push(stmt.getAsObject());
      }
      stmt.free();

      expect(agencies.length).toBeGreaterThan(0);
      expect(agencies[0]).toHaveProperty('agency_name');
      expect(agencies[0]).toHaveProperty('agency_url');
      expect(agencies[0]).toHaveProperty('agency_timezone');
    });
  });

  describe('Stops', () => {
    it('should load all stops', () => {
      const stops = gtfs.getAllStops();
      expect(stops.length).toBeGreaterThan(0);

      // Verify stop structure
      const stop = stops[0];
      expect(stop).toHaveProperty('stop_id');
      expect(stop).toHaveProperty('stop_name');
      expect(stop).toHaveProperty('stop_lat');
      expect(stop).toHaveProperty('stop_lon');
    });

    it('should get stop by ID', () => {
      const allStops = gtfs.getAllStops();
      const firstStop = allStops[0];

      const stop = gtfs.getStopById(firstStop.stop_id);
      expect(stop).not.toBeNull();
      expect(stop?.stop_id).toBe(firstStop.stop_id);
      expect(stop?.stop_name).toBe(firstStop.stop_name);
    });

    it('should search stops by name', () => {
      const allStops = gtfs.getAllStops();
      if (allStops.length > 0) {
        // Search for first word of first stop name
        const searchTerm = allStops[0].stop_name.split(' ')[0];
        const results = gtfs.searchStopsByName(searchTerm);
        expect(results.length).toBeGreaterThan(0);
      }
    });

    it('should get stops for a trip', () => {
      // Get a trip first
      const trips = gtfs.getAllRoutes()[0] ?
        gtfs.getTripsByRoute(gtfs.getAllRoutes()[0].route_id) : [];

      if (trips.length > 0) {
        const stops = gtfs.getStopsByTrip(trips[0].trip_id);
        expect(stops.length).toBeGreaterThan(0);

        // Verify stops are in order (should have coordinates)
        stops.forEach(stop => {
          expect(stop.stop_lat).toBeDefined();
          expect(stop.stop_lon).toBeDefined();
        });
      }
    });
  });

  describe('Routes', () => {
    it('should load all routes', () => {
      const routes = gtfs.getAllRoutes();
      expect(routes.length).toBeGreaterThan(0);

      // Verify route structure
      const route = routes[0];
      expect(route).toHaveProperty('route_id');
      expect(route).toHaveProperty('route_short_name');
      expect(route).toHaveProperty('route_long_name');
      expect(route).toHaveProperty('route_type');
    });

    it('should get route by ID', () => {
      const allRoutes = gtfs.getAllRoutes();
      const firstRoute = allRoutes[0];

      const route = gtfs.getRouteById(firstRoute.route_id);
      expect(route).not.toBeNull();
      expect(route?.route_id).toBe(firstRoute.route_id);
    });
  });

  describe('Calendar', () => {
    it('should have calendar data', () => {
      const db = gtfs.getDatabase();
      const stmt = db.prepare('SELECT * FROM calendar');

      const calendars: any[] = [];
      while (stmt.step()) {
        calendars.push(stmt.getAsObject());
      }
      stmt.free();

      expect(calendars.length).toBeGreaterThan(0);

      const calendar = calendars[0];
      expect(calendar).toHaveProperty('service_id');
      expect(calendar).toHaveProperty('monday');
      expect(calendar).toHaveProperty('start_date');
      expect(calendar).toHaveProperty('end_date');
    });

    it('should get active service IDs for a date', () => {
      // Get a valid date from calendar
      const db = gtfs.getDatabase();
      const stmt = db.prepare('SELECT start_date FROM calendar LIMIT 1');

      let testDate = '20070101';
      if (stmt.step()) {
        const row = stmt.getAsObject() as any;
        testDate = String(row.start_date);
      }
      stmt.free();

      const serviceIds = gtfs.getActiveServiceIds(testDate);
      // May or may not have active services depending on day of week
      expect(Array.isArray(serviceIds)).toBe(true);
    });
  });

  describe('Trips', () => {
    it('should load trips', () => {
      const routes = gtfs.getAllRoutes();
      expect(routes.length).toBeGreaterThan(0);

      const trips = gtfs.getTripsByRoute(routes[0].route_id);
      expect(trips.length).toBeGreaterThan(0);

      const trip = trips[0];
      expect(trip).toHaveProperty('trip_id');
      expect(trip).toHaveProperty('route_id');
      expect(trip).toHaveProperty('service_id');
    });

    it('should get trips for a date', () => {
      // Get a valid weekday date from calendar
      const db = gtfs.getDatabase();
      const stmt = db.prepare('SELECT start_date, monday FROM calendar WHERE monday = 1 LIMIT 1');

      if (stmt.step()) {
        const row = stmt.getAsObject() as any;
        const testDate = String(row.start_date);
        stmt.free();

        const trips = gtfs.getTripsByDate(testDate);
        expect(trips.length).toBeGreaterThan(0);

        // Verify all trips have service_id
        trips.forEach(trip => {
          expect(trip.service_id).toBeDefined();
        });
      } else {
        stmt.free();
      }
    });

    it('should get trips by route and date', () => {
      const routes = gtfs.getAllRoutes();
      if (routes.length > 0) {
        const db = gtfs.getDatabase();
        const stmt = db.prepare('SELECT start_date FROM calendar LIMIT 1');

        if (stmt.step()) {
          const row = stmt.getAsObject() as any;
          const testDate = String(row.start_date);
          stmt.free();

          const trips = gtfs.getTripsByRouteAndDate(routes[0].route_id, testDate);
          expect(Array.isArray(trips)).toBe(true);
        } else {
          stmt.free();
        }
      }
    });
  });

  describe('Stop Times', () => {
    it('should load stop times for a trip', () => {
      const routes = gtfs.getAllRoutes();
      const trips = routes.length > 0 ? gtfs.getTripsByRoute(routes[0].route_id) : [];

      if (trips.length > 0) {
        const stopTimes = gtfs.getStopTimesByTrip(trips[0].trip_id);
        expect(stopTimes.length).toBeGreaterThan(0);

        const stopTime = stopTimes[0];
        expect(stopTime).toHaveProperty('trip_id');
        expect(stopTime).toHaveProperty('arrival_time');
        expect(stopTime).toHaveProperty('departure_time');
        expect(stopTime).toHaveProperty('stop_id');
        expect(stopTime).toHaveProperty('stop_sequence');

        // Verify stop times are ordered by sequence
        for (let i = 1; i < stopTimes.length; i++) {
          expect(stopTimes[i].stop_sequence).toBeGreaterThan(stopTimes[i-1].stop_sequence);
        }
      }
    });

    it('should get stop times for a stop', () => {
      const stops = gtfs.getAllStops();
      if (stops.length > 0) {
        const stopTimes = gtfs.getStopTimesByStop(stops[0].stop_id, 10);
        // May or may not have stop times
        expect(Array.isArray(stopTimes)).toBe(true);
      }
    });
  });

  describe('Complete Journey Test', () => {
    it('should be able to plan a simple journey', () => {
      // 1. Get all routes
      const routes = gtfs.getAllRoutes();
      expect(routes.length).toBeGreaterThan(0);

      // 2. Pick a route and get its trips
      const route = routes[0];
      const trips = gtfs.getTripsByRoute(route.route_id);
      expect(trips.length).toBeGreaterThan(0);

      // 3. Get stop times for the trip
      const trip = trips[0];
      const stopTimes = gtfs.getStopTimesByTrip(trip.trip_id);
      expect(stopTimes.length).toBeGreaterThan(1);

      // 4. Get stop details
      const firstStop = gtfs.getStopById(stopTimes[0].stop_id);
      const lastStop = gtfs.getStopById(stopTimes[stopTimes.length - 1].stop_id);

      expect(firstStop).not.toBeNull();
      expect(lastStop).not.toBeNull();

      // 5. Verify journey details
      console.log('\nSample Journey:');
      console.log(`Route: ${route.route_short_name} - ${route.route_long_name}`);
      console.log(`Trip: ${trip.trip_id}${trip.trip_headsign ? ' (' + trip.trip_headsign + ')' : ''}`);
      console.log(`From: ${firstStop?.stop_name} at ${stopTimes[0].departure_time}`);
      console.log(`To: ${lastStop?.stop_name} at ${stopTimes[stopTimes.length - 1].arrival_time}`);
      console.log(`Stops: ${stopTimes.length}`);
    });
  });

  describe('Database Export/Import', () => {
    it('should export and re-import database', async () => {
      // Export database
      const buffer = gtfs.export();
      expect(buffer.byteLength).toBeGreaterThan(0);

      // Create new instance from exported buffer
      const gtfs2 = await GtfsSqlJs.fromDatabase(buffer);

      // Verify data is intact
      const originalStops = gtfs.getAllStops();
      const importedStops = gtfs2.getAllStops();

      expect(importedStops.length).toBe(originalStops.length);
      expect(importedStops[0].stop_id).toBe(originalStops[0].stop_id);

      gtfs2.close();
    });
  });
});
