/**
 * Stop Query Methods
 */

import type { Database } from 'sql.js';
import type { Stop } from '../types/gtfs';

export interface StopFilters {
  stopId?: string;
  stopCode?: string;
  name?: string;
  tripId?: string;
  limit?: number;
}

/**
 * Get stops with optional filters
 */
export function getStops(db: Database, filters: StopFilters = {}): Stop[] {
  const { stopId, stopCode, name, tripId, limit } = filters;

  // Handle special case: get stops by trip (requires JOIN)
  if (tripId) {
    return getStopsByTrip(db, tripId);
  }

  // Build WHERE clause dynamically
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (stopId) {
    conditions.push('stop_id = ?');
    params.push(stopId);
  }

  if (stopCode) {
    conditions.push('stop_code = ?');
    params.push(stopCode);
  }

  if (name) {
    conditions.push('stop_name LIKE ?');
    params.push(`%${name}%`);
  }

  // Build SQL query
  let sql = 'SELECT * FROM stops';
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY stop_name';
  if (limit) {
    sql += ' LIMIT ?';
    params.push(limit);
  }

  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }

  const stops: Stop[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    stops.push(rowToStop(row));
  }

  stmt.free();
  return stops;
}

/**
 * Get a stop by its stop_id
 */
export function getStopById(db: Database, stopId: string): Stop | null {
  const stmt = db.prepare('SELECT * FROM stops WHERE stop_id = ?');
  stmt.bind([stopId]);

  if (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    stmt.free();
    return rowToStop(row);
  }

  stmt.free();
  return null;
}

/**
 * Get a stop by its stop_code
 */
export function getStopByCode(db: Database, stopCode: string): Stop | null {
  const stmt = db.prepare('SELECT * FROM stops WHERE stop_code = ?');
  stmt.bind([stopCode]);

  if (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    stmt.free();
    return rowToStop(row);
  }

  stmt.free();
  return null;
}

/**
 * Search stops by name (case-insensitive, partial match)
 */
export function searchStopsByName(db: Database, name: string, limit = 50): Stop[] {
  const stmt = db.prepare(
    'SELECT * FROM stops WHERE stop_name LIKE ? ORDER BY stop_name LIMIT ?'
  );
  stmt.bind([`%${name}%`, limit]);

  const stops: Stop[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    stops.push(rowToStop(row));
  }

  stmt.free();
  return stops;
}

/**
 * Get all stops
 */
export function getAllStops(db: Database, limit?: number): Stop[] {
  const sql = limit
    ? `SELECT * FROM stops ORDER BY stop_name LIMIT ${limit}`
    : 'SELECT * FROM stops ORDER BY stop_name';

  const stmt = db.prepare(sql);

  const stops: Stop[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    stops.push(rowToStop(row));
  }

  stmt.free();
  return stops;
}

/**
 * Get stops for a given trip (ordered by stop_sequence)
 */
export function getStopsByTrip(db: Database, tripId: string): Stop[] {
  const stmt = db.prepare(`
    SELECT s.* FROM stops s
    INNER JOIN stop_times st ON s.stop_id = st.stop_id
    WHERE st.trip_id = ?
    ORDER BY st.stop_sequence
  `);
  stmt.bind([tripId]);

  const stops: Stop[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    stops.push(rowToStop(row));
  }

  stmt.free();
  return stops;
}

/**
 * Convert database row to Stop object
 */
function rowToStop(row: Record<string, unknown>): Stop {
  return {
    stop_id: String(row.stop_id),
    stop_name: String(row.stop_name),
    stop_lat: Number(row.stop_lat),
    stop_lon: Number(row.stop_lon),
    stop_code: row.stop_code ? String(row.stop_code) : undefined,
    stop_desc: row.stop_desc ? String(row.stop_desc) : undefined,
    zone_id: row.zone_id ? String(row.zone_id) : undefined,
    stop_url: row.stop_url ? String(row.stop_url) : undefined,
    location_type: row.location_type !== null ? Number(row.location_type) : undefined,
    parent_station: row.parent_station ? String(row.parent_station) : undefined,
    stop_timezone: row.stop_timezone ? String(row.stop_timezone) : undefined,
    wheelchair_boarding: row.wheelchair_boarding !== null ? Number(row.wheelchair_boarding) : undefined,
    level_id: row.level_id ? String(row.level_id) : undefined,
    platform_code: row.platform_code ? String(row.platform_code) : undefined,
  };
}
