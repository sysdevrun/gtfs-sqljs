/**
 * Main GtfsSqlJs Class
 */

import { getAllCreateTableStatements, getAllCreateIndexStatements } from './schema/schema';
import { loadGTFSZip, fetchZip } from './loaders/zip-loader';
import { loadGTFSData } from './loaders/data-loader';
import { createRealtimeTables, clearRealtimeData as clearRTData } from './schema/gtfs-rt-schema';
import { loadRealtimeData, loadRealtimeDataFromBuffers } from './loaders/gtfs-rt-loader';
import type { CacheStore } from './cache/types';
import { computeZipChecksum, generateCacheKey } from './cache/checksum';
import { DEFAULT_CACHE_EXPIRATION_MS, isCacheExpired } from './cache/utils';
import type { GtfsDatabase, GtfsDatabaseAdapter } from './adapters/types';
import { ExportNotSupportedError } from './adapters/types';

// Library version from package.json
const LIB_VERSION = '0.1.0';

// Query methods
import { getAgencies, type AgencyFilters } from './queries/agencies';
import { getStops, type StopFilters } from './queries/stops';
import { getRoutes, type RouteFilters } from './queries/routes';
import {
  getActiveServiceIds,
  getCalendarByServiceId,
  getCalendarDates,
  getCalendarDatesForDate,
} from './queries/calendar';
import { getTrips, type TripFilters, type TripWithRealtime } from './queries/trips';
import { getStopTimes, buildOrderedStopList, type StopTimeFilters, type StopTimeWithRealtime } from './queries/stop-times';
import { getShapes, getShapesToGeojson, type ShapeFilters, type GeoJsonFeatureCollection } from './queries/shapes';
import { getAlerts as getAlertsQuery, getAllAlerts, type AlertFilters } from './queries/rt-alerts';
import { getVehiclePositions as getVehiclePositionsQuery, getAllVehiclePositions, type VehiclePositionFilters } from './queries/rt-vehicle-positions';
import { getTripUpdates, getAllTripUpdates, type TripUpdateFilters } from './queries/rt-trip-updates';
import { getStopTimeUpdates, getAllStopTimeUpdates, type StopTimeUpdateFilters } from './queries/rt-stop-time-updates';

// Types
import type { Agency, Stop, Route, Trip, StopTime, Calendar, CalendarDate, Shape } from './types/gtfs';
import type { Alert, VehiclePosition, TripUpdate, StopTimeUpdate } from './types/gtfs-rt';

// Export filter types for users
export type { AgencyFilters, StopFilters, RouteFilters, TripFilters, StopTimeFilters, ShapeFilters, AlertFilters, VehiclePositionFilters, TripUpdateFilters, StopTimeUpdateFilters };
// Export RT types
export type { Alert, VehiclePosition, TripUpdate, TripWithRealtime, StopTimeWithRealtime };
// Export GeoJSON types
export type { GeoJsonFeatureCollection };

/**
 * Progress information for GTFS data loading
 */
export interface ProgressInfo {
  phase: 'checking_cache' | 'loading_from_cache' | 'downloading' | 'extracting' | 'creating_schema' | 'inserting_data' | 'creating_indexes' | 'analyzing' | 'loading_realtime' | 'saving_cache' | 'complete';
  currentFile: string | null;
  filesCompleted: number;
  totalFiles: number;
  rowsProcessed: number;
  /**
   * Estimated total row count across all GTFS files being loaded.
   *
   * During `inserting_data` this value is a fast newline-based estimate
   * (typically exact, but may differ by a few rows per file in edge cases
   * such as trailing blank lines). For a precise post-ingest row count,
   * query the database directly with `COUNT(*)`.
   */
  totalRows: number;
  bytesDownloaded?: number;  // Bytes downloaded (used during 'downloading' phase)
  totalBytes?: number;        // Total bytes to download (used during 'downloading' phase)
  percentComplete: number; // 0-100
  message: string;
}

/**
 * Progress callback function type
 */
export type ProgressCallback = (progress: ProgressInfo) => void;

export interface GtfsSqlJsOptions {
  /**
   * Path or URL to GTFS ZIP file
   */
  zipPath?: string;

  /**
   * Pre-loaded SQLite database as ArrayBuffer
   */
  database?: ArrayBuffer;

