/**
 * Main GtfsSqlJs Class
 */

import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import { getAllCreateTableStatements, getAllCreateIndexStatements } from './schema/schema';
import { loadGTFSZip, fetchZip } from './loaders/zip-loader';
import { loadGTFSData } from './loaders/data-loader';
import { createRealtimeTables, clearRealtimeData as clearRTData } from './schema/gtfs-rt-schema';
import { loadRealtimeData } from './loaders/gtfs-rt-loader';
import type { CacheStore } from './cache/types';
import { computeZipChecksum, generateCacheKey } from './cache/checksum';
import { DEFAULT_CACHE_EXPIRATION_MS, isCacheExpired } from './cache/utils';

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
   * Optional: Custom SQL.js instance
   */
  SQL?: SqlJsStatic;

  /**
   * Optional: Path to SQL.js WASM file (for custom loading)
   */
  locateFile?: (filename: string) => string;

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
   * Use IndexedDBCacheStore (browser) or FileSystemCacheStore (Node.js)
   * or implement your own CacheStore
   *
   * If not provided, caching is enabled by default with:
   * - IndexedDBCacheStore in browsers
   * - FileSystemCacheStore in Node.js
   *
   * Set to `null` to disable caching
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

export class GtfsSqlJs {
  private db: Database | null = null;
  private SQL: SqlJsStatic | null = null;
  private realtimeFeedUrls: string[] = [];
  private stalenessThreshold: number = 120;

  /**
   * Private constructor - use static factory methods instead
   */
  private constructor() {}

  /**
   * Create GtfsSqlJs instance from GTFS ZIP file
   */
  static async fromZip(
    zipPath: string,
    options: Omit<GtfsSqlJsOptions, 'zipPath' | 'database'> = {}
  ): Promise<GtfsSqlJs> {
    const instance = new GtfsSqlJs();
    await instance.initFromZip(zipPath, options);
    return instance;
  }

  /**
   * Create GtfsSqlJs instance from existing SQLite database
   */
  static async fromDatabase(
    database: ArrayBuffer,
    options: Omit<GtfsSqlJsOptions, 'zipPath' | 'database'> = {}
  ): Promise<GtfsSqlJs> {
    const instance = new GtfsSqlJs();
    await instance.initFromDatabase(database, options);
    return instance;
  }

