/**
 * Main GtfsSqlJs Class
 */

import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import { getAllCreateStatements } from './schema/schema';
import { loadGTFSZip } from './loaders/zip-loader';
import { loadGTFSData } from './loaders/data-loader';

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
import { getTripById, getTrips, type TripFilters } from './queries/trips';
import { getStopTimesByTrip, getStopTimes, type StopTimeFilters } from './queries/stop-times';

// Types
import type { Agency, Stop, Route, Trip, StopTime, Calendar, CalendarDate } from './types/gtfs';

// Export filter types for users
export type { AgencyFilters, StopFilters, RouteFilters, TripFilters, StopTimeFilters };

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
}

export class GtfsSqlJs {
  private db: Database | null = null;
  private SQL: SqlJsStatic | null = null;

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

    // Create schema
    const createStatements = getAllCreateStatements();
    for (const statement of createStatements) {
      this.db.run(statement);
    }

    // Load GTFS data
    const files = await loadGTFSZip(zipPath);
    await loadGTFSData(this.db, files, options.skipFiles);
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

    return getTrips(this.db, finalFilters);
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

    return getStopTimes(this.db, finalFilters);
  }
}