  /**
   * Required: database adapter factory. Use `createSqlJsAdapter()` from
   * `gtfs-sqljs/adapters/sql-js` for the browser/Node sql.js path, or plug
   * in a custom adapter (op-sqlite, expo-sqlite, better-sqlite3, …).
   */
  adapter: GtfsDatabaseAdapter;

  /**
   * Optional: Array of GTFS filenames to skip importing (e.g., ['shapes.txt'])
   * Tables will be created but no data will be imported for these files
   */
  skipFiles?: string[];

  /**
   * Optional: Array of GTFS-RT feed URLs for realtime data
   */
  realtimeFeedUrls?: string[];

  /**
   * Optional: Staleness threshold in seconds (default: 120)
   * Realtime data older than this will be excluded from queries
   */
  stalenessThreshold?: number;

  /**
   * Optional: Progress callback for tracking load progress
   * Useful for displaying progress in UI or web workers
   */
  onProgress?: ProgressCallback;

  /**
   * Optional: Cache store for persisting processed GTFS databases
   * Implement your own CacheStore or copy one from examples/cache/:
   * - IndexedDBCacheStore (browser)
   * - FileSystemCacheStore (Node.js only)
   *
   * If not provided, caching is disabled.
   */
  cache?: CacheStore | null;

  /**
   * Optional: Data version string
   * When changed, cached databases are invalidated and reprocessed
   * Default: '1.0'
   */
  cacheVersion?: string;

  /**
   * Optional: Cache expiration time in milliseconds
   * Cached databases older than this will be invalidated
   * Default: 7 days (604800000 ms)
   */
  cacheExpirationMs?: number;
}

/**
 * Options for `GtfsSqlJs.attach()` — when the caller already has a live DB handle.
 */
export interface GtfsSqlJsAttachOptions {
  /**
   * When `true`, assume the GTFS schema already exists in the attached DB
   * and skip the `CREATE TABLE IF NOT EXISTS` DDL. Defaults to `false`:
   * the library runs the idempotent schema DDL so that attaching to a fresh
   * empty DB still works.
   */
  skipSchema?: boolean;

  /**
   * When `true`, `GtfsSqlJs.close()` will also close the underlying adapter
   * handle. Defaults to `false` — callers retain ownership of handles they
   * passed in via `attach()`.
   */
  ownsDatabase?: boolean;

  /** Optional: Array of GTFS-RT feed URLs for realtime data */
  realtimeFeedUrls?: string[];

  /** Optional: Staleness threshold in seconds (default: 120) */
  stalenessThreshold?: number;
}

type FactoryOptions = Omit<GtfsSqlJsOptions, 'zipPath' | 'database'>;

export class GtfsSqlJs {
  private db: GtfsDatabase | null = null;
  private ownsDatabase: boolean = true;
  private realtimeFeedUrls: string[] = [];
  private stalenessThreshold: number = 120;
  private lastRealtimeFetchTimestamp: number | null = null;

  /**
   * Private constructor - use static factory methods instead
   */
  private constructor() {}

  /**
   * Create GtfsSqlJs instance from GTFS ZIP file path or URL
   */
  static async fromZip(
    zipPath: string,
    options: FactoryOptions
  ): Promise<GtfsSqlJs> {
    assertAdapter(options, 'fromZip');
    const zipData = await fetchZip(zipPath, options.onProgress);
    return GtfsSqlJs.fromZipData(zipData, options, zipPath);
  }

  /**
   * Create GtfsSqlJs instance from pre-loaded GTFS ZIP data
   * @param source - Optional original path/URL, used for cache key generation and metadata
   */
  static async fromZipData(
    zipData: ArrayBuffer | Uint8Array,
    options: FactoryOptions,
    source?: string
  ): Promise<GtfsSqlJs> {
    assertAdapter(options, 'fromZipData');
    const instance = new GtfsSqlJs();
    await instance.initFromZipData(zipData, options, source);
    return instance;
  }

  /**
   * Create GtfsSqlJs instance from existing SQLite database
   */
  static async fromDatabase(
    database: ArrayBuffer,
    options: FactoryOptions
  ): Promise<GtfsSqlJs> {
    assertAdapter(options, 'fromDatabase');
    const instance = new GtfsSqlJs();
    await instance.initFromDatabase(database, options);
    return instance;
  }

