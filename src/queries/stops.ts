/**
 * Stop Query Methods
 */

import type { Database } from 'sql.js';
import type { Stop } from '../types/gtfs';

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
