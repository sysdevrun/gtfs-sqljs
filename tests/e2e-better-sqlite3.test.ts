/**
 * End-to-end test exercising a non-sql.js adapter.
 *
 * Loads the sample GTFS feed into a better-sqlite3 database via
 * `GtfsSqlJs.attach()`, runs the same query assertions as the sql.js tests,
 * and verifies the cache layer gracefully no-ops when the adapter's
 * `export()` throws `ExportNotSupportedError`.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import BetterSqlite3 from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { GtfsSqlJs } from '../src/gtfs-sqljs';
import { ExportNotSupportedError } from '../src/adapters/types';
import { loadGTFSZip } from '../src/loaders/zip-loader';
import { loadGTFSData } from '../src/loaders/data-loader';
import { wrapBetterSqlite3 } from './helpers/better-sqlite3-adapter';
import type { CacheMetadata, CacheStore } from '../src/cache/types';

describe('better-sqlite3 adapter — end-to-end', () => {
  let tmpDir: string;
  let dbPath: string;
  let rawDb: BetterSqlite3.Database;
  let gtfs: GtfsSqlJs;

  beforeAll(async () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), 'gtfs-bsqlite3-'));
    dbPath = path.join(tmpDir, 'gtfs.db');
    rawDb = new BetterSqlite3(dbPath);

    const db = wrapBetterSqlite3(rawDb);
    gtfs = await GtfsSqlJs.attach(db);

    // Load sample fixture via the underlying adapter surface — this is the
    // most direct test of the adapter interface.
    const feedPath = path.join(__dirname, 'fixtures', 'sample-feed.zip');
    const zipData = await fs.readFile(feedPath);
    const files = await loadGTFSZip(zipData);
    await loadGTFSData(db, files);
  });

  afterAll(async () => {
    await gtfs?.close();
    // `attach()` without ownsDatabase means we still own rawDb.
    if (rawDb.open) rawDb.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('loads the sample feed and answers the same queries as sql.js', async () => {
    const agencies = await gtfs.getAgencies({ agencyId: 'DTA' });
    expect(agencies.length).toBe(1);
    expect(agencies[0].agency_name).toBe('Demo Transit Authority');

    const stops = await gtfs.getStops();
    expect(stops.length).toBe(9);

    const routes = await gtfs.getRoutes();
    expect(routes.length).toBe(5);

    const ab1 = (await gtfs.getTrips({ tripId: 'AB1' }))[0];
    expect(ab1.route_id).toBe('AB');
    expect(ab1.trip_headsign).toBe('to Bullfrog');

    const stopTimes = await gtfs.getStopTimes({ tripId: 'AB1' });
    expect(stopTimes.length).toBe(2);
    expect(stopTimes[0].stop_id).toBe('BEATTY_AIRPORT');
    expect(stopTimes[1].stop_id).toBe('BULLFROG');
  });

  it('exports succeed on an in-memory DB (better-sqlite3.serialize)', async () => {
    // This same adapter wrapped around an in-memory better-sqlite3 DB must
    // serialize cleanly. We don't call gtfs.export() here because the
    // outer fixture DB is file-backed; we exercise the codepath directly.
    const mem = new BetterSqlite3(':memory:');
    mem.exec('CREATE TABLE x (id INTEGER); INSERT INTO x VALUES (1);');
    const wrapped = wrapBetterSqlite3(mem);
    const bytes = await wrapped.export();
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.byteLength).toBeGreaterThan(0);
    mem.close();
  });

  it('cache layer catches ExportNotSupportedError and does not throw', async () => {
    // A minimal in-memory cache store; we only care that `set()` is not called.
    let setCalls = 0;
    const cache: CacheStore = {
      get: async () => null,
      set: async (_key: string, _data: ArrayBuffer, _metadata: CacheMetadata) => {
        setCalls++;
      },
      delete: async () => { /* noop */ },
      clear: async () => { /* noop */ },
    };

    // Build a fresh wrapped DB that throws from export() on purpose.
    const throwingDb = wrapBetterSqlite3(new BetterSqlite3(':memory:'));
    throwingDb.export = async () => {
      throw new ExportNotSupportedError('simulated file-backed driver');
    };

    // Factory adapter that returns the throwing DB for createEmpty().
    const throwingAdapter = {
      createEmpty: async () => throwingDb,
      openFromBuffer: async () => throwingDb,
    };

    const feedPath = path.join(__dirname, 'fixtures', 'sample-feed.zip');
    const zipData = await fs.readFile(feedPath);

    const instance = await GtfsSqlJs.fromZipData(zipData, {
      adapter: throwingAdapter,
      cache,
    });

    // Cache write should have been skipped (no throw, no call to set).
    expect(setCalls).toBe(0);
    await instance.close();
  });

  it('file remains on disk after close when caller owns the handle', async () => {
    const stat = await fs.stat(dbPath);
    expect(stat.size).toBeGreaterThan(0);
  });
});