  /**
   * Attach to a pre-opened database handle.
   *
   * Use this path when the caller already owns a live `GtfsDatabase`
   * (typical for file-backed native drivers: op-sqlite, expo-sqlite,
   * better-sqlite3). No adapter factory is needed — the handle *is* the
   * adapter output.
   */
  static async attach(
    db: GtfsDatabase,
    options: GtfsSqlJsAttachOptions = {}
  ): Promise<GtfsSqlJs> {
    const instance = new GtfsSqlJs();
    instance.db = db;
    instance.ownsDatabase = options.ownsDatabase === true;

    if (!options.skipSchema) {
      const createTableStatements = getAllCreateTableStatements();
      for (const statement of createTableStatements) {
        await db.run(statement);
      }
      await createRealtimeTables(db);
    }

    if (options.realtimeFeedUrls) {
      instance.realtimeFeedUrls = options.realtimeFeedUrls;
    }
    if (options.stalenessThreshold !== undefined) {
      instance.stalenessThreshold = options.stalenessThreshold;
    }

    return instance;
  }

  /**
   * Initialize from pre-loaded ZIP data
   * @param source - Optional original path/URL, used for cache key generation and metadata
   */
  private async initFromZipData(
    zipData: ArrayBuffer | Uint8Array,
    options: FactoryOptions,
    source?: string
  ): Promise<void> {
    const onProgress = options.onProgress;
    const {
      cache: userCache,
      cacheVersion = '1.0',
      cacheExpirationMs = DEFAULT_CACHE_EXPIRATION_MS,
      skipFiles,
      adapter,
    } = options;

    // Determine cache store to use
    // Cache store must be provided explicitly by the user
    // See examples/cache/ for available implementations
    const cache: CacheStore | null = userCache === null ? null : (userCache || null);

    // Check cache if enabled
    if (cache) {
      onProgress?.({
        phase: 'checking_cache',
        currentFile: null,
        filesCompleted: 0,
        totalFiles: 0,
        rowsProcessed: 0,
        totalRows: 0,
        percentComplete: 0,
        message: 'Checking cache...',
      });

      // Calculate filesize
      const filesize = zipData.byteLength;

      // Compute checksum
      const checksum = await computeZipChecksum(zipData);

      // Generate cache key with all parameters
      const cacheKey = generateCacheKey(
        checksum,
        LIB_VERSION,
        cacheVersion,
        filesize,
        source,
        skipFiles
      );

      // Check if cache exists
      const cacheEntry = await cache.get(cacheKey);

      if (cacheEntry) {
        // Check if cache entry is expired
        const expired = isCacheExpired(cacheEntry.metadata, cacheExpirationMs);

        if (expired) {
          // Cache is expired, delete it and continue with normal loading
          onProgress?.({
            phase: 'checking_cache',
            currentFile: null,
            filesCompleted: 0,
            totalFiles: 0,
            rowsProcessed: 0,
            totalRows: 0,
            percentComplete: 2,
            message: 'Cache expired, reprocessing...',
          });

          await cache.delete(cacheKey);
        } else {
          // Cache is valid, load from it
          onProgress?.({
            phase: 'loading_from_cache',
            currentFile: null,
            filesCompleted: 0,
            totalFiles: 0,
            rowsProcessed: 0,
            totalRows: 0,
            percentComplete: 50,
            message: 'Loading from cache...',
          });

          this.db = await adapter.openFromBuffer(new Uint8Array(cacheEntry.data));
          this.ownsDatabase = true;

          // Set RT configuration
          if (options.realtimeFeedUrls) {
            this.realtimeFeedUrls = options.realtimeFeedUrls;
          }
          if (options.stalenessThreshold !== undefined) {
            this.stalenessThreshold = options.stalenessThreshold;
          }

          onProgress?.({
            phase: 'complete',
            currentFile: null,
            filesCompleted: 0,
            totalFiles: 0,
            rowsProcessed: 0,
            totalRows: 0,
            percentComplete: 100,
            message: 'GTFS data loaded from cache',
          });

          return;
        }
      }

      // Cache miss - continue with normal loading but use already-fetched zip data
      await this.loadFromZipData(zipData, options, onProgress);

      // Save to cache
      onProgress?.({
        phase: 'saving_cache',
        currentFile: null,
        filesCompleted: 0,
        totalFiles: 0,
        rowsProcessed: 0,
        totalRows: 0,
        percentComplete: 98,
        message: 'Saving to cache...',
      });

      try {
        const dbBuffer = await this.export();
        await cache.set(cacheKey, dbBuffer, {
          checksum,
          version: cacheVersion,
          timestamp: Date.now(),
          source,
          size: dbBuffer.byteLength,
          skipFiles,
        });
      } catch (error) {
        if (error instanceof ExportNotSupportedError) {
          console.warn(
            'Skipping cache write: the active adapter does not support export(). ' +
            'File-backed adapters persist their own DB on disk and do not need the library cache.'
          );
        } else {
          throw error;
        }
      }

      onProgress?.({
        phase: 'complete',
        currentFile: null,
        filesCompleted: 0,
        totalFiles: 0,
        rowsProcessed: 0,
        totalRows: 0,
        percentComplete: 100,
        message: 'GTFS data loaded successfully',
      });

      return;
    }

    // No cache - load directly from zip data
    await this.loadFromZipData(zipData, options, onProgress);

    onProgress?.({
      phase: 'complete',
      currentFile: null,
      filesCompleted: 0,
      totalFiles: 0,
      rowsProcessed: 0,
      totalRows: 0,
      percentComplete: 100,
      message: 'GTFS data loaded successfully',
    });
  }

