/**
 * Tests for buildOrderedStopList method
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GtfsSqlJs } from '../src/gtfs-sqljs';
import { createSqlJsAdapter } from '../src/adapters/sql-js';
import path from 'path';
import fs from 'fs/promises';
import initSqlJs from 'sql.js';

describe('buildOrderedStopList', () => {
  let gtfs: GtfsSqlJs;

  beforeAll(async () => {
    // Load the sample GTFS feed
    const feedPath = path.join(__dirname, 'fixtures', 'sample-feed.zip');
    const zipData = await fs.readFile(feedPath);
    gtfs = await GtfsSqlJs.fromZipData(zipData, {
      adapter: await createSqlJsAdapter(),
    });
  });

  afterAll(async () => {
    await gtfs?.close();
  });

  describe('Edge Cases', () => {
    it('should return empty array for empty trip list', async () => {
      const stops = await gtfs.buildOrderedStopList([]);
      expect(stops).toEqual([]);
    });

    it('should return empty array for non-existent trip IDs', async () => {
      const stops = await gtfs.buildOrderedStopList(['NONEXISTENT_TRIP']);
      expect(stops).toEqual([]);
    });

    it('should handle single trip', async () => {
      const stops = await gtfs.buildOrderedStopList(['AB1']);

      expect(stops.length).toBe(2);
      expect(stops[0].stop_id).toBe('BEATTY_AIRPORT');
      expect(stops[1].stop_id).toBe('BULLFROG');
    });
  });

  describe('Simple Cases - Same Route Same Direction', () => {
    it('should handle two trips with identical stop sequences', async () => {
      // Get trips for route CITY going in direction 0
      const trips = await gtfs.getTrips({ routeId: 'CITY', directionId: 0 });
      const tripIds = trips.map(t => t.trip_id);

      // Build ordered stop list
      const stops = await gtfs.buildOrderedStopList(tripIds);

      // Verify we get all unique stops
      expect(stops.length).toBeGreaterThan(0);

      // Verify all stops are unique
      const stopIds = stops.map(s => s.stop_id);
      const uniqueStopIds = [...new Set(stopIds)];
      expect(stopIds.length).toBe(uniqueStopIds.length);

      // Verify stops are in a valid order
      for (const tripId of tripIds) {
        const tripStops = await gtfs.getStops({ tripId });
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
    it('should handle route AB (both directions)', async () => {
      const trips = await gtfs.getTrips({ routeId: 'AB' });
      const tripIds = trips.map(t => t.trip_id);

      const stops = await gtfs.buildOrderedStopList(tripIds);

      expect(stops.length).toBe(2);

      const stopIds = stops.map(s => s.stop_id);
      expect(stopIds).toContain('BEATTY_AIRPORT');
      expect(stopIds).toContain('BULLFROG');
    });

    it('should handle route CITY trips', async () => {
      const trips = await gtfs.getTrips({ routeId: 'CITY' });
      const tripIds = trips.map(t => t.trip_id);

      const stops = await gtfs.buildOrderedStopList(tripIds);

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

    it('should maintain correct ordering for CITY route direction 0', async () => {
      const trips = await gtfs.getTrips({ routeId: 'CITY', directionId: 0 });
      const tripIds = trips.map(t => t.trip_id);

      const stops = await gtfs.buildOrderedStopList(tripIds);

      // Get stops for first trip to compare
      const firstTripStops = await gtfs.getStops({ tripId: tripIds[0] });
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

      customGtfs = await GtfsSqlJs.fromDatabase(db.export().buffer, {
        adapter: await createSqlJsAdapter({ SQL }),
      });
    });

    afterAll(async () => {
      await customGtfs?.close();
    });

    it('should merge local and express trips correctly', async () => {
      const stops = await customGtfs.buildOrderedStopList(['LOCAL', 'EXPRESS']);

      const stopIds = stops.map(s => s.stop_id);

      // Should have all 6 stops
      expect(stopIds).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
    });

    it('should handle trips with different start/end points', async () => {
      const stops = await customGtfs.buildOrderedStopList(['LOCAL', 'SHORT']);

      const stopIds = stops.map(s => s.stop_id);

      expect(stopIds).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
    });

    it('should correctly insert intermediate stops', async () => {
      const stops = await customGtfs.buildOrderedStopList(['LOCAL', 'WITH_X']);

      const stopIds = stops.map(s => s.stop_id);

      const xIndex = stopIds.indexOf('X');
      const bIndex = stopIds.indexOf('B');
      const cIndex = stopIds.indexOf('C');

      expect(xIndex).toBeGreaterThan(bIndex);
      expect(xIndex).toBeLessThan(cIndex);

      expect(stopIds).toEqual(['A', 'B', 'X', 'C', 'D', 'E', 'F']);
    });

    it('should handle all four trips together', async () => {
      const stops = await customGtfs.buildOrderedStopList(['LOCAL', 'EXPRESS', 'SHORT', 'WITH_X']);

      const stopIds = stops.map(s => s.stop_id);

      expect(stopIds).toEqual(['A', 'B', 'X', 'C', 'D', 'E', 'F']);
    });

    it('should maintain order regardless of trip order', async () => {
      const stops1 = await customGtfs.buildOrderedStopList(['EXPRESS', 'LOCAL', 'SHORT', 'WITH_X']);
      const stops2 = await customGtfs.buildOrderedStopList(['SHORT', 'WITH_X', 'EXPRESS', 'LOCAL']);
      const stops3 = await customGtfs.buildOrderedStopList(['WITH_X', 'SHORT', 'LOCAL', 'EXPRESS']);

      const stopIds1 = stops1.map(s => s.stop_id);
      const stopIds2 = stops2.map(s => s.stop_id);
      const stopIds3 = stops3.map(s => s.stop_id);

      expect(stopIds1).toEqual(['A', 'B', 'X', 'C', 'D', 'E', 'F']);
      expect(stopIds2).toEqual(['A', 'B', 'X', 'C', 'D', 'E', 'F']);
      expect(stopIds3).toEqual(['A', 'B', 'X', 'C', 'D', 'E', 'F']);
    });

    it('should return full Stop objects with all properties', async () => {
      const stops = await customGtfs.buildOrderedStopList(['LOCAL']);

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

      complexGtfs = await GtfsSqlJs.fromDatabase(db.export().buffer, {
        adapter: await createSqlJsAdapter({ SQL }),
      });
    });

    afterAll(async () => {
      await complexGtfs?.close();
    });

    it('should correctly merge trips with different patterns', async () => {
      const stops = await complexGtfs.buildOrderedStopList(['T1', 'T2', 'T3']);

      const stopIds = stops.map(s => s.stop_id);

      expect(stopIds).toEqual(['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10']);
    });

    it('should handle subset of trips', async () => {
      const stops = await complexGtfs.buildOrderedStopList(['T2', 'T3']);

      const stopIds = stops.map(s => s.stop_id);

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
