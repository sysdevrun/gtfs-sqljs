/**
 * Stop Query Methods
 */

import type { Database } from 'sql.js';
import type { Stop } from '../types/gtfs';

export interface StopFilters {
  stopId?: string | string[];
  stopCode?: string | string[];
  name?: string;
  tripId?: string | string[];
  limit?: number;
}

/**
 * Get stops with optional filters
 * - Filters support both single values and arrays
 * - Use name filter for partial name matching
 * - Use tripId filter to get stops for a specific trip (ordered by stop_sequence)
 */
export function getStops(db: Database, filters: StopFilters = {}): Stop[] {
  const { stopId, stopCode, name, tripId, limit } = filters;

  // Handle special case: get stops by trip (requires JOIN)
  if (tripId) {
    const tripIds = Array.isArray(tripId) ? tripId : [tripId];
    if (tripIds.length === 0) return [];

    const placeholders = tripIds.map(() => '?').join(', ');
    const stmt = db.prepare(`
      SELECT s.* FROM stops s
      INNER JOIN stop_times st ON s.stop_id = st.stop_id
      WHERE st.trip_id IN (${placeholders})
      ORDER BY st.stop_sequence
    `);
    stmt.bind(tripIds);

    const stops: Stop[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject() as Record<string, unknown>;
      stops.push(rowToStop(row));
    }

    stmt.free();
    return stops;
  }

  // Build WHERE clause dynamically
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (stopId) {
    const stopIds = Array.isArray(stopId) ? stopId : [stopId];
    if (stopIds.length > 0) {
      const placeholders = stopIds.map(() => '?').join(', ');
      conditions.push(`stop_id IN (${placeholders})`);
      params.push(...stopIds);
    }
  }

  if (stopCode) {
    const stopCodes = Array.isArray(stopCode) ? stopCode : [stopCode];
    if (stopCodes.length > 0) {
      const placeholders = stopCodes.map(() => '?').join(', ');
      conditions.push(`stop_code IN (${placeholders})`);
      params.push(...stopCodes);
    }
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
 * Search stops by name (case-insensitive, partial match)
 * This is a convenience method for name-based searches
 */
export function searchStopsByName(db: Database, name: string, limit = 50): Stop[] {
  return getStops(db, { name, limit });
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