  /**
   * Helper method to load GTFS data from zip data
   * Used by both cache-enabled and cache-disabled paths
   */
  private async loadFromZipData(
    zipData: ArrayBuffer | Uint8Array,
    options: FactoryOptions,
    onProgress?: ProgressCallback
  ): Promise<void> {
    // Create new database via the adapter
    this.db = await options.adapter.createEmpty();
    this.ownsDatabase = true;

    // Create GTFS tables (without indexes)
    onProgress?.({
      phase: 'creating_schema',
      currentFile: null,
      filesCompleted: 0,
      totalFiles: 0,
      rowsProcessed: 0,
      totalRows: 0,
      percentComplete: 40,
      message: 'Creating database tables',
    });

    const createTableStatements = getAllCreateTableStatements();
    for (const statement of createTableStatements) {
      await this.db.run(statement);
    }

    // Create GTFS-RT tables
    await createRealtimeTables(this.db);

    // Extract files from zip
    onProgress?.({
      phase: 'extracting',
      currentFile: null,
      filesCompleted: 0,
      totalFiles: 0,
      rowsProcessed: 0,
      totalRows: 0,
      percentComplete: 35,
      message: 'Extracting GTFS ZIP file',
    });

    const files = await loadGTFSZip(zipData, options.skipFiles);

    // Load GTFS data
    onProgress?.({
      phase: 'inserting_data',
      currentFile: null,
      filesCompleted: 0,
      totalFiles: Object.keys(files).length,
      rowsProcessed: 0,
      totalRows: 0,
      percentComplete: 40,
      message: 'Starting data import',
    });

    await loadGTFSData(this.db, files, options.skipFiles, onProgress);

    // Create indexes after data is loaded
    onProgress?.({
      phase: 'creating_indexes',
      currentFile: null,
      filesCompleted: Object.keys(files).length,
      totalFiles: Object.keys(files).length,
      rowsProcessed: 0,
      totalRows: 0,
      percentComplete: 75,
      message: 'Creating database indexes',
    });

    const createIndexStatements = getAllCreateIndexStatements();
    let indexCount = 0;
    for (const statement of createIndexStatements) {
      await this.db.run(statement);
      indexCount++;
      const indexProgress = 75 + Math.floor((indexCount / createIndexStatements.length) * 10);
      onProgress?.({
        phase: 'creating_indexes',
        currentFile: null,
        filesCompleted: Object.keys(files).length,
        totalFiles: Object.keys(files).length,
        rowsProcessed: 0,
        totalRows: 0,
        percentComplete: indexProgress,
        message: `Creating indexes (${indexCount}/${createIndexStatements.length})`,
      });
    }

    // Run ANALYZE to update query planner statistics
    onProgress?.({
      phase: 'analyzing',
      currentFile: null,
      filesCompleted: Object.keys(files).length,
      totalFiles: Object.keys(files).length,
      rowsProcessed: 0,
      totalRows: 0,
      percentComplete: 85,
      message: 'Optimizing query performance',
    });

    await this.db.run('ANALYZE');

    // Set RT configuration
    if (options.realtimeFeedUrls) {
      this.realtimeFeedUrls = options.realtimeFeedUrls;
    }
    if (options.stalenessThreshold !== undefined) {
      this.stalenessThreshold = options.stalenessThreshold;
    }

    // Auto-fetch realtime data if feed URLs are configured
    if (this.realtimeFeedUrls.length > 0) {
      onProgress?.({
        phase: 'loading_realtime',
        currentFile: null,
        filesCompleted: 0,
        totalFiles: this.realtimeFeedUrls.length,
        rowsProcessed: 0,
        totalRows: 0,
        percentComplete: 90,
        message: `Loading realtime data from ${this.realtimeFeedUrls.length} feed${this.realtimeFeedUrls.length > 1 ? 's' : ''}`,
      });

      try {
        await loadRealtimeData(this.db, this.realtimeFeedUrls);
      } catch (error) {
        // Don't fail the entire load if RT data fetch fails
        console.warn('Failed to fetch initial realtime data:', error);
      }
    }
  }

