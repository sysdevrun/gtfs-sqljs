/**
 * Tests for buildOrderedStopList method
 *
 * This method builds an optimal ordered list of stops from multiple trips
 * that may have different stop patterns (express vs local, different start/end points)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GtfsSqlJs } from '../src/gtfs-sqljs';
import path from 'path';
import initSqlJs from 'sql.js';

describe('buildOrderedStopList', () => {
  let gtfs: GtfsSqlJs;

  beforeAll(async () => {
    // Load the sample GTFS feed
    const feedPath = path.join(__dirname, 'fixtures', 'sample-feed.zip');
    gtfs = await GtfsSqlJs.fromZip(feedPath);
  });

  afterAll(() => {
    gtfs?.close();
  });

  describe('Edge Cases', () => {
    it('should return empty array for empty trip list', () => {
      const stops = gtfs.buildOrderedStopList([]);
      expect(stops).toEqual([]);
    });

    it('should return empty array for non-existent trip IDs', () => {
      const stops = gtfs.buildOrderedStopList(['NONEXISTENT_TRIP']);
      expect(stops).toEqual([]);
    });

    it('should handle single trip', () => {
      const stops = gtfs.buildOrderedStopList(['AB1']);

      expect(stops.length).toBe(2);
      expect(stops[0].stop_id).toBe('BEATTY_AIRPORT');
      expect(stops[1].stop_id).toBe('BULLFROG');
    });
  });

  describe('Simple Cases - Same Route Same Direction', () => {
    it('should handle two trips with identical stop sequences', () => {
      // Get trips for route CITY going in direction 0
      const trips = gtfs.getTrips({ routeId: 'CITY', directionId: 0 });
      const tripIds = trips.map(t => t.trip_id);

      // Build ordered stop list
      const stops = gtfs.buildOrderedStopList(tripIds);

      // Verify we get all unique stops
      expect(stops.length).toBeGreaterThan(0);

      // Verify all stops are unique
      const stopIds = stops.map(s => s.stop_id);
      const uniqueStopIds = [...new Set(stopIds)];
      expect(stopIds.length).toBe(uniqueStopIds.length);

      // Verify stops are in a valid order
      // Each individual trip should have its stops in the same order as the result
      for (const tripId of tripIds) {
        const tripStops = gtfs.getStops({ tripId });
        const tripStopIds = tripStops.map(s => s.stop_id);

        // Extract the positions of this trip's stops in the result
        const positions = tripStopIds.map(id => stopIds.indexOf(id));

        // Positions should be in ascending order
        for (let i = 1; i < positions.length; i++) {
          expect(positions[i]).toBeGreaterThan(positions[i - 1]);
        }
      }
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle route AB (both directions)', () => {
      // Route AB has trips going both directions
      const trips = gtfs.getTrips({ routeId: 'AB' });
      const tripIds = trips.map(t => t.trip_id);

      const stops = gtfs.buildOrderedStopList(tripIds);

      // Should have both stops
      expect(stops.length).toBe(2);

      const stopIds = stops.map(s => s.stop_id);
      expect(stopIds).toContain('BEATTY_AIRPORT');
      expect(stopIds).toContain('BULLFROG');
    });

    it('should handle route CITY trips', () => {
      const trips = gtfs.getTrips({ routeId: 'CITY' });
      const tripIds = trips.map(t => t.trip_id);

      const stops = gtfs.buildOrderedStopList(tripIds);

      // Verify we have multiple stops
      expect(stops.length).toBeGreaterThan(0);

      // All stops should be valid Stop objects with required fields
      stops.forEach(stop => {
        expect(stop.stop_id).toBeDefined();
        expect(stop.stop_name).toBeDefined();
        expect(typeof stop.stop_lat).toBe('number');
        expect(typeof stop.stop_lon).toBe('number');
      });
    });

    it('should maintain correct ordering for CITY route direction 0', () => {
      const trips = gtfs.getTrips({ routeId: 'CITY', directionId: 0 });
      const tripIds = trips.map(t => t.trip_id);

      const stops = gtfs.buildOrderedStopList(tripIds);

      // Get stops for first trip to compare
      const firstTripStops = gtfs.getStops({ tripId: tripIds[0] });
      const firstTripStopIds = firstTripStops.map(s => s.stop_id);

      // All stops from first trip should appear in result in the same order
      const resultStopIds = stops.map(s => s.stop_id);
      const positions = firstTripStopIds.map(id => resultStopIds.indexOf(id));

      for (let i = 1; i < positions.length; i++) {
        expect(positions[i]).toBeGreaterThan(positions[i - 1]);
      }
    });
  });

  describe('Custom Scenarios with Manual Data', () => {
    let customGtfs: GtfsSqlJs;

    beforeAll(async () => {
      // Create a custom GTFS database with specific test scenarios
      const SQL = await initSqlJs();
      const db = new SQL.Database();

      // Create tables
      db.run(`
        CREATE TABLE stops (
          stop_id TEXT PRIMARY KEY,
          stop_name TEXT,
          stop_lat REAL,
          stop_lon REAL
        )
      `);

      db.run(`
        CREATE TABLE trips (
          trip_id TEXT PRIMARY KEY,
          route_id TEXT,
          service_id TEXT
        )
      `);

      db.run(`
        CREATE TABLE stop_times (
          trip_id TEXT,
          stop_id TEXT,
          stop_sequence INTEGER,
          arrival_time TEXT,
          departure_time TEXT
        )
      `);

      // Insert test stops (A through F)
      const stops = ['A', 'B', 'C', 'D', 'E', 'F'];
      stops.forEach((stop, idx) => {
        db.run(
          'INSERT INTO stops VALUES (?, ?, ?, ?)',
          [stop, `Stop ${stop}`, 40.0 + idx * 0.01, -74.0 + idx * 0.01]
        );
      });

      // Scenario 1: Local trip (all stops A-B-C-D-E-F)
      db.run('INSERT INTO trips VALUES (?, ?, ?)', ['LOCAL', 'ROUTE1', 'SVC1']);
      ['A', 'B', 'C', 'D', 'E', 'F'].forEach((stop, idx) => {
        db.run(
          'INSERT INTO stop_times VALUES (?, ?, ?, ?, ?)',
          ['LOCAL', stop, idx + 1, `08:${String(idx * 10).padStart(2, '0')}:00`, `08:${String(idx * 10).padStart(2, '0')}:00`]
        );
      });

      // Scenario 2: Express trip (stops A-C-E-F, skipping B and D)
      db.run('INSERT INTO trips VALUES (?, ?, ?)', ['EXPRESS', 'ROUTE1', 'SVC1']);
      ['A', 'C', 'E', 'F'].forEach((stop, idx) => {
        db.run(
          'INSERT INTO stop_times VALUES (?, ?, ?, ?, ?)',
          ['EXPRESS', stop, idx + 1, `09:${String(idx * 10).padStart(2, '0')}:00`, `09:${String(idx * 10).padStart(2, '0')}:00`]
        );
      });

      // Scenario 3: Short trip (starts at B, ends at D)
      db.run('INSERT INTO trips VALUES (?, ?, ?)', ['SHORT', 'ROUTE1', 'SVC1']);
      ['B', 'C', 'D'].forEach((stop, idx) => {
        db.run(
          'INSERT INTO stop_times VALUES (?, ?, ?, ?, ?)',
          ['SHORT', stop, idx + 1, `10:${String(idx * 10).padStart(2, '0')}:00`, `10:${String(idx * 10).padStart(2, '0')}:00`]
        );
      });

      // Scenario 4: Trip with intermediate stop (A-B-X-C-D where X is between B and C)
      db.run('INSERT INTO stops VALUES (?, ?, ?, ?)', ['X', 'Stop X', 40.015, -74.015]);
      db.run('INSERT INTO trips VALUES (?, ?, ?)', ['WITH_X', 'ROUTE1', 'SVC1']);
      ['A', 'B', 'X', 'C', 'D'].forEach((stop, idx) => {
        db.run(
          'INSERT INTO stop_times VALUES (?, ?, ?, ?, ?)',
          ['WITH_X', stop, idx + 1, `11:${String(idx * 10).padStart(2, '0')}:00`, `11:${String(idx * 10).padStart(2, '0')}:00`]
        );
      });

      // Initialize GtfsSqlJs with the populated database
      customGtfs = await GtfsSqlJs.fromDatabase(db.export());
    });

    afterAll(() => {
      customGtfs?.close();
    });

    it('should merge local and express trips correctly', () => {
      const stops = customGtfs.buildOrderedStopList(['LOCAL', 'EXPRESS']);

      const stopIds = stops.map(s => s.stop_id);

      // Should have all 6 stops
      expect(stopIds).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
    });

    it('should handle trips with different start/end points', () => {
      const stops = customGtfs.buildOrderedStopList(['LOCAL', 'SHORT']);

      const stopIds = stops.map(s => s.stop_id);

      // Should have all stops from both trips in correct order
      expect(stopIds).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
    });

    it('should correctly insert intermediate stops', () => {
      const stops = customGtfs.buildOrderedStopList(['LOCAL', 'WITH_X']);

      const stopIds = stops.map(s => s.stop_id);

      // X should appear between B and C
      const xIndex = stopIds.indexOf('X');
      const bIndex = stopIds.indexOf('B');
      const cIndex = stopIds.indexOf('C');

      expect(xIndex).toBeGreaterThan(bIndex);
      expect(xIndex).toBeLessThan(cIndex);

      // Should maintain overall order: A-B-X-C-D-E-F
      expect(stopIds).toEqual(['A', 'B', 'X', 'C', 'D', 'E', 'F']);
    });

    it('should handle all four trips together', () => {
      const stops = customGtfs.buildOrderedStopList(['LOCAL', 'EXPRESS', 'SHORT', 'WITH_X']);

      const stopIds = stops.map(s => s.stop_id);

      // Should have all 7 unique stops in correct order
      expect(stopIds).toEqual(['A', 'B', 'X', 'C', 'D', 'E', 'F']);
    });

    it('should maintain order regardless of trip order', () => {
      // Test with different orderings of the same trips
      const stops1 = customGtfs.buildOrderedStopList(['EXPRESS', 'LOCAL', 'SHORT', 'WITH_X']);
      const stops2 = customGtfs.buildOrderedStopList(['SHORT', 'WITH_X', 'EXPRESS', 'LOCAL']);
      const stops3 = customGtfs.buildOrderedStopList(['WITH_X', 'SHORT', 'LOCAL', 'EXPRESS']);

      const stopIds1 = stops1.map(s => s.stop_id);
      const stopIds2 = stops2.map(s => s.stop_id);
      const stopIds3 = stops3.map(s => s.stop_id);

      // All should produce the same ordering
      expect(stopIds1).toEqual(['A', 'B', 'X', 'C', 'D', 'E', 'F']);
      expect(stopIds2).toEqual(['A', 'B', 'X', 'C', 'D', 'E', 'F']);
      expect(stopIds3).toEqual(['A', 'B', 'X', 'C', 'D', 'E', 'F']);
    });

    it('should return full Stop objects with all properties', () => {
      const stops = customGtfs.buildOrderedStopList(['LOCAL']);

      expect(stops.length).toBe(6);

      stops.forEach((stop, idx) => {
        const expectedId = ['A', 'B', 'C', 'D', 'E', 'F'][idx];
        expect(stop.stop_id).toBe(expectedId);
        expect(stop.stop_name).toBe(`Stop ${expectedId}`);
        expect(typeof stop.stop_lat).toBe('number');
        expect(typeof stop.stop_lon).toBe('number');
      });
    });
  });

  describe('Complex Real-World Pattern', () => {
    let complexGtfs: GtfsSqlJs;

    beforeAll(async () => {
      // Create a more complex scenario mimicking real transit patterns
      const SQL = await initSqlJs();
      const db = new SQL.Database();

      // Create tables
      db.run(`
        CREATE TABLE stops (
          stop_id TEXT PRIMARY KEY,
          stop_name TEXT,
          stop_lat REAL,
          stop_lon REAL
        )
      `);

      db.run(`
        CREATE TABLE trips (
          trip_id TEXT PRIMARY KEY,
          route_id TEXT,
          service_id TEXT
        )
      `);

      db.run(`
        CREATE TABLE stop_times (
          trip_id TEXT,
          stop_id TEXT,
          stop_sequence INTEGER,
          arrival_time TEXT,
          departure_time TEXT
        )
      `);

      // Create 10 stops
      for (let i = 1; i <= 10; i++) {
        db.run(
          'INSERT INTO stops VALUES (?, ?, ?, ?)',
          [`S${i}`, `Stop ${i}`, 40.0 + i * 0.01, -74.0 + i * 0.01]
        );
      }

      // Trip 1: All stops (S1-S10)
      db.run('INSERT INTO trips VALUES (?, ?, ?)', ['T1', 'R1', 'SVC1']);
      for (let i = 1; i <= 10; i++) {
        db.run(
          'INSERT INTO stop_times VALUES (?, ?, ?, ?, ?)',
          ['T1', `S${i}`, i, `08:${String((i - 1) * 5).padStart(2, '0')}:00`, `08:${String((i - 1) * 5).padStart(2, '0')}:00`]
        );
      }

      // Trip 2: Even stops only (S2, S4, S6, S8, S10)
      db.run('INSERT INTO trips VALUES (?, ?, ?)', ['T2', 'R1', 'SVC1']);
      let seq = 1;
      for (let i = 2; i <= 10; i += 2) {
        db.run(
          'INSERT INTO stop_times VALUES (?, ?, ?, ?, ?)',
          ['T2', `S${i}`, seq++, `09:${String((seq - 2) * 10).padStart(2, '0')}:00`, `09:${String((seq - 2) * 10).padStart(2, '0')}:00`]
        );
      }

      // Trip 3: Starts at S3, ends at S7 (S3, S4, S5, S6, S7)
      db.run('INSERT INTO trips VALUES (?, ?, ?)', ['T3', 'R1', 'SVC1']);
      seq = 1;
      for (let i = 3; i <= 7; i++) {
        db.run(
          'INSERT INTO stop_times VALUES (?, ?, ?, ?, ?)',
          ['T3', `S${i}`, seq++, `10:${String((seq - 2) * 10).padStart(2, '0')}:00`, `10:${String((seq - 2) * 10).padStart(2, '0')}:00`]
        );
      }

      // Initialize GtfsSqlJs with the populated database
      complexGtfs = await GtfsSqlJs.fromDatabase(db.export());
    });

    afterAll(() => {
      complexGtfs?.close();
    });

    it('should correctly merge trips with different patterns', () => {
      const stops = complexGtfs.buildOrderedStopList(['T1', 'T2', 'T3']);

      const stopIds = stops.map(s => s.stop_id);

      // Should have all 10 stops in order
      expect(stopIds).toEqual(['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10']);
    });

    it('should handle subset of trips', () => {
      const stops = complexGtfs.buildOrderedStopList(['T2', 'T3']);

      const stopIds = stops.map(s => s.stop_id);

      // T2 has: S2, S4, S6, S8, S10
      // T3 has: S3, S4, S5, S6, S7
      // Both trips share S4, S6
      // Without a trip containing both S2 and S3, their relative order depends on processing order
      // The result should maintain the ordering constraints from each individual trip

      // Verify all expected stops are present
      expect(stopIds).toContain('S2');
      expect(stopIds).toContain('S3');
      expect(stopIds).toContain('S4');
      expect(stopIds).toContain('S5');
      expect(stopIds).toContain('S6');
      expect(stopIds).toContain('S7');
      expect(stopIds).toContain('S8');
      expect(stopIds).toContain('S10');
      expect(stopIds.length).toBe(8);

      // Verify ordering constraints from T2: S2 < S4 < S6 < S8 < S10
      expect(stopIds.indexOf('S2')).toBeLessThan(stopIds.indexOf('S4'));
      expect(stopIds.indexOf('S4')).toBeLessThan(stopIds.indexOf('S6'));
      expect(stopIds.indexOf('S6')).toBeLessThan(stopIds.indexOf('S8'));
      expect(stopIds.indexOf('S8')).toBeLessThan(stopIds.indexOf('S10'));

      // Verify ordering constraints from T3: S3 < S4 < S5 < S6 < S7
      expect(stopIds.indexOf('S3')).toBeLessThan(stopIds.indexOf('S4'));
      expect(stopIds.indexOf('S4')).toBeLessThan(stopIds.indexOf('S5'));
      expect(stopIds.indexOf('S5')).toBeLessThan(stopIds.indexOf('S6'));
      expect(stopIds.indexOf('S6')).toBeLessThan(stopIds.indexOf('S7'));
    });
  });
});
