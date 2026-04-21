/**
 * Tests for buildGraph method
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GtfsSqlJs } from '../src/gtfs-sqljs';
import { createSqlJsAdapter } from '../src/adapters/sql-js';
import { edgeCount, edges } from '../src/queries/graph';
import path from 'path';
import fs from 'fs/promises';
import initSqlJs from 'sql.js';

describe('buildGraph', () => {
  let gtfs: GtfsSqlJs;

  beforeAll(async () => {
    const feedPath = path.join(__dirname, 'fixtures', 'sample-feed.zip');
    const zipData = await fs.readFile(feedPath);
    gtfs = await GtfsSqlJs.fromZipData(zipData, {
      adapter: await createSqlJsAdapter(),
    });
  });

  afterAll(async () => {
    await gtfs?.close();
  });

  describe('Edge cases', () => {
    it('returns empty graph for empty trip list', async () => {
      const graph = await gtfs.buildGraph([]);
      expect(graph.size).toBe(0);
      expect(edgeCount(graph)).toBe(0);
    });

    it('returns empty graph for non-existent trip ids', async () => {
      const graph = await gtfs.buildGraph(['NONEXISTENT_TRIP']);
      expect(graph.size).toBe(0);
    });

    it('handles a single trip', async () => {
      const graph = await gtfs.buildGraph(['AB1']);

      // AB1: BEATTY_AIRPORT -> BULLFROG (single directed edge)
      expect(edgeCount(graph)).toBe(1);
      const inner = graph.get('BEATTY_AIRPORT');
      expect(inner).toBeDefined();
      expect(inner!.get('BULLFROG')).toBeDefined();
      expect(inner!.get('BULLFROG')!.trips).toHaveLength(1);
      expect(inner!.get('BULLFROG')!.trips[0]).toEqual({
        tripId: 'AB1',
        routeId: 'AB',
        directionId: 0,
      });
    });
  });

  describe('Directionality', () => {
    it('keeps A->B and B->A as separate edges when both directions run', async () => {
      const trips = await gtfs.getTrips({ routeId: 'AB' });
      const graph = await gtfs.buildGraph(trips.map((t) => t.trip_id));

      // Two directed edges total: AIRPORT->BULLFROG and BULLFROG->AIRPORT
      expect(edgeCount(graph)).toBe(2);

      const forward = graph.get('BEATTY_AIRPORT')?.get('BULLFROG');
      const backward = graph.get('BULLFROG')?.get('BEATTY_AIRPORT');
      expect(forward).toBeDefined();
      expect(backward).toBeDefined();

      // Each edge carries one trip, with its own direction_id
      expect(forward!.trips.map((t) => t.directionId)).toEqual([0]);
      expect(backward!.trips.map((t) => t.directionId)).toEqual([1]);
    });
  });

  describe('Custom scenarios', () => {
    let customGtfs: GtfsSqlJs;

    beforeAll(async () => {
      const SQL = await initSqlJs();
      const db = new SQL.Database();

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
          service_id TEXT,
          direction_id INTEGER
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

      for (const s of ['A', 'B', 'C', 'D']) {
        db.run('INSERT INTO stops VALUES (?, ?, ?, ?)', [s, `Stop ${s}`, 0, 0]);
      }

      // Trip T1: A -> B -> C with non-contiguous stop_sequence (1, 5, 10)
      db.run('INSERT INTO trips VALUES (?, ?, ?, ?)', ['T1', 'R1', 'SVC1', 0]);
      const t1 = [
        ['A', 1],
        ['B', 5],
        ['C', 10],
      ] as const;
      for (const [stop, seq] of t1) {
        db.run('INSERT INTO stop_times VALUES (?, ?, ?, ?, ?)', [
          'T1',
          stop,
          seq,
          '00:00:00',
          '00:00:00',
        ]);
      }

      // Trip T2: same path A -> B -> C, different route, direction 0
      db.run('INSERT INTO trips VALUES (?, ?, ?, ?)', ['T2', 'R2', 'SVC1', 0]);
      ['A', 'B', 'C'].forEach((stop, i) => {
        db.run('INSERT INTO stop_times VALUES (?, ?, ?, ?, ?)', [
          'T2',
          stop,
          i + 1,
          '00:00:00',
          '00:00:00',
        ]);
      });

      // Trip T3: reverse C -> B -> A, direction 1
      db.run('INSERT INTO trips VALUES (?, ?, ?, ?)', ['T3', 'R1', 'SVC1', 1]);
      ['C', 'B', 'A'].forEach((stop, i) => {
        db.run('INSERT INTO stop_times VALUES (?, ?, ?, ?, ?)', [
          'T3',
          stop,
          i + 1,
          '00:00:00',
          '00:00:00',
        ]);
      });

      // Trip T4 (loop): A -> B -> C -> B -> D, traverses B<->C twice-ish
      db.run('INSERT INTO trips VALUES (?, ?, ?, ?)', ['T4', 'R3', 'SVC1', 0]);
      ['A', 'B', 'C', 'B', 'D'].forEach((stop, i) => {
        db.run('INSERT INTO stop_times VALUES (?, ?, ?, ?, ?)', [
          'T4',
          stop,
          i + 1,
          '00:00:00',
          '00:00:00',
        ]);
      });

      customGtfs = await GtfsSqlJs.fromDatabase(db.export().buffer, {
        adapter: await createSqlJsAdapter({ SQL }),
      });
    });

    afterAll(async () => {
      await customGtfs?.close();
    });

    it('pairs consecutive stops correctly with non-contiguous stop_sequence', async () => {
      const graph = await customGtfs.buildGraph(['T1']);

      // A->B and B->C (no A->C, despite sequences being 1 and 10)
      expect(edgeCount(graph)).toBe(2);
      expect(graph.get('A')?.get('B')).toBeDefined();
      expect(graph.get('B')?.get('C')).toBeDefined();
      expect(graph.get('A')?.get('C')).toBeUndefined();
    });

    it('deduplicates edges shared across trips and accumulates trips[]', async () => {
      const graph = await customGtfs.buildGraph(['T1', 'T2']);

      // T1 and T2 share A->B and B->C; each edge should list both trips
      expect(edgeCount(graph)).toBe(2);
      const ab = graph.get('A')!.get('B')!;
      const bc = graph.get('B')!.get('C')!;

      expect(ab.trips.map((t) => t.tripId).sort()).toEqual(['T1', 'T2']);
      expect(bc.trips.map((t) => t.tripId).sort()).toEqual(['T1', 'T2']);

      expect(ab.trips.find((t) => t.tripId === 'T1')?.routeId).toBe('R1');
      expect(ab.trips.find((t) => t.tripId === 'T2')?.routeId).toBe('R2');
    });

    it('treats opposite directions as distinct edges', async () => {
      const graph = await customGtfs.buildGraph(['T1', 'T3']);

      // T1: A->B, B->C; T3: C->B, B->A
      expect(edgeCount(graph)).toBe(4);

      expect(graph.get('A')?.get('B')?.trips[0].directionId).toBe(0);
      expect(graph.get('B')?.get('A')?.trips[0].directionId).toBe(1);
      expect(graph.get('B')?.get('C')?.trips[0].directionId).toBe(0);
      expect(graph.get('C')?.get('B')?.trips[0].directionId).toBe(1);
    });

    it('filters strictly by the supplied trip ids', async () => {
      const onlyT2 = await customGtfs.buildGraph(['T2']);
      expect(edgeCount(onlyT2)).toBe(2);
      for (const { data } of edges(onlyT2)) {
        expect(data.trips.every((t) => t.tripId === 'T2')).toBe(true);
      }

      // T3 alone must not leak any forward-direction edges
      const onlyT3 = await customGtfs.buildGraph(['T3']);
      expect(edgeCount(onlyT3)).toBe(2);
      expect(onlyT3.get('A')?.get('B')).toBeUndefined();
      expect(onlyT3.get('B')?.get('A')).toBeDefined();
    });

    it('records a loop trip traversing an edge twice as two entries', async () => {
      const graph = await customGtfs.buildGraph(['T4']);

      // Unique edges: A->B, B->C, C->B, B->D
      expect(edgeCount(graph)).toBe(4);

      // B->C and C->B each traversed once within the same trip
      expect(graph.get('B')!.get('C')!.trips).toHaveLength(1);
      expect(graph.get('C')!.get('B')!.trips).toHaveLength(1);

      // B appears as source twice in the trip (-> C, then -> D)
      const fromB = graph.get('B')!;
      expect(fromB.size).toBe(2);
      expect(fromB.get('D')!.trips[0].tripId).toBe('T4');
    });
  });

  describe('edges() helper', () => {
    it('yields every (from, to, data) once', async () => {
      const graph = await gtfs.buildGraph(['AB1', 'AB2']);
      const collected = [...edges(graph)];
      expect(collected).toHaveLength(edgeCount(graph));
      const pairs = collected.map((e) => `${e.from}->${e.to}`).sort();
      expect(pairs).toEqual(['BEATTY_AIRPORT->BULLFROG', 'BULLFROG->BEATTY_AIRPORT']);
    });
  });
});
