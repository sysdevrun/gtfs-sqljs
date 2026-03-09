/**
 * Tests for getStopTimetable method
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GtfsSqlJs } from '../src/gtfs-sqljs';
import { createTestDatabase } from './helpers/test-database';
import initSqlJs from 'sql.js';

describe('getStopTimetable', () => {
  describe('Using existing test database', () => {
    let gtfs: GtfsSqlJs;

    beforeAll(async () => {
      const SQL = await initSqlJs();
      const dbBuffer = await createTestDatabase(SQL);
      gtfs = await GtfsSqlJs.fromDatabase(dbBuffer, { SQL });
    });

    afterAll(() => {
      gtfs?.close();
    });

    it('should return 3 route groups for STOP1 on a weekday', () => {
      // 20240101 is a Monday → WEEKDAY service
      // TRIP1: ROUTE1/dir0, TRIP2: ROUTE1/dir1, TRIP4: ROUTE2/dir0
      const timetable = gtfs.getStopTimetable({ stopId: 'STOP1', date: '20240101' });

      expect(timetable.stop.stop_id).toBe('STOP1');
      expect(timetable.date).toBe('20240101');
      expect(timetable.routeGroups.length).toBe(3);

      const groupKeys = timetable.routeGroups.map(g => `${g.route.route_id}:${g.directionId}`);
      expect(groupKeys).toContain('ROUTE1:0');
      expect(groupKeys).toContain('ROUTE1:1');
      expect(groupKeys).toContain('ROUTE2:0');
    });

    it('should return 2 route groups for STOP2 on a weekday (TRIP4 skips STOP2)', () => {
      const timetable = gtfs.getStopTimetable({ stopId: 'STOP2', date: '20240101' });

      expect(timetable.routeGroups.length).toBe(2);

      const groupKeys = timetable.routeGroups.map(g => `${g.route.route_id}:${g.directionId}`);
      expect(groupKeys).toContain('ROUTE1:0');
      expect(groupKeys).toContain('ROUTE1:1');
      // ROUTE2:0 should not appear since TRIP4 skips STOP2
      expect(groupKeys).not.toContain('ROUTE2:0');
    });

    it('should filter by routeId', () => {
      const timetable = gtfs.getStopTimetable({ stopId: 'STOP1', date: '20240101', routeId: 'ROUTE1' });

      expect(timetable.routeGroups.length).toBe(2);
      expect(timetable.routeGroups.every(g => g.route.route_id === 'ROUTE1')).toBe(true);
    });

    it('should filter by directionId', () => {
      const timetable = gtfs.getStopTimetable({ stopId: 'STOP1', date: '20240101', directionId: 0 });

      expect(timetable.routeGroups.length).toBe(2);
      expect(timetable.routeGroups.every(g => g.directionId === 0)).toBe(true);
    });

    it('should filter by routeId and directionId', () => {
      const timetable = gtfs.getStopTimetable({ stopId: 'STOP1', date: '20240101', routeId: 'ROUTE1', directionId: 0 });

      expect(timetable.routeGroups.length).toBe(1);
      expect(timetable.routeGroups[0].route.route_id).toBe('ROUTE1');
      expect(timetable.routeGroups[0].directionId).toBe(0);
    });

    it('should throw for non-existent stop', () => {
      expect(() => gtfs.getStopTimetable({ stopId: 'NONEXISTENT', date: '20240101' }))
        .toThrow('Stop not found: NONEXISTENT');
    });

    it('should return empty routeGroups for date with no service', () => {
      const timetable = gtfs.getStopTimetable({ stopId: 'STOP1', date: '21000101' });

      expect(timetable.stop.stop_id).toBe('STOP1');
      expect(timetable.routeGroups).toEqual([]);
    });

    it('should return empty routeGroups for weekend date at weekday-only stop', () => {
      // 20240106 is a Saturday → WEEKEND service → only TRIP3 (ROUTE1/dir0)
      const timetable = gtfs.getStopTimetable({ stopId: 'STOP1', date: '20240106' });

      expect(timetable.routeGroups.length).toBe(1);
      expect(timetable.routeGroups[0].route.route_id).toBe('ROUTE1');
      expect(timetable.routeGroups[0].trips.length).toBe(1);
    });
  });

  describe('Custom database — structural validation', () => {
    let gtfs: GtfsSqlJs;

    beforeAll(async () => {
      const SQL = await initSqlJs();
      const db = new SQL.Database();

      // Create tables
      db.run(`CREATE TABLE agency (agency_id TEXT PRIMARY KEY, agency_name TEXT, agency_url TEXT, agency_timezone TEXT)`);
      db.run(`CREATE TABLE stops (stop_id TEXT PRIMARY KEY, stop_name TEXT, stop_lat REAL, stop_lon REAL)`);
      db.run(`CREATE TABLE routes (route_id TEXT PRIMARY KEY, agency_id TEXT, route_short_name TEXT, route_long_name TEXT, route_type INTEGER, route_sort_order INTEGER)`);
      db.run(`CREATE TABLE trips (trip_id TEXT PRIMARY KEY, route_id TEXT, service_id TEXT, direction_id INTEGER, trip_headsign TEXT)`);
      db.run(`CREATE TABLE stop_times (trip_id TEXT, stop_id TEXT, stop_sequence INTEGER, arrival_time TEXT, departure_time TEXT)`);
      db.run(`CREATE TABLE calendar (service_id TEXT PRIMARY KEY, monday INTEGER, tuesday INTEGER, wednesday INTEGER, thursday INTEGER, friday INTEGER, saturday INTEGER, sunday INTEGER, start_date TEXT, end_date TEXT)`);
      db.run(`CREATE TABLE calendar_dates (service_id TEXT, date TEXT, exception_type INTEGER)`);

      // Agency
      db.run(`INSERT INTO agency VALUES ('A1', 'Test Agency', 'http://test.com', 'America/New_York')`);

      // Stops: S1 through S5
      for (let i = 1; i <= 5; i++) {
        db.run('INSERT INTO stops VALUES (?, ?, ?, ?)', [`S${i}`, `Stop ${i}`, 40.0 + i * 0.01, -74.0 + i * 0.01]);
      }

      // Routes
      db.run('INSERT INTO routes VALUES (?, ?, ?, ?, ?, ?)', ['R_BLUE', 'A1', 'B', 'Blue Line', 3, 2]);
      db.run('INSERT INTO routes VALUES (?, ?, ?, ?, ?, ?)', ['R_RED', 'A1', 'R', 'Red Line', 3, 1]);

      // Calendar: weekday service
      db.run('INSERT INTO calendar VALUES (?, 1,1,1,1,1, 0,0, ?, ?)', ['WK', '20240101', '20251231']);

      // --- RED LINE trips (dir 0): S1→S2→S3→S4→S5 ---
      // Local trip 1
      db.run('INSERT INTO trips VALUES (?, ?, ?, ?, ?)', ['RED_L1', 'R_RED', 'WK', 0, 'Downtown']);
      ['S1','S2','S3','S4','S5'].forEach((s, i) => {
        const min = String(i * 5).padStart(2, '0');
        db.run('INSERT INTO stop_times VALUES (?, ?, ?, ?, ?)', ['RED_L1', s, i+1, `08:${min}:00`, `08:${min}:00`]);
      });

      // Local trip 2
      db.run('INSERT INTO trips VALUES (?, ?, ?, ?, ?)', ['RED_L2', 'R_RED', 'WK', 0, 'Downtown']);
      ['S1','S2','S3','S4','S5'].forEach((s, i) => {
        const min = String(30 + i * 5).padStart(2, '0');
        db.run('INSERT INTO stop_times VALUES (?, ?, ?, ?, ?)', ['RED_L2', s, i+1, `08:${min}:00`, `08:${min}:00`]);
      });

      // Express trip (skips S2, S4)
      db.run('INSERT INTO trips VALUES (?, ?, ?, ?, ?)', ['RED_EX', 'R_RED', 'WK', 0, 'Downtown Express']);
      [['S1', 1, '08:15:00'], ['S3', 2, '08:22:00'], ['S5', 3, '08:28:00']].forEach(([s, seq, time]) => {
        db.run('INSERT INTO stop_times VALUES (?, ?, ?, ?, ?)', ['RED_EX', s, seq, time, time]);
      });

      // --- RED LINE trip (dir 1): S5→S4→S3→S2→S1 ---
      db.run('INSERT INTO trips VALUES (?, ?, ?, ?, ?)', ['RED_R1', 'R_RED', 'WK', 1, 'Uptown']);
      ['S5','S4','S3','S2','S1'].forEach((s, i) => {
        const min = String(i * 5).padStart(2, '0');
        db.run('INSERT INTO stop_times VALUES (?, ?, ?, ?, ?)', ['RED_R1', s, i+1, `09:${min}:00`, `09:${min}:00`]);
      });

      // --- BLUE LINE trip (dir 0): S1→S3→S5 ---
      db.run('INSERT INTO trips VALUES (?, ?, ?, ?, ?)', ['BLUE_1', 'R_BLUE', 'WK', 0, 'Crosstown']);
      [['S1', 1, '07:00:00'], ['S3', 2, '07:10:00'], ['S5', 3, '07:20:00']].forEach(([s, seq, time]) => {
        db.run('INSERT INTO stop_times VALUES (?, ?, ?, ?, ?)', ['BLUE_1', s, seq, time, time]);
      });

      // Trip with >24h time (overnight)
      db.run('INSERT INTO trips VALUES (?, ?, ?, ?, ?)', ['RED_LATE', 'R_RED', 'WK', 0, 'Downtown']);
      ['S1','S2','S3','S4','S5'].forEach((s, i) => {
        const hour = 25 + Math.floor(i * 5 / 60);
        const min = String((i * 5) % 60).padStart(2, '0');
        db.run('INSERT INTO stop_times VALUES (?, ?, ?, ?, ?)', ['RED_LATE', s, i+1, `${hour}:${min}:00`, `${hour}:${min}:00`]);
      });

      gtfs = await GtfsSqlJs.fromDatabase(db.export());
    });

    afterAll(() => {
      gtfs?.close();
    });

    it('should have correct queriedStopIndex', () => {
      // Query for S3 — in RED dir 0, orderedStops should be S1,S2,S3,S4,S5
      const timetable = gtfs.getStopTimetable({ stopId: 'S3', date: '20240101', routeId: 'R_RED', directionId: 0 });

      expect(timetable.routeGroups.length).toBe(1);
      const group = timetable.routeGroups[0];
      const stopIds = group.orderedStops.map(s => s.stop_id);
      expect(stopIds).toEqual(['S1', 'S2', 'S3', 'S4', 'S5']);
      expect(group.queriedStopIndex).toBe(2); // S3 is at index 2
    });

    it('should have null entries for skipped stops in express trips', () => {
      const timetable = gtfs.getStopTimetable({ stopId: 'S1', date: '20240101', routeId: 'R_RED', directionId: 0 });
      const group = timetable.routeGroups[0];

      // Find the express trip
      const expressTwst = group.trips.find(t => t.trip.trip_id === 'RED_EX');
      expect(expressTwst).toBeDefined();

      const stopIds = group.orderedStops.map(s => s.stop_id);
      const s2Index = stopIds.indexOf('S2');
      const s4Index = stopIds.indexOf('S4');

      // Express skips S2 and S4 → those should be null
      expect(expressTwst!.stopTimes[s2Index]).toBeNull();
      expect(expressTwst!.stopTimes[s4Index]).toBeNull();

      // S1, S3, S5 should not be null
      const s1Index = stopIds.indexOf('S1');
      const s3Index = stopIds.indexOf('S3');
      const s5Index = stopIds.indexOf('S5');
      expect(expressTwst!.stopTimes[s1Index]).not.toBeNull();
      expect(expressTwst!.stopTimes[s3Index]).not.toBeNull();
      expect(expressTwst!.stopTimes[s5Index]).not.toBeNull();
    });

    it('should sort trips by departure time at queried stop', () => {
      const timetable = gtfs.getStopTimetable({ stopId: 'S1', date: '20240101', routeId: 'R_RED', directionId: 0 });
      const group = timetable.routeGroups[0];

      const departureTimes = group.trips.map(t => {
        const st = t.stopTimes[group.queriedStopIndex];
        return st?.departure_time ?? null;
      });

      // RED_L1 departs S1 at 08:00, RED_EX at 08:15, RED_L2 at 08:30, RED_LATE at 25:00
      expect(departureTimes).toEqual(['08:00:00', '08:15:00', '08:30:00', '25:00:00']);
    });

    it('should determine headsign as most common trip_headsign', () => {
      // RED dir 0 has: RED_L1 "Downtown", RED_L2 "Downtown", RED_EX "Downtown Express", RED_LATE "Downtown"
      // "Downtown" appears 3 times, "Downtown Express" 1 time
      const timetable = gtfs.getStopTimetable({ stopId: 'S1', date: '20240101', routeId: 'R_RED', directionId: 0 });
      expect(timetable.routeGroups[0].headsign).toBe('Downtown');
    });

    it('should give each (route_id, direction_id) its own group', () => {
      // S3 is served by RED dir 0, RED dir 1, and BLUE dir 0
      const timetable = gtfs.getStopTimetable({ stopId: 'S3', date: '20240101' });

      const groupKeys = timetable.routeGroups.map(g => `${g.route.route_id}:${g.directionId}`);
      expect(groupKeys).toContain('R_RED:0');
      expect(groupKeys).toContain('R_RED:1');
      expect(groupKeys).toContain('R_BLUE:0');
      expect(timetable.routeGroups.length).toBe(3);
    });

    it('should sort routeGroups by route_sort_order then directionId', () => {
      // R_RED has sort_order 1, R_BLUE has sort_order 2
      const timetable = gtfs.getStopTimetable({ stopId: 'S3', date: '20240101' });

      expect(timetable.routeGroups[0].route.route_id).toBe('R_RED');
      expect(timetable.routeGroups[0].directionId).toBe(0);
      expect(timetable.routeGroups[1].route.route_id).toBe('R_RED');
      expect(timetable.routeGroups[1].directionId).toBe(1);
      expect(timetable.routeGroups[2].route.route_id).toBe('R_BLUE');
      expect(timetable.routeGroups[2].directionId).toBe(0);
    });

    it('should handle >24h times correctly in sorting', () => {
      const timetable = gtfs.getStopTimetable({ stopId: 'S1', date: '20240101', routeId: 'R_RED', directionId: 0 });
      const group = timetable.routeGroups[0];

      // RED_LATE departs at 25:00:00 — should be last
      const lastTrip = group.trips[group.trips.length - 1];
      expect(lastTrip.trip.trip_id).toBe('RED_LATE');
    });

    it('should handle routeId filter as array', () => {
      const timetable = gtfs.getStopTimetable({ stopId: 'S1', date: '20240101', routeId: ['R_RED'] });
      expect(timetable.routeGroups.every(g => g.route.route_id === 'R_RED')).toBe(true);
    });

    it('should have stopTimes parallel to orderedStops', () => {
      const timetable = gtfs.getStopTimetable({ stopId: 'S1', date: '20240101', routeId: 'R_RED', directionId: 0 });
      const group = timetable.routeGroups[0];

      for (const twst of group.trips) {
        expect(twst.stopTimes.length).toBe(group.orderedStops.length);

        // Each non-null entry should match the corresponding stop
        twst.stopTimes.forEach((st, i) => {
          if (st !== null) {
            expect(st.stop_id).toBe(group.orderedStops[i].stop_id);
          }
        });
      }
    });
  });
});
