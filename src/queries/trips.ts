/**
 * Trip Query Methods
 */

import type { Database } from 'sql.js';
import type { Trip } from '../types/gtfs';

/**
 * Get a trip by its trip_id
 */
export function getTripById(db: Database, tripId: string): Trip | null {
  const stmt = db.prepare('SELECT * FROM trips WHERE trip_id = ?');
  stmt.bind([tripId]);

  if (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    stmt.free();
    return rowToTrip(row);
  }

  stmt.free();
  return null;
}

/**
 * Get trips for a route
 */
export function getTripsByRoute(db: Database, routeId: string): Trip[] {
  const stmt = db.prepare('SELECT * FROM trips WHERE route_id = ?');
  stmt.bind([routeId]);

  const trips: Trip[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    trips.push(rowToTrip(row));
  }

  stmt.free();
  return trips;
}

/**
 * Get trips for a route and service (active on a given date)
 */
export function getTripsByRouteAndService(
  db: Database,
  routeId: string,
  serviceIds: string[]
): Trip[] {
  if (serviceIds.length === 0) {
    return [];
  }

  const placeholders = serviceIds.map(() => '?').join(', ');
  const stmt = db.prepare(
    `SELECT * FROM trips WHERE route_id = ? AND service_id IN (${placeholders})`
  );
  stmt.bind([routeId, ...serviceIds]);

  const trips: Trip[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    trips.push(rowToTrip(row));
  }

  stmt.free();
  return trips;
}

/**
 * Get trips for a route, service, and direction
 */
export function getTripsByRouteServiceAndDirection(
  db: Database,
  routeId: string,
  serviceIds: string[],
  directionId: number
): Trip[] {
  if (serviceIds.length === 0) {
    return [];
  }

  const placeholders = serviceIds.map(() => '?').join(', ');
  const stmt = db.prepare(
    `SELECT * FROM trips WHERE route_id = ? AND service_id IN (${placeholders}) AND direction_id = ?`
  );
  stmt.bind([routeId, ...serviceIds, directionId]);

  const trips: Trip[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    trips.push(rowToTrip(row));
  }

  stmt.free();
  return trips;
}

/**
 * Convert database row to Trip object
 */
function rowToTrip(row: Record<string, unknown>): Trip {
  return {
    trip_id: String(row.trip_id),
    route_id: String(row.route_id),
    service_id: String(row.service_id),
    trip_headsign: row.trip_headsign ? String(row.trip_headsign) : undefined,
    trip_short_name: row.trip_short_name ? String(row.trip_short_name) : undefined,
    direction_id: row.direction_id !== null ? Number(row.direction_id) : undefined,
    block_id: row.block_id ? String(row.block_id) : undefined,
    shape_id: row.shape_id ? String(row.shape_id) : undefined,
    wheelchair_accessible: row.wheelchair_accessible !== null ? Number(row.wheelchair_accessible) : undefined,
    bikes_allowed: row.bikes_allowed !== null ? Number(row.bikes_allowed) : undefined,
  };
}