  /**
   * Initialize from existing database
   */
  private async initFromDatabase(
    database: ArrayBuffer,
    options: FactoryOptions
  ): Promise<void> {
    this.db = await options.adapter.openFromBuffer(new Uint8Array(database));
    this.ownsDatabase = true;

    // Ensure RT tables exist (in case loading old database)
    await createRealtimeTables(this.db);

    // Set RT configuration
    if (options.realtimeFeedUrls) {
      this.realtimeFeedUrls = options.realtimeFeedUrls;
    }
    if (options.stalenessThreshold !== undefined) {
      this.stalenessThreshold = options.stalenessThreshold;
    }
  }

  /**
   * Export database to ArrayBuffer
   *
   * Throws `ExportNotSupportedError` if the active adapter is file-backed
   * and cannot serialize the database to bytes.
   */
  async export(): Promise<ArrayBuffer> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const data = await this.db.export();
    // Create a new ArrayBuffer and copy the data to ensure proper type
    const buffer = new ArrayBuffer(data.length);
    new Uint8Array(buffer).set(data);
    return buffer;
  }

  /**
   * Close the database connection.
   *
   * When the library itself created the DB handle (via `fromZip`,
   * `fromZipData`, `fromDatabase`, or when `attach()` was called with
   * `ownsDatabase: true`), this also closes the underlying adapter. For
   * handles passed to `attach()` without `ownsDatabase`, this is a no-op
   * beyond clearing the internal reference — the caller owns the handle.
   */
  async close(): Promise<void> {
    if (this.db && this.ownsDatabase) {
      await this.db.close();
    }
    this.db = null;
  }

  /**
   * Get direct access to the underlying adapter database handle (for advanced queries).
   */
  getDatabase(): GtfsDatabase {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  // ==================== Agency Methods ====================

  /**
   * Get agencies with optional filters
   * Pass agencyId filter to get a specific agency
   */
  async getAgencies(filters?: AgencyFilters): Promise<Agency[]> {
    if (!this.db) throw new Error('Database not initialized');
    return getAgencies(this.db, filters);
  }

  // ==================== Stop Methods ====================

  /**
   * Get stops with optional filters
   * Pass stopId filter to get a specific stop
   */
  async getStops(filters?: StopFilters): Promise<Stop[]> {
    if (!this.db) throw new Error('Database not initialized');
    return getStops(this.db, filters);
  }

  // ==================== Route Methods ====================

  /**
   * Get routes with optional filters
   * Pass routeId filter to get a specific route
   */
  async getRoutes(filters?: RouteFilters): Promise<Route[]> {
    if (!this.db) throw new Error('Database not initialized');
    return getRoutes(this.db, filters);
  }

  // ==================== Calendar Methods ====================

  /**
   * Get active service IDs for a given date (YYYYMMDD format)
   */
  async getActiveServiceIds(date: string): Promise<string[]> {
    if (!this.db) throw new Error('Database not initialized');
    return getActiveServiceIds(this.db, date);
  }

  /**
   * Get calendar entry by service_id
   */
  async getCalendarByServiceId(serviceId: string): Promise<Calendar | null> {
    if (!this.db) throw new Error('Database not initialized');
    return getCalendarByServiceId(this.db, serviceId);
  }

  /**
   * Get calendar date exceptions for a service
   */
  async getCalendarDates(serviceId: string): Promise<CalendarDate[]> {
    if (!this.db) throw new Error('Database not initialized');
    return getCalendarDates(this.db, serviceId);
  }

  /**
   * Get calendar date exceptions for a specific date
   */
  async getCalendarDatesForDate(date: string): Promise<CalendarDate[]> {
    if (!this.db) throw new Error('Database not initialized');
    return getCalendarDatesForDate(this.db, date);
  }

  // ==================== Trip Methods ====================

  /**
   * Get trips with optional filters
   * Pass tripId filter to get a specific trip
   */
  async getTrips(filters?: TripFilters & { date?: string }): Promise<Trip[]> {
    if (!this.db) throw new Error('Database not initialized');

    // Handle date parameter by converting it to serviceIds
    const { date, ...restFilters } = filters || {};
    const finalFilters = { ...restFilters };

    if (date) {
      const serviceIds = await getActiveServiceIds(this.db, date);
      finalFilters.serviceIds = serviceIds;
    }

    return getTrips(this.db, finalFilters, this.stalenessThreshold);
  }

  // ==================== Shape Methods ====================

  /**
   * Get shapes with optional filters
   */
  async getShapes(filters?: ShapeFilters): Promise<Shape[]> {
    if (!this.db) throw new Error('Database not initialized');
    return getShapes(this.db, filters);
  }

  /**
   * Get shapes as GeoJSON FeatureCollection
   */
  async getShapesToGeojson(filters?: ShapeFilters, precision: number = 6): Promise<GeoJsonFeatureCollection> {
    if (!this.db) throw new Error('Database not initialized');
    return getShapesToGeojson(this.db, filters, precision);
  }

  // ==================== Stop Time Methods ====================

  /**
   * Get stop times with optional filters
   */
  async getStopTimes(filters?: StopTimeFilters & { date?: string }): Promise<StopTime[]> {
    if (!this.db) throw new Error('Database not initialized');

    // Handle date parameter by converting it to serviceIds
    const { date, ...restFilters } = filters || {};
    const finalFilters = { ...restFilters };

    if (date) {
      const serviceIds = await getActiveServiceIds(this.db, date);
      finalFilters.serviceIds = serviceIds;
    }

    return getStopTimes(this.db, finalFilters, this.stalenessThreshold);
  }

  /**
   * Build an ordered list of stops from multiple trips
   */
  async buildOrderedStopList(tripIds: string[]): Promise<Stop[]> {
    if (!this.db) throw new Error('Database not initialized');
    return buildOrderedStopList(this.db, tripIds);
  }

  // ==================== Realtime Methods ====================

  /**
   * Set GTFS-RT feed URLs
   */
  setRealtimeFeedUrls(urls: string[]): void {
    this.realtimeFeedUrls = urls;
  }

  /**
   * Get currently configured GTFS-RT feed URLs
   */
  getRealtimeFeedUrls(): string[] {
    return [...this.realtimeFeedUrls];
  }

  /**
   * Set staleness threshold in seconds
   */
  setStalenessThreshold(seconds: number): void {
    this.stalenessThreshold = seconds;
  }

  /**
   * Get current staleness threshold
   */
  getStalenessThreshold(): number {
    return this.stalenessThreshold;
  }

  /**
   * Get timestamp of the last successful realtime data fetch and insertion
   */
  getLastRealtimeFetchTimestamp(): number | null {
    return this.lastRealtimeFetchTimestamp;
  }

  /**
   * Fetch and load GTFS Realtime data from configured feed URLs or provided URLs
   */
  async fetchRealtimeData(urls?: string[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const feedUrls = urls || this.realtimeFeedUrls;
    if (feedUrls.length === 0) {
      throw new Error('No realtime feed URLs configured. Use setRealtimeFeedUrls() or pass urls parameter.');
    }

    await loadRealtimeData(this.db, feedUrls);
    this.lastRealtimeFetchTimestamp = Math.floor(Date.now() / 1000);
  }

  /**
   * Load GTFS Realtime data from pre-loaded protobuf buffers
   */
  async loadRealtimeDataFromBuffers(buffers: Uint8Array[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await loadRealtimeDataFromBuffers(this.db, buffers);
    this.lastRealtimeFetchTimestamp = Math.floor(Date.now() / 1000);
  }

  /**
   * Clear all realtime data from the database
   */
  async clearRealtimeData(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await clearRTData(this.db);
  }

  /**
   * Get alerts with optional filters
   */
  async getAlerts(filters?: AlertFilters): Promise<Alert[]> {
    if (!this.db) throw new Error('Database not initialized');
    return getAlertsQuery(this.db, filters, this.stalenessThreshold);
  }

  /**
   * Get vehicle positions with optional filters
   */
  async getVehiclePositions(filters?: VehiclePositionFilters): Promise<VehiclePosition[]> {
    if (!this.db) throw new Error('Database not initialized');
    return getVehiclePositionsQuery(this.db, filters, this.stalenessThreshold);
  }

  /**
   * Get trip updates with optional filters
   */
  async getTripUpdates(filters?: TripUpdateFilters): Promise<TripUpdate[]> {
    if (!this.db) throw new Error('Database not initialized');
    return getTripUpdates(this.db, filters, this.stalenessThreshold);
  }

  /**
   * Get stop time updates with optional filters
   */
  async getStopTimeUpdates(filters?: StopTimeUpdateFilters): Promise<import('./types/gtfs-rt').StopTimeUpdate[]> {
    if (!this.db) throw new Error('Database not initialized');
    return getStopTimeUpdates(this.db, filters, this.stalenessThreshold);
  }

  // ==================== Debug Export Methods ====================

  async debugExportAllAlerts(): Promise<Alert[]> {
    if (!this.db) throw new Error('Database not initialized');
    return getAllAlerts(this.db);
  }

  async debugExportAllVehiclePositions(): Promise<VehiclePosition[]> {
    if (!this.db) throw new Error('Database not initialized');
    return getAllVehiclePositions(this.db);
  }

  async debugExportAllTripUpdates(): Promise<TripUpdate[]> {
    if (!this.db) throw new Error('Database not initialized');
    return getAllTripUpdates(this.db);
  }

  async debugExportAllStopTimeUpdates(): Promise<StopTimeUpdate[]> {
    if (!this.db) throw new Error('Database not initialized');
    return getAllStopTimeUpdates(this.db);
  }

  // ==================== Cache Management Methods ====================

  static async getCacheStats(cacheStore: CacheStore) {
    const { getCacheStats } = await import('./cache/utils');

    if (!cacheStore) {
      throw new Error('Cache store is required');
    }

    const entries = await cacheStore.list?.() || [];
    return getCacheStats(entries);
  }

  static async cleanExpiredCache(
    cacheStore: CacheStore,
    expirationMs: number = DEFAULT_CACHE_EXPIRATION_MS
  ): Promise<number> {
    const { filterExpiredEntries } = await import('./cache/utils');

    if (!cacheStore || !cacheStore.list) {
      throw new Error('Cache store is required and must support listing');
    }

    const allEntries = await cacheStore.list();
    const expiredEntries = allEntries.filter(entry =>
      !filterExpiredEntries([entry], expirationMs).length
    );

    await Promise.all(expiredEntries.map(entry => cacheStore.delete(entry.key)));

    return expiredEntries.length;
  }

  static async clearCache(cacheStore: CacheStore): Promise<void> {
    if (!cacheStore) {
      throw new Error('Cache store is required');
    }

    await cacheStore.clear();
  }

  static async listCache(
    cacheStore: CacheStore,
    includeExpired: boolean = false
  ) {
    const { filterExpiredEntries } = await import('./cache/utils');

    if (!cacheStore || !cacheStore.list) {
      throw new Error('Cache store is required and must support listing');
    }

    const entries = await cacheStore.list();

    if (includeExpired) {
      return entries;
    }

    return filterExpiredEntries(entries);
  }
}

function assertAdapter(options: FactoryOptions | undefined, method: string): void {
  if (!options || !options.adapter) {
    throw new Error(
      `${method}() requires an \`adapter\`. Pass one via options — e.g. ` +
      `import { createSqlJsAdapter } from 'gtfs-sqljs/adapters/sql-js' and ` +
      `set \`adapter: await createSqlJsAdapter()\`, or call GtfsSqlJs.attach() ` +
      `with an already-open handle.`
    );
  }
}
