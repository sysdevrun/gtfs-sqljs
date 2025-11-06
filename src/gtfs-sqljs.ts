/**
 * Main GtfsSqlJs Class
 */

import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import { getAllCreateStatements } from './schema/schema';
import { loadGTFSZip } from './loaders/zip-loader';
import { loadGTFSData } from './loaders/data-loader';
import { createRealtimeTables, clearRealtimeData as clearRTData } from './schema/gtfs-rt-schema';
import { loadRealtimeData } from './loaders/gtfs-rt-loader';

// Query methods
import { getAgencyById, getAgencies, type AgencyFilters } from './queries/agencies';
import { getStopById, getStops, type StopFilters } from './queries/stops';
import { getRouteById, getRoutes, type RouteFilters } from './queries/routes';
import {
  getActiveServiceIds,
  getCalendarByServiceId,
  getCalendarDates,
  getCalendarDatesForDate,
} from './queries/calendar';
import { getTripById, getTrips, type TripFilters, type TripWithRealtime } from './queries/trips';
import { getStopTimesByTrip, getStopTimes, type StopTimeFilters, type StopTimeWithRealtime } from './queries/stop-times';
import { getAlerts as getAlertsQuery, getAlertById, getAllAlerts, type AlertFilters } from './queries/rt-alerts';
import { getVehiclePositions as getVehiclePositionsQuery, getVehiclePositionByTripId, getAllVehiclePositions, type VehiclePositionFilters } from './queries/rt-vehicle-positions';
import { getTripUpdates, getTripUpdateByTripId, getAllTripUpdates, type TripUpdateFilters } from './queries/rt-trip-updates';
import { getStopTimeUpdates, getStopTimeUpdatesByTripId, getAllStopTimeUpdates, type StopTimeUpdateFilters, type StopTimeUpdateWithMetadata } from './queries/rt-stop-time-updates';

// Types
import type { Agency, Stop, Route, Trip, StopTime, Calendar, CalendarDate } from './types/gtfs';
import type { Alert, VehiclePosition, TripUpdate } from './types/gtfs-rt';

