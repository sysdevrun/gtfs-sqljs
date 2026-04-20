/**
 * Tests for the progress callback emitted during GTFS ingestion.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GtfsSqlJs, type ProgressInfo } from '../src/gtfs-sqljs';
import { createSqlJsAdapter } from '../src/adapters/sql-js';
import path from 'path';
import fs from 'fs/promises';

describe('Progress callback', () => {
  let events: ProgressInfo[];
  let gtfs: GtfsSqlJs;
  let actualRowCount: number;

  beforeAll(async () => {
    const feedPath = path.join(__dirname, 'fixtures', 'sample-feed.zip');
    const zipData = await fs.readFile(feedPath);

    events = [];
    gtfs = await GtfsSqlJs.fromZipData(zipData, {
      adapter: await createSqlJsAdapter(),
      onProgress: (info) => events.push({ ...info }),
    });

    const db = gtfs.getDatabase();
    const tables = [
      'agency',
      'stops',
      'routes',
      'trips',
      'stop_times',
      'calendar',
      'calendar_dates',
      'fare_attributes',
      'fare_rules',
      'shapes',
      'frequencies',
      'transfers',
      'pathways',
      'levels',
      'feed_info',
      'attributions',
    ];
    let total = 0;
    for (const t of tables) {
      const stmt = await db.prepare(`SELECT COUNT(*) AS n FROM ${t}`);
      await stmt.step();
      const row = await stmt.getAsObject();
      total += (row.n as number) || 0;
      await stmt.free();
    }
    actualRowCount = total;
  });

  afterAll(async () => {
    await gtfs?.close();
  });

  it('emits at least one progress event', () => {
    expect(events.length).toBeGreaterThan(0);
  });

  it('reports a totalRows estimate close to the real COUNT(*) sum', () => {
    const loaderEvents = events.filter(
      (e) => e.phase === 'inserting_data' && e.totalRows > 0
    );
    expect(loaderEvents.length).toBeGreaterThan(0);

    const estimates = new Set(loaderEvents.map((e) => e.totalRows));
    expect(estimates.size).toBe(1);

    const estimate = loaderEvents[0].totalRows;
    expect(Math.abs(estimate - actualRowCount)).toBeLessThanOrEqual(20);
  });

  it('keeps percentComplete within [0, 100] for every event', () => {
    for (const e of events) {
      expect(e.percentComplete).toBeGreaterThanOrEqual(0);
      expect(e.percentComplete).toBeLessThanOrEqual(100);
    }
  });

  it('ends with exactly one complete event at 100%', () => {
    const completeEvents = events.filter((e) => e.phase === 'complete');
    expect(completeEvents.length).toBe(1);
    expect(completeEvents[0].percentComplete).toBe(100);
    expect(events[events.length - 1].phase).toBe('complete');
  });

  it('never reports rowsProcessed exceeding the estimate plus the per-file tolerance', () => {
    const ingestEvents = events.filter((e) => e.phase === 'inserting_data');
    for (const e of ingestEvents) {
      expect(e.rowsProcessed).toBeLessThanOrEqual(e.totalRows + 20);
    }
  });
});
