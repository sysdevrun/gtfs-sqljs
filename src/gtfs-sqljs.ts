/**
 * Main GtfsSqlJs Class
 */

import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import { getAllCreateStatements } from './schema/schema';
import { loadGTFSZip } from './loaders/zip-loader';
import { loadGTFSData } from './loaders/data-loader';

// Query methods
import { getStopById, getStopByCode, searchStopsByName, getAllStops, getStopsByTrip, getStops, type StopFilters } from './queries/stops';
import { getRouteById, getAllRoutes, getRoutesByAgency, getRoutes, type RouteFilters } from './queries/routes';
import {
  getActiveServiceIds,
  getCalendarByServiceId,
  getCalendarDates,
  getCalendarDatesForDate,
} from './queries/calendar';
import {
  getTripById,
  getTripsByRoute,
  getTripsByRouteAndService,
  getTripsByRouteServiceAndDirection,
  getTripsByService,
  getTrips,
  type TripFilters,
} from './queries/trips';
import {
  getStopTimesByTrip,
  getStopTimesByStop,
  getStopTimesForStopRouteDirection,
  getStopTimes,
  type StopTimeFilters,
} from './queries/stop-times';

// Types
import type { Stop, Route, Trip, StopTime, Calendar, CalendarDate } from './types/gtfs';

// Export filter types for users
export type { StopFilters, RouteFilters, TripFilters, StopTimeFilters };

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
    await loadGTFSData(this.db, files);
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

  // ==================== Stop Methods ====================

  /**
   * Get a stop by its stop_id
   */
  getStopById(stopId: string): Stop | null {
    if (!this.db) throw new Error('Database not initialized');
    return getStopById(this.db, stopId);
  }

  /**
   * Get a stop by its stop_code
   */
  getStopByCode(stopCode: string): Stop | null {
    if (!this.db) throw new Error('Database not initialized');
    return getStopByCode(this.db, stopCode);
  }

  /**
   * Search stops by name (case-insensitive, partial match)
   */
  searchStopsByName(name: string, limit = 50): Stop[] {
    if (!this.db) throw new Error('Database not initialized');
    return searchStopsByName(this.db, name, limit);
  }

  /**
   * Get all stops
   */
  getAllStops(limit?: number): Stop[] {
    if (!this.db) throw new Error('Database not initialized');
    return getAllStops(this.db, limit);
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
   * Get all routes
   */
  getAllRoutes(limit?: number): Route[] {
    if (!this.db) throw new Error('Database not initialized');
    return getAllRoutes(this.db, limit);
  }

  /**
   * Get routes by agency
   */
  getRoutesByAgency(agencyId: string): Route[] {
    if (!this.db) throw new Error('Database not initialized');
    return getRoutesByAgency(this.db, agencyId);
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
   * Get trips for a route
   */
  getTripsByRoute(routeId: string): Trip[] {
    if (!this.db) throw new Error('Database not initialized');
    return getTripsByRoute(this.db, routeId);
  }

  /**
   * Get trips for a route and date
   */
  getTripsByRouteAndDate(routeId: string, date: string): Trip[] {
    if (!this.db) throw new Error('Database not initialized');
    const serviceIds = getActiveServiceIds(this.db, date);
    return getTripsByRouteAndService(this.db, routeId, serviceIds);
  }

  /**
   * Get trips for a route, date, and direction
   */
  getTripsByRouteAndDateAndDirection(routeId: string, date: string, directionId: number): Trip[] {
    if (!this.db) throw new Error('Database not initialized');
    const serviceIds = getActiveServiceIds(this.db, date);
    return getTripsByRouteServiceAndDirection(this.db, routeId, serviceIds, directionId);
  }

  /**
   * Get all trips for a given date (YYYYMMDD format)
   */
  getTripsByDate(date: string): Trip[] {
    if (!this.db) throw new Error('Database not initialized');
    const serviceIds = getActiveServiceIds(this.db, date);
    return getTripsByService(this.db, serviceIds);
  }

  /**
   * Get stops for a given trip (ordered by stop_sequence)
   */
  getStopsByTrip(tripId: string): Stop[] {
    if (!this.db) throw new Error('Database not initialized');
    return getStopsByTrip(this.db, tripId);
  }

  /**
   * Get trips with optional filters
   *
   * @param filters - Optional filters
   * @param filters.tripId - Filter by trip ID
   * @param filters.routeId - Filter by route ID
   * @param filters.date - Filter by date (YYYYMMDD format) - will get active services for that date
   * @param filters.directionId - Filter by direction ID
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
   * Get stop times for a trip
   */
  getStopTimesByTrip(tripId: string): StopTime[] {
    if (!this.db) throw new Error('Database not initialized');
    return getStopTimesByTrip(this.db, tripId);
  }

  /**
   * Get stop times for a stop
   */
  getStopTimesByStop(stopId: string, limit = 100): StopTime[] {
    if (!this.db) throw new Error('Database not initialized');
    return getStopTimesByStop(this.db, stopId, limit);
  }

  /**
   * Get stop times for a stop, route, and date
   */
  getStopTimesForStopRouteAndDate(stopId: string, routeId: string, date: string, directionId?: number): StopTime[] {
    if (!this.db) throw new Error('Database not initialized');
    const serviceIds = getActiveServiceIds(this.db, date);
    return getStopTimesForStopRouteDirection(this.db, stopId, routeId, serviceIds, directionId);
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
