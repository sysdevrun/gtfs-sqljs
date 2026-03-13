/**
 * Tests for GTFS ZIP export functionality
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import initSqlJs from 'sql.js';
import JSZip from 'jszip';
import Papa from 'papaparse';
import { GtfsSqlJs, type ProgressInfo } from '../src/gtfs-sqljs';
import { createTestDatabase } from './helpers/test-database';

describe('GTFS Export', () => {
  let gtfs: GtfsSqlJs;
  let SQL: Awaited<ReturnType<typeof initSqlJs>>;

  beforeAll(async () => {
    SQL = await initSqlJs();
    const dbBuffer = await createTestDatabase(SQL);
    gtfs = await GtfsSqlJs.fromDatabase(dbBuffer, { SQL });
  });

  afterAll(() => {
    gtfs?.close();
  });

  describe('exportToGtfsZip', () => {
    it('should export to a valid ZIP file', async () => {
      const zipData = await gtfs.exportToGtfsZip();

      expect(zipData).toBeInstanceOf(ArrayBuffer);
      expect(zipData.byteLength).toBeGreaterThan(0);

      // Verify it's a valid ZIP
      const zip = await JSZip.loadAsync(zipData);
      expect(Object.keys(zip.files).length).toBeGreaterThan(0);
    });

    it('should include expected GTFS files', async () => {
      const zipData = await gtfs.exportToGtfsZip();
      const zip = await JSZip.loadAsync(zipData);

      const files = Object.keys(zip.files);

      // Test database has these tables populated
      expect(files).toContain('agency.txt');
      expect(files).toContain('stops.txt');
      expect(files).toContain('routes.txt');
      expect(files).toContain('trips.txt');
      expect(files).toContain('stop_times.txt');
      expect(files).toContain('calendar.txt');
      expect(files).toContain('calendar_dates.txt');
      expect(files).toContain('shapes.txt');
    });

    it('should generate valid parseable CSV content', async () => {
      const zipData = await gtfs.exportToGtfsZip();
      const zip = await JSZip.loadAsync(zipData);

      // Get agency.txt content
      const agencyFile = zip.file('agency.txt');
      expect(agencyFile).not.toBeNull();

      const agencyCsv = await agencyFile!.async('string');
      const parsed = Papa.parse(agencyCsv, { header: true, skipEmptyLines: true });

      expect(parsed.errors.length).toBe(0);
      expect(parsed.data.length).toBe(1);

      const agency = parsed.data[0] as Record<string, string>;
      expect(agency.agency_id).toBe('AGENCY1');
      expect(agency.agency_name).toBe('Test Transit');
    });

    it('should skip empty tables', async () => {
      const zipData = await gtfs.exportToGtfsZip();
      const zip = await JSZip.loadAsync(zipData);

      const files = Object.keys(zip.files);

      // Test database doesn't have these tables populated
      expect(files).not.toContain('fare_attributes.txt');
      expect(files).not.toContain('fare_rules.txt');
      expect(files).not.toContain('frequencies.txt');
      expect(files).not.toContain('transfers.txt');
      expect(files).not.toContain('pathways.txt');
      expect(files).not.toContain('levels.txt');
      expect(files).not.toContain('feed_info.txt');
      expect(files).not.toContain('attributions.txt');
    });

    it('should support selective export via tables option', async () => {
      const zipData = await gtfs.exportToGtfsZip({
        tables: ['agency', 'stops', 'routes'],
      });
      const zip = await JSZip.loadAsync(zipData);

      const files = Object.keys(zip.files);

      expect(files).toContain('agency.txt');
      expect(files).toContain('stops.txt');
      expect(files).toContain('routes.txt');
      expect(files.length).toBe(3);

      // Should not include other tables even if they have data
      expect(files).not.toContain('trips.txt');
      expect(files).not.toContain('stop_times.txt');
    });

    it('should invoke progress callback', async () => {
      const progressUpdates: ProgressInfo[] = [];

      await gtfs.exportToGtfsZip({
        onProgress: (progress) => {
          progressUpdates.push({ ...progress });
        },
      });

      expect(progressUpdates.length).toBeGreaterThan(0);

      // Check that we have exporting_data phase
      const exportingPhases = progressUpdates.filter((p) => p.phase === 'exporting_data');
      expect(exportingPhases.length).toBeGreaterThan(0);

      // Check that we have creating_zip phase
      const zipPhases = progressUpdates.filter((p) => p.phase === 'creating_zip');
      expect(zipPhases.length).toBeGreaterThan(0);

      // Check that we have complete phase
      const completePhase = progressUpdates.find((p) => p.phase === 'complete');
      expect(completePhase).toBeDefined();
      expect(completePhase!.percentComplete).toBe(100);
    });

    it('should round-trip: exported ZIP can be re-imported with data integrity', async () => {
      // Export current database to ZIP
      const zipData = await gtfs.exportToGtfsZip();

      // Re-import the exported ZIP
      const reimportedGtfs = await GtfsSqlJs.fromZipData(zipData, { SQL });

      try {
        // Verify agencies match
        const originalAgencies = gtfs.getAgencies();
        const reimportedAgencies = reimportedGtfs.getAgencies();
        expect(reimportedAgencies.length).toBe(originalAgencies.length);
        expect(reimportedAgencies[0].agency_id).toBe(originalAgencies[0].agency_id);
        expect(reimportedAgencies[0].agency_name).toBe(originalAgencies[0].agency_name);

        // Verify stops match
        const originalStops = gtfs.getStops();
        const reimportedStops = reimportedGtfs.getStops();
        expect(reimportedStops.length).toBe(originalStops.length);

        // Verify routes match
        const originalRoutes = gtfs.getRoutes();
        const reimportedRoutes = reimportedGtfs.getRoutes();
        expect(reimportedRoutes.length).toBe(originalRoutes.length);

        // Verify trips match
        const originalTrips = gtfs.getTrips();
        const reimportedTrips = reimportedGtfs.getTrips();
        expect(reimportedTrips.length).toBe(originalTrips.length);

        // Verify stop times match
        const originalStopTimes = gtfs.getStopTimes();
        const reimportedStopTimes = reimportedGtfs.getStopTimes();
        expect(reimportedStopTimes.length).toBe(originalStopTimes.length);

        // Verify shapes match
        const originalShapes = gtfs.getShapes();
        const reimportedShapes = reimportedGtfs.getShapes();
        expect(reimportedShapes.length).toBe(originalShapes.length);
      } finally {
        reimportedGtfs.close();
      }
    });

    it('should handle CSV special characters correctly', async () => {
      // Create a new database with special characters
      const db = new SQL.Database();

      // Create schema
      db.run(`CREATE TABLE IF NOT EXISTS agency (
        agency_id TEXT PRIMARY KEY,
        agency_name TEXT NOT NULL,
        agency_url TEXT NOT NULL,
        agency_timezone TEXT NOT NULL
      )`);

      // Insert agency with special characters
      db.run(
        'INSERT INTO agency (agency_id, agency_name, agency_url, agency_timezone) VALUES (?, ?, ?, ?)',
        ['AGY1', 'Test "Transit" Agency, Inc.', 'https://example.com', 'America/New_York']
      );

      const data = db.export();
      db.close();

      const specialGtfs = await GtfsSqlJs.fromDatabase(data.buffer, { SQL });

      try {
        const zipData = await specialGtfs.exportToGtfsZip();
        const zip = await JSZip.loadAsync(zipData);

        const agencyFile = zip.file('agency.txt');
        const agencyCsv = await agencyFile!.async('string');
        const parsed = Papa.parse(agencyCsv, { header: true, skipEmptyLines: true });

        expect(parsed.errors.length).toBe(0);
        const agency = parsed.data[0] as Record<string, string>;
        expect(agency.agency_name).toBe('Test "Transit" Agency, Inc.');
      } finally {
        specialGtfs.close();
      }
    });
  });

  describe('getExportableTables', () => {
    it('should return list of exportable table names', () => {
      const tables = GtfsSqlJs.getExportableTables();

      expect(tables).toContain('agency');
      expect(tables).toContain('stops');
      expect(tables).toContain('routes');
      expect(tables).toContain('trips');
      expect(tables).toContain('stop_times');
      expect(tables).toContain('calendar');
      expect(tables).toContain('calendar_dates');
      expect(tables).toContain('fare_attributes');
      expect(tables).toContain('fare_rules');
      expect(tables).toContain('shapes');
      expect(tables).toContain('frequencies');
      expect(tables).toContain('transfers');
      expect(tables).toContain('pathways');
      expect(tables).toContain('levels');
      expect(tables).toContain('feed_info');
      expect(tables).toContain('attributions');

      // Should not include RT tables
      expect(tables).not.toContain('rt_alerts');
      expect(tables).not.toContain('rt_vehicle_positions');
      expect(tables).not.toContain('rt_trip_updates');
    });
  });

  describe('Error handling', () => {
    it('should throw error when database is not initialized', async () => {
      const uninitializedGtfs = new (GtfsSqlJs as unknown as new () => GtfsSqlJs)();

      await expect(uninitializedGtfs.exportToGtfsZip()).rejects.toThrow('Database not initialized');
    });
  });
});