  /**
   * Initialize from ZIP file
   */
  private async initFromZip(zipPath: string, options: Omit<GtfsSqlJsOptions, 'zipPath' | 'database'>): Promise<void> {
    const onProgress = options.onProgress;
    const {
      cache: userCache,
      cacheVersion = '1.0',
      cacheExpirationMs = DEFAULT_CACHE_EXPIRATION_MS,
      skipFiles
    } = options;

    // Initialize SQL.js
    this.SQL = options.SQL || (await initSqlJs(options.locateFile ? { locateFile: options.locateFile } : {}));

    // Determine cache store to use
    let cache: CacheStore | null = null;

    if (userCache === null) {
      // User explicitly disabled caching
      cache = null;
    } else if (userCache) {
      // User provided a cache store
      cache = userCache;
    } else {
      // Auto-detect environment and create default cache store
      try {
        if (typeof indexedDB !== 'undefined') {
          // Browser/Web Worker environment - use IndexedDB
          const { IndexedDBCacheStore } = await import('./cache/indexeddb-store');
          cache = new IndexedDBCacheStore();
        } else if (typeof process !== 'undefined' && process.versions?.node) {
          // Node.js environment - use FileSystem
          const { FileSystemCacheStore } = await import('./cache/fs-store');
          cache = new FileSystemCacheStore();
        }
      } catch (error) {
        // Fallback to no caching if import fails
        console.warn('Failed to initialize default cache store:', error);
        cache = null;
      }
    }

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

      // Fetch raw zip data for checksum (only if zipPath is a string)
      let zipData: ArrayBuffer;
      if (typeof zipPath === 'string') {
        zipData = await fetchZip(zipPath, onProgress);
      } else {
        // zipPath is already ArrayBuffer or Uint8Array
        zipData = zipPath as ArrayBuffer;
      }

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
        typeof zipPath === 'string' ? zipPath : undefined,
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

          this.db = new this.SQL.Database(new Uint8Array(cacheEntry.data));

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

      const dbBuffer = this.export();
      await cache.set(cacheKey, dbBuffer, {
        checksum,
        version: cacheVersion,
        timestamp: Date.now(),
        source: typeof zipPath === 'string' ? zipPath : undefined,
        size: dbBuffer.byteLength,
        skipFiles,
      });

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

    // No cache - use normal loading flow
    // Fetch zip data
    let zipData: ArrayBuffer;
    if (typeof zipPath === 'string') {
      zipData = await fetchZip(zipPath, onProgress);
    } else {
      zipData = zipPath as ArrayBuffer;
    }

    // Load from zip data
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
   * Helper method to load GTFS data from zip data (ArrayBuffer)
   * Used by both cache-enabled and cache-disabled paths
   */
  private async loadFromZipData(
    zipData: ArrayBuffer,
    options: Omit<GtfsSqlJsOptions, 'zipPath' | 'database'>,
    onProgress?: ProgressCallback
  ): Promise<void> {
    // Create new database
    this.db = new this.SQL!.Database();

    // Apply performance PRAGMAs for bulk loading
    this.db.run('PRAGMA synchronous = OFF');        // Skip fsync for performance
    this.db.run('PRAGMA journal_mode = MEMORY');    // Keep journal in memory
    this.db.run('PRAGMA temp_store = MEMORY');      // Temp tables in memory
    this.db.run('PRAGMA cache_size = -64000');      // 64MB cache
    this.db.run('PRAGMA locking_mode = EXCLUSIVE'); // No locking overhead

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
      this.db.run(statement);
    }

    // Create GTFS-RT tables
    createRealtimeTables(this.db);

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

    const files = await loadGTFSZip(zipData);

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
      this.db.run(statement);
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

    this.db.run('ANALYZE');

    // Restore normal SQLite settings
    this.db.run('PRAGMA synchronous = FULL');
    this.db.run('PRAGMA locking_mode = NORMAL');

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
    options: Omit<GtfsSqlJsOptions, 'zipPath' | 'database'>
  ): Promise<void> {
    // Initialize SQL.js
    this.SQL = options.SQL || (await initSqlJs(options.locateFile ? { locateFile: options.locateFile } : {}));

    // Load existing database
    this.db = new this.SQL.Database(new Uint8Array(database));

    // Ensure RT tables exist (in case loading old database)
    createRealtimeTables(this.db);

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
   */
  export(): ArrayBuffer {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const data = this.db.export();
    // Create a new ArrayBuffer and copy the data to ensure proper type
    const buffer = new ArrayBuffer(data.length);
    new Uint8Array(buffer).set(data);
    return buffer;
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Get direct access to the database (for advanced queries)
   */
  getDatabase(): Database {
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
  getAgencies(filters?: AgencyFilters): Agency[] {
    if (!this.db) throw new Error('Database not initialized');
    return getAgencies(this.db, filters);
  }

  // ==================== Stop Methods ====================

  /**
   * Get stops with optional filters
   * Pass stopId filter to get a specific stop
   */
  getStops(filters?: StopFilters): Stop[] {
    if (!this.db) throw new Error('Database not initialized');
    return getStops(this.db, filters);
  }

  // ==================== Route Methods ====================

  /**
   * Get routes with optional filters
   * Pass routeId filter to get a specific route
   */
  getRoutes(filters?: RouteFilters): Route[] {
    if (!this.db) throw new Error('Database not initialized');
    return getRoutes(this.db, filters);
  }

  // ==================== Calendar Methods ====================

  /**
   * Get active service IDs for a given date (YYYYMMDD format)
   */
  getActiveServiceIds(date: string): string[] {
    if (!this.db) throw new Error('Database not initialized');
    return getActiveServiceIds(this.db, date);
  }

  /**
   * Get calendar entry by service_id
   */
  getCalendarByServiceId(serviceId: string): Calendar | null {
    if (!this.db) throw new Error('Database not initialized');
    return getCalendarByServiceId(this.db, serviceId);
  }

  /**
   * Get calendar date exceptions for a service
   */
  getCalendarDates(serviceId: string): CalendarDate[] {
    if (!this.db) throw new Error('Database not initialized');
    return getCalendarDates(this.db, serviceId);
  }

  /**
   * Get calendar date exceptions for a specific date
   */
  getCalendarDatesForDate(date: string): CalendarDate[] {
    if (!this.db) throw new Error('Database not initialized');
    return getCalendarDatesForDate(this.db, date);
  }

  // ==================== Trip Methods ====================

  /**
   * Get trips with optional filters
   * Pass tripId filter to get a specific trip
   *
   * @param filters - Optional filters
   * @param filters.tripId - Filter by trip ID (single value or array)
   * @param filters.routeId - Filter by route ID (single value or array)
   * @param filters.date - Filter by date (YYYYMMDD format) - will get active services for that date
   * @param filters.directionId - Filter by direction ID (single value or array)
   * @param filters.agencyId - Filter by agency ID (single value or array)
   * @param filters.limit - Limit number of results
   *
   * @example
   * // Get all trips for a route on a specific date
   * const trips = gtfs.getTrips({ routeId: 'ROUTE_1', date: '20240115' });
   *
   * @example
   * // Get all trips for a route going in one direction
   * const trips = gtfs.getTrips({ routeId: 'ROUTE_1', directionId: 0 });
   *
   * @example
   * // Get a specific trip
   * const trips = gtfs.getTrips({ tripId: 'TRIP_123' });
   */
  getTrips(filters?: TripFilters & { date?: string }): Trip[] {
    if (!this.db) throw new Error('Database not initialized');

    // Handle date parameter by converting it to serviceIds
    const { date, ...restFilters } = filters || {};
    const finalFilters = { ...restFilters };

    if (date) {
      const serviceIds = getActiveServiceIds(this.db, date);
      finalFilters.serviceIds = serviceIds;
    }

    return getTrips(this.db, finalFilters, this.stalenessThreshold);
  }

  // ==================== Shape Methods ====================

  /**
   * Get shapes with optional filters
   *
   * @param filters - Optional filters
   * @param filters.shapeId - Filter by shape ID (single value or array)
   * @param filters.routeId - Filter by route ID (single value or array) - joins with trips table
   * @param filters.tripId - Filter by trip ID (single value or array) - joins with trips table
   * @param filters.limit - Limit number of results
   *
   * @example
   * // Get all points for a specific shape
   * const shapes = gtfs.getShapes({ shapeId: 'SHAPE_1' });
   *
   * @example
   * // Get shapes for a specific route
   * const shapes = gtfs.getShapes({ routeId: 'ROUTE_1' });
   *
   * @example
   * // Get shapes for multiple trips
   * const shapes = gtfs.getShapes({ tripId: ['TRIP_1', 'TRIP_2'] });
   */
  getShapes(filters?: ShapeFilters): Shape[] {
    if (!this.db) throw new Error('Database not initialized');
    return getShapes(this.db, filters);
  }

  /**
   * Get shapes as GeoJSON FeatureCollection
   *
   * Each shape is converted to a LineString Feature with route properties.
   * Coordinates are in [longitude, latitude] format per GeoJSON spec.
   *
   * @param filters - Optional filters (same as getShapes)
   * @param filters.shapeId - Filter by shape ID (single value or array)
   * @param filters.routeId - Filter by route ID (single value or array)
   * @param filters.tripId - Filter by trip ID (single value or array)
   * @param filters.limit - Limit number of results
   * @param precision - Number of decimal places for coordinates (default: 6, ~10cm precision)
   *
   * @returns GeoJSON FeatureCollection with LineString features
   *
   * @example
   * // Get all shapes as GeoJSON
   * const geojson = gtfs.getShapesToGeojson();
   *
   * @example
   * // Get shapes for a route with lower precision
   * const geojson = gtfs.getShapesToGeojson({ routeId: 'ROUTE_1' }, 5);
   *
   * @example
   * // Result structure:
   * // {
   * //   type: 'FeatureCollection',
   * //   features: [{
   * //     type: 'Feature',
   * //     properties: {
   * //       shape_id: 'SHAPE_1',
   * //       route_id: 'ROUTE_1',
   * //       route_short_name: '1',
   * //       route_long_name: 'Main Street',
   * //       route_type: 3,
   * //       route_color: 'FF0000'
   * //     },
   * //     geometry: {
   * //       type: 'LineString',
   * //       coordinates: [[-122.123456, 37.123456], ...]
   * //     }
   * //   }]
   * // }
   */
  getShapesToGeojson(filters?: ShapeFilters, precision: number = 6): GeoJsonFeatureCollection {
    if (!this.db) throw new Error('Database not initialized');
    return getShapesToGeojson(this.db, filters, precision);
  }

  // ==================== Stop Time Methods ====================

  /**
   * Get stop times with optional filters
   *
   * @param filters - Optional filters
   * @param filters.tripId - Filter by trip ID (single value or array)
   * @param filters.stopId - Filter by stop ID (single value or array)
   * @param filters.routeId - Filter by route ID (single value or array)
   * @param filters.date - Filter by date (YYYYMMDD format) - will get active services for that date
   * @param filters.directionId - Filter by direction ID (single value or array)
   * @param filters.agencyId - Filter by agency ID (single value or array)
   * @param filters.includeRealtime - Include realtime data (delay and time fields)
   * @param filters.limit - Limit number of results
   *
   * @example
   * // Get stop times for a specific trip
   * const stopTimes = gtfs.getStopTimes({ tripId: 'TRIP_123' });
   *
   * @example
   * // Get stop times at a stop for a specific route on a date
   * const stopTimes = gtfs.getStopTimes({
   *   stopId: 'STOP_123',
   *   routeId: 'ROUTE_1',
   *   date: '20240115'
   * });
   *
   * @example
   * // Get stop times with realtime data
   * const stopTimes = gtfs.getStopTimes({
   *   tripId: 'TRIP_123',
   *   includeRealtime: true
   * });
   */
  getStopTimes(filters?: StopTimeFilters & { date?: string }): StopTime[] {
    if (!this.db) throw new Error('Database not initialized');

    // Handle date parameter by converting it to serviceIds
    const { date, ...restFilters } = filters || {};
    const finalFilters = { ...restFilters };

    if (date) {
      const serviceIds = getActiveServiceIds(this.db, date);
      finalFilters.serviceIds = serviceIds;
    }

    return getStopTimes(this.db, finalFilters, this.stalenessThreshold);
  }

  /**
   * Build an ordered list of stops from multiple trips
   *
   * This is useful when you need to display a timetable for a route where different trips
   * may stop at different sets of stops (e.g., express vs local service, or trips with
   * different start/end points).
   *
   * The method intelligently merges stop sequences from all provided trips to create
   * a comprehensive ordered list of all unique stops.
   *
   * @param tripIds - Array of trip IDs to analyze
   * @returns Ordered array of Stop objects representing all unique stops
   *
   * @example
   * // Get all trips for a route going in one direction
   * const trips = gtfs.getTrips({ routeId: 'ROUTE_1', directionId: 0 });
   * const tripIds = trips.map(t => t.trip_id);
   *
   * // Build ordered stop list for all these trips
   * const stops = gtfs.buildOrderedStopList(tripIds);
   *
   * // Now you can display a timetable with all possible stops
   * stops.forEach(stop => {
   *   console.log(stop.stop_name);
   * });
   */
  buildOrderedStopList(tripIds: string[]): Stop[] {
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
   * Fetch and load GTFS Realtime data from configured feed URLs or provided URLs
   * @param urls - Optional array of feed URLs. If not provided, uses configured feed URLs
   */
  async fetchRealtimeData(urls?: string[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const feedUrls = urls || this.realtimeFeedUrls;
    if (feedUrls.length === 0) {
      throw new Error('No realtime feed URLs configured. Use setRealtimeFeedUrls() or pass urls parameter.');
    }

    await loadRealtimeData(this.db, feedUrls);
  }

  /**
   * Clear all realtime data from the database
   */
  clearRealtimeData(): void {
    if (!this.db) throw new Error('Database not initialized');
    clearRTData(this.db);
  }

  /**
   * Get alerts with optional filters
   * Pass alertId filter to get a specific alert
   */
  getAlerts(filters?: AlertFilters): Alert[] {
    if (!this.db) throw new Error('Database not initialized');
    return getAlertsQuery(this.db, filters, this.stalenessThreshold);
  }

  /**
   * Get vehicle positions with optional filters
   * Pass tripId filter to get vehicle position for a specific trip
   */
  getVehiclePositions(filters?: VehiclePositionFilters): VehiclePosition[] {
    if (!this.db) throw new Error('Database not initialized');
    return getVehiclePositionsQuery(this.db, filters, this.stalenessThreshold);
  }

  /**
   * Get trip updates with optional filters
   * Pass tripId filter to get trip update for a specific trip
   */
  getTripUpdates(filters?: TripUpdateFilters): TripUpdate[] {
    if (!this.db) throw new Error('Database not initialized');
    return getTripUpdates(this.db, filters, this.stalenessThreshold);
  }

  /**
   * Get stop time updates with optional filters
   * Pass tripId filter to get stop time updates for a specific trip
   */
  getStopTimeUpdates(filters?: StopTimeUpdateFilters): import('./types/gtfs-rt').StopTimeUpdate[] {
    if (!this.db) throw new Error('Database not initialized');
    return getStopTimeUpdates(this.db, filters, this.stalenessThreshold);
  }

  // ==================== Debug Export Methods ====================
  // These methods export all realtime data without staleness filtering
  // for debugging purposes

  /**
   * Export all alerts without staleness filtering (for debugging)
   */
  debugExportAllAlerts(): Alert[] {
    if (!this.db) throw new Error('Database not initialized');
    return getAllAlerts(this.db);
  }

  /**
   * Export all vehicle positions without staleness filtering (for debugging)
   */
  debugExportAllVehiclePositions(): VehiclePosition[] {
    if (!this.db) throw new Error('Database not initialized');
    return getAllVehiclePositions(this.db);
  }

  /**
   * Export all trip updates without staleness filtering (for debugging)
   */
  debugExportAllTripUpdates(): TripUpdate[] {
    if (!this.db) throw new Error('Database not initialized');
    return getAllTripUpdates(this.db);
  }

  /**
   * Export all stop time updates without staleness filtering (for debugging)
   * Returns stop time updates with trip_id and rt_last_updated populated
   */
  debugExportAllStopTimeUpdates(): StopTimeUpdate[] {
    if (!this.db) throw new Error('Database not initialized');
    return getAllStopTimeUpdates(this.db);
  }

  // ==================== Cache Management Methods ====================

  /**
   * Get cache statistics
   * @param cacheStore - Cache store to query (optional, auto-detects if not provided)
   * @returns Cache statistics including size, entry count, and age information
   */
  static async getCacheStats(cacheStore?: CacheStore) {
    const { getCacheStats } = await import('./cache/utils');
    const cache = cacheStore || await this.getDefaultCacheStore();

    if (!cache) {
      throw new Error('No cache store available');
    }

    const entries = await cache.list?.() || [];
    return getCacheStats(entries);
  }

  /**
   * Clean expired cache entries
   * @param cacheStore - Cache store to clean (optional, auto-detects if not provided)
   * @param expirationMs - Expiration time in milliseconds (default: 7 days)
   * @returns Number of entries deleted
   */
  static async cleanExpiredCache(
    cacheStore?: CacheStore,
    expirationMs: number = DEFAULT_CACHE_EXPIRATION_MS
  ): Promise<number> {
    const { filterExpiredEntries } = await import('./cache/utils');
    const cache = cacheStore || await this.getDefaultCacheStore();

    if (!cache || !cache.list) {
      throw new Error('No cache store available or cache store does not support listing');
    }

    const allEntries = await cache.list();
    const expiredEntries = allEntries.filter(entry =>
      !filterExpiredEntries([entry], expirationMs).length
    );

    // Delete expired entries
    await Promise.all(expiredEntries.map(entry => cache.delete(entry.key)));

    return expiredEntries.length;
  }

  /**
   * Clear all cache entries
   * @param cacheStore - Cache store to clear (optional, auto-detects if not provided)
   */
  static async clearCache(cacheStore?: CacheStore): Promise<void> {
    const cache = cacheStore || await this.getDefaultCacheStore();

    if (!cache) {
      throw new Error('No cache store available');
    }

    await cache.clear();
  }

  /**
   * List all cache entries
   * @param cacheStore - Cache store to query (optional, auto-detects if not provided)
   * @param includeExpired - Include expired entries (default: false)
   * @returns Array of cache entries with metadata
   */
  static async listCache(
    cacheStore?: CacheStore,
    includeExpired: boolean = false
  ) {
    const { filterExpiredEntries } = await import('./cache/utils');
    const cache = cacheStore || await this.getDefaultCacheStore();

    if (!cache || !cache.list) {
      throw new Error('No cache store available or cache store does not support listing');
    }

    const entries = await cache.list();

    if (includeExpired) {
      return entries;
    }

    return filterExpiredEntries(entries);
  }

  /**
   * Get the default cache store for the current environment
   * @returns Default cache store or null if unavailable
   */
  private static async getDefaultCacheStore(): Promise<CacheStore | null> {
    try {
      if (typeof indexedDB !== 'undefined') {
        // Browser/Web Worker environment - use IndexedDB
        const { IndexedDBCacheStore } = await import('./cache/indexeddb-store');
        return new IndexedDBCacheStore();
      } else if (typeof process !== 'undefined' && process.versions?.node) {
        // Node.js environment - use FileSystem
        const { FileSystemCacheStore } = await import('./cache/fs-store');
        return new FileSystemCacheStore();
      }
    } catch (error) {
      console.warn('Failed to initialize default cache store:', error);
    }

    return null;
  }
}