// Export filter types for users
export type { AgencyFilters, StopFilters, RouteFilters, TripFilters, StopTimeFilters, AlertFilters, VehiclePositionFilters, TripUpdateFilters, StopTimeUpdateFilters };
// Export RT types
export type { Alert, VehiclePosition, TripUpdate, StopTimeUpdateWithMetadata, TripWithRealtime, StopTimeWithRealtime };

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
    // Initialize SQL.js
    this.SQL = options.SQL || (await initSqlJs(options.locateFile ? { locateFile: options.locateFile } : {}));

    // Create new database
    this.db = new this.SQL.Database();

    // Create GTFS schema
    const createStatements = getAllCreateStatements();
    for (const statement of createStatements) {
      this.db.run(statement);
    }

    // Create GTFS-RT tables
    createRealtimeTables(this.db);

    // Load GTFS data
    const files = await loadGTFSZip(zipPath);
    await loadGTFSData(this.db, files, options.skipFiles);

    // Set RT configuration
    if (options.realtimeFeedUrls) {
      this.realtimeFeedUrls = options.realtimeFeedUrls;
    }
    if (options.stalenessThreshold !== undefined) {
      this.stalenessThreshold = options.stalenessThreshold;
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
   * Get an agency by its agency_id
   */
  getAgencyById(agencyId: string): Agency | null {
    if (!this.db) throw new Error('Database not initialized');
    return getAgencyById(this.db, agencyId);
  }

  /**
   * Get agencies with optional filters
   */
  getAgencies(filters?: AgencyFilters): Agency[] {
    if (!this.db) throw new Error('Database not initialized');
    return getAgencies(this.db, filters);
  }

  // ==================== Stop Methods ====================

  /**
   * Get a stop by its stop_id
   */
  getStopById(stopId: string): Stop | null {
    if (!this.db) throw new Error('Database not initialized');
    return getStopById(this.db, stopId);
  }

  /**
   * Get stops with optional filters
   */
  getStops(filters?: StopFilters): Stop[] {
    if (!this.db) throw new Error('Database not initialized');
    return getStops(this.db, filters);
  }

  // ==================== Route Methods ====================

  /**
   * Get a route by its route_id
   */
  getRouteById(routeId: string): Route | null {
    if (!this.db) throw new Error('Database not initialized');
    return getRouteById(this.db, routeId);
  }

  /**
   * Get routes with optional filters
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
   * Get a trip by its trip_id
   */
  getTripById(tripId: string): Trip | null {
    if (!this.db) throw new Error('Database not initialized');
    return getTripById(this.db, tripId);
  }

  /**
   * Get trips with optional filters
   *
   * @param filters - Optional filters
   * @param filters.tripId - Filter by trip ID
   * @param filters.routeId - Filter by route ID
   * @param filters.date - Filter by date (YYYYMMDD format) - will get active services for that date
   * @param filters.directionId - Filter by direction ID
   * @param filters.agencyId - Filter by agency ID
   * @param filters.limit - Limit number of results
   *
   * @example
   * // Get all trips for a route on a specific date
   * const trips = gtfs.getTrips({ routeId: 'ROUTE_1', date: '20240115' });
   *
   * @example
   * // Get all trips for a route going in one direction
   * const trips = gtfs.getTrips({ routeId: 'ROUTE_1', directionId: 0 });
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

  // ==================== Stop Time Methods ====================

  /**
   * Get stop times for a trip (ordered by stop_sequence)
   */
  getStopTimesByTrip(tripId: string): StopTime[] {
    if (!this.db) throw new Error('Database not initialized');
    return getStopTimesByTrip(this.db, tripId);
  }

  /**
   * Get stop times with optional filters
   *
   * @param filters - Optional filters
   * @param filters.tripId - Filter by trip ID
   * @param filters.stopId - Filter by stop ID
   * @param filters.routeId - Filter by route ID
   * @param filters.date - Filter by date (YYYYMMDD format) - will get active services for that date
   * @param filters.directionId - Filter by direction ID
   * @param filters.agencyId - Filter by agency ID
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
   */
  getAlerts(filters?: AlertFilters): Alert[] {
    if (!this.db) throw new Error('Database not initialized');
    return getAlertsQuery(this.db, filters, this.stalenessThreshold);
  }

  /**
   * Get alert by ID
   */
  getAlertById(alertId: string): Alert | null {
    if (!this.db) throw new Error('Database not initialized');
    return getAlertById(this.db, alertId, this.stalenessThreshold);
  }

  /**
   * Get vehicle positions with optional filters
   */
  getVehiclePositions(filters?: VehiclePositionFilters): VehiclePosition[] {
    if (!this.db) throw new Error('Database not initialized');
    return getVehiclePositionsQuery(this.db, filters, this.stalenessThreshold);
  }

  /**
   * Get vehicle position by trip ID
   */
  getVehiclePositionByTripId(tripId: string): VehiclePosition | null {
    if (!this.db) throw new Error('Database not initialized');
    return getVehiclePositionByTripId(this.db, tripId, this.stalenessThreshold);
  }

  /**
   * Get trip updates with optional filters
   */
  getTripUpdates(filters?: TripUpdateFilters): TripUpdate[] {
    if (!this.db) throw new Error('Database not initialized');
    return getTripUpdates(this.db, filters, this.stalenessThreshold);
  }

  /**
   * Get trip update by trip ID
   */
  getTripUpdateByTripId(tripId: string): TripUpdate | null {
    if (!this.db) throw new Error('Database not initialized');
    return getTripUpdateByTripId(this.db, tripId, this.stalenessThreshold);
  }

  /**
   * Get stop time updates with optional filters
   */
  getStopTimeUpdates(filters?: StopTimeUpdateFilters): import('./types/gtfs-rt').StopTimeUpdate[] {
    if (!this.db) throw new Error('Database not initialized');
    return getStopTimeUpdates(this.db, filters, this.stalenessThreshold);
  }

  /**
   * Get stop time updates for a specific trip
   */
  getStopTimeUpdatesByTripId(tripId: string): import('./types/gtfs-rt').StopTimeUpdate[] {
    if (!this.db) throw new Error('Database not initialized');
    return getStopTimeUpdatesByTripId(this.db, tripId, this.stalenessThreshold);
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
   * Returns extended type with trip_id and rt_last_updated for debugging purposes
   */
  debugExportAllStopTimeUpdates(): StopTimeUpdateWithMetadata[] {
    if (!this.db) throw new Error('Database not initialized');
    return getAllStopTimeUpdates(this.db);
  }
}
