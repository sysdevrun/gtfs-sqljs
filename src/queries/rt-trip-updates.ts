import type { Database } from 'sql.js';
import type { TripUpdate } from '../types/gtfs-rt';

export interface TripUpdateFilters {
  tripId?: string;
  routeId?: string;
  vehicleId?: string;
  limit?: number;
}

/**
 * Parse trip update from database row
 */
export function parseTripUpdate(row: Record<string, unknown>): TripUpdate {
  const tu: TripUpdate = {
    trip_id: String(row.trip_id),
    route_id: row.route_id ? String(row.route_id) : undefined,
    stop_time_update: [], // Will be populated separately
    timestamp: row.timestamp !== null ? Number(row.timestamp) : undefined,
    delay: row.delay !== null ? Number(row.delay) : undefined,
    schedule_relationship: row.schedule_relationship !== null ? Number(row.schedule_relationship) : undefined,
    rt_last_updated: Number(row.rt_last_updated)
  };

  // Vehicle descriptor
  if (row.vehicle_id || row.vehicle_label || row.vehicle_license_plate) {
    tu.vehicle = {
      id: row.vehicle_id ? String(row.vehicle_id) : undefined,
      label: row.vehicle_label ? String(row.vehicle_label) : undefined,
      license_plate: row.vehicle_license_plate ? String(row.vehicle_license_plate) : undefined
    };
  }

  return tu;
}

/**
 * Get trip updates with optional filters
 */
export function getTripUpdates(
  db: Database,
  filters: TripUpdateFilters = {},
  stalenessThreshold: number = 120
): TripUpdate[] {
  const { tripId, routeId, vehicleId, limit } = filters;

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  // Filter by trip_id
  if (tripId) {
    conditions.push('trip_id = ?');
    params.push(tripId);
  }

  // Filter by route_id
  if (routeId) {
    conditions.push('route_id = ?');
    params.push(routeId);
  }

  // Filter by vehicle_id
  if (vehicleId) {
    conditions.push('vehicle_id = ?');
    params.push(vehicleId);
  }

  // Staleness filter (always applied)
  const now = Math.floor(Date.now() / 1000);
  const staleThreshold = now - stalenessThreshold;
  conditions.push('rt_last_updated >= ?');
  params.push(staleThreshold);

  // Build query
  let sql = 'SELECT * FROM rt_trip_updates';
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY rt_last_updated DESC';

  if (limit) {
    sql += ' LIMIT ?';
    params.push(limit);
  }

  // Execute query
  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }

  const tripUpdates: TripUpdate[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    tripUpdates.push(parseTripUpdate(row));
  }

  stmt.free();
  return tripUpdates;
}

/**
 * Get trip update by trip ID
 */
export function getTripUpdateByTripId(
  db: Database,
  tripId: string,
  stalenessThreshold: number = 120
): TripUpdate | null {
  const updates = getTripUpdates(db, { tripId, limit: 1 }, stalenessThreshold);
  return updates.length > 0 ? updates[0] : null;
}

/**
 * Get all trip updates without staleness filtering (for debugging)
 */
export function getAllTripUpdates(db: Database): TripUpdate[] {
  const sql = 'SELECT * FROM rt_trip_updates ORDER BY rt_last_updated DESC';
  const stmt = db.prepare(sql);

  const tripUpdates: TripUpdate[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    tripUpdates.push(parseTripUpdate(row));
  }

  stmt.free();
  return tripUpdates;
}
