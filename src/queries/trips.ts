/**
 * Trip Query Methods
 */

import type { Database } from 'sql.js';
import type { Trip } from '../types/gtfs';
import type { TripRealtime, VehiclePosition } from '../types/gtfs-rt';
import { parseVehiclePosition } from './rt-vehicle-positions';

export interface TripFilters {
  tripId?: string | string[];
  routeId?: string | string[];
  serviceIds?: string | string[];
  directionId?: number | number[];
  agencyId?: string | string[];
  includeRealtime?: boolean;
  limit?: number;
}

export interface TripWithRealtime extends Trip {
  realtime?: TripRealtime;
}

/**
 * Merge realtime data with trips
 */
function mergeRealtimeData(
  trips: Trip[],
  db: Database,
  stalenessThreshold: number
): TripWithRealtime[] {
  const now = Math.floor(Date.now() / 1000);
  const staleThreshold = now - stalenessThreshold;

  const tripIds = trips.map(t => t.trip_id);
  if (tripIds.length === 0) return trips;

  const placeholders = tripIds.map(() => '?').join(', ');

  // Get vehicle positions
  const vpStmt = db.prepare(`
    SELECT * FROM rt_vehicle_positions
    WHERE trip_id IN (${placeholders})
      AND rt_last_updated >= ?
  `);
  vpStmt.bind([...tripIds, staleThreshold]);

  const vpMap = new Map<string, VehiclePosition>();
  while (vpStmt.step()) {
    const row = vpStmt.getAsObject() as Record<string, unknown>;
    const vp = parseVehiclePosition(row);
    vpMap.set(vp.trip_id, vp);
  }
  vpStmt.free();

  // Get trip updates
  const tuStmt = db.prepare(`
    SELECT * FROM rt_trip_updates
    WHERE trip_id IN (${placeholders})
      AND rt_last_updated >= ?
  `);
  tuStmt.bind([...tripIds, staleThreshold]);

  const tuMap = new Map<string, { delay?: number; schedule_relationship?: number }>();
  while (tuStmt.step()) {
    const row = tuStmt.getAsObject() as Record<string, unknown>;
    const tripId = String(row.trip_id);
    tuMap.set(tripId, {
      delay: row.delay !== null ? Number(row.delay) : undefined,
      schedule_relationship: row.schedule_relationship !== null ? Number(row.schedule_relationship) : undefined
    });
  }
  tuStmt.free();

  // Merge realtime data
  return trips.map((trip): TripWithRealtime => {
    const vp = vpMap.get(trip.trip_id);
    const tu = tuMap.get(trip.trip_id);

    if (!vp && !tu) {
      return { ...trip, realtime: { vehicle_position: null, trip_update: null } };
    }

    return {
      ...trip,
      realtime: {
        vehicle_position: vp || null,
        trip_update: tu || null
      }
    };
  });
}

/**
 * Get trips with optional filters
 * - Filters support both single values and arrays
 */
export function getTrips(
  db: Database,
  filters: TripFilters = {},
  stalenessThreshold: number = 120
): Trip[] | TripWithRealtime[] {
  const { tripId, routeId, serviceIds, directionId, agencyId, includeRealtime, limit } = filters;

  // Determine if we need to join with routes table
  const needsRoutesJoin = agencyId !== undefined;

  // Build WHERE clause dynamically
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (tripId) {
    const tripIds = Array.isArray(tripId) ? tripId : [tripId];
    if (tripIds.length > 0) {
      const placeholders = tripIds.map(() => '?').join(', ');
      conditions.push(needsRoutesJoin ? `t.trip_id IN (${placeholders})` : `trip_id IN (${placeholders})`);
      params.push(...tripIds);
    }
  }

  if (routeId) {
    const routeIds = Array.isArray(routeId) ? routeId : [routeId];
    if (routeIds.length > 0) {
      const placeholders = routeIds.map(() => '?').join(', ');
      conditions.push(needsRoutesJoin ? `t.route_id IN (${placeholders})` : `route_id IN (${placeholders})`);
      params.push(...routeIds);
    }
  }

  if (serviceIds) {
    const serviceIdArray = Array.isArray(serviceIds) ? serviceIds : [serviceIds];
    if (serviceIdArray.length > 0) {
      const placeholders = serviceIdArray.map(() => '?').join(', ');
      conditions.push(needsRoutesJoin ? `t.service_id IN (${placeholders})` : `service_id IN (${placeholders})`);
      params.push(...serviceIdArray);
    }
  }

  if (directionId !== undefined) {
    const directionIds = Array.isArray(directionId) ? directionId : [directionId];
    if (directionIds.length > 0) {
      const placeholders = directionIds.map(() => '?').join(', ');
      conditions.push(needsRoutesJoin ? `t.direction_id IN (${placeholders})` : `direction_id IN (${placeholders})`);
      params.push(...directionIds);
    }
  }

  if (agencyId) {
    const agencyIds = Array.isArray(agencyId) ? agencyId : [agencyId];
    if (agencyIds.length > 0) {
      const placeholders = agencyIds.map(() => '?').join(', ');
      conditions.push(`r.agency_id IN (${placeholders})`);
      params.push(...agencyIds);
    }
  }

  // Build SQL query
  let sql = needsRoutesJoin
    ? 'SELECT t.* FROM trips t INNER JOIN routes r ON t.route_id = r.route_id'
    : 'SELECT * FROM trips';

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  if (limit) {
    sql += ' LIMIT ?';
    params.push(limit);
  }

  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }

  const trips: Trip[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    trips.push(rowToTrip(row));
  }

  stmt.free();

  // Merge realtime data if requested
  if (includeRealtime) {
    return mergeRealtimeData(trips, db, stalenessThreshold);
  }

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
