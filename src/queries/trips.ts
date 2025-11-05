/**
 * Trip Query Methods
 */

import type { Database } from 'sql.js';
import type { Trip } from '../types/gtfs';
import type { TripRealtime, VehiclePosition } from '../types/gtfs-rt';

export interface TripFilters {
  tripId?: string;
  routeId?: string;
  serviceIds?: string[];
  directionId?: number;
  agencyId?: string;
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

  const vpMap = new Map<string, Record<string, unknown>>();
  while (vpStmt.step()) {
    const row = vpStmt.getAsObject() as Record<string, unknown>;
    vpMap.set(String(row.trip_id), row);
  }
  vpStmt.free();

  // Get trip updates
  const tuStmt = db.prepare(`
    SELECT * FROM rt_trip_updates
    WHERE trip_id IN (${placeholders})
      AND rt_last_updated >= ?
  `);
  tuStmt.bind([...tripIds, staleThreshold]);

  const tuMap = new Map<string, Record<string, unknown>>();
  while (tuStmt.step()) {
    const row = tuStmt.getAsObject() as Record<string, unknown>;
    tuMap.set(String(row.trip_id), row);
  }
  tuStmt.free();

  // Merge realtime data
  return trips.map((trip): TripWithRealtime => {
    const vpRow = vpMap.get(trip.trip_id);
    const tuRow = tuMap.get(trip.trip_id);

    if (!vpRow && !tuRow) {
      return { ...trip, realtime: { vehicle_position: null, trip_update: null } };
    }

    const realtime: TripRealtime = {
      vehicle_position: null,
      trip_update: null
    };

    // Parse vehicle position
    if (vpRow) {
      const vp: VehiclePosition = {
        trip_id: String(vpRow.trip_id),
        route_id: vpRow.route_id ? String(vpRow.route_id) : undefined,
        rt_last_updated: Number(vpRow.rt_last_updated)
      };

      if (vpRow.vehicle_id || vpRow.vehicle_label || vpRow.vehicle_license_plate) {
        vp.vehicle = {
          id: vpRow.vehicle_id ? String(vpRow.vehicle_id) : undefined,
          label: vpRow.vehicle_label ? String(vpRow.vehicle_label) : undefined,
          license_plate: vpRow.vehicle_license_plate ? String(vpRow.vehicle_license_plate) : undefined
        };
      }

      if (vpRow.latitude !== null && vpRow.longitude !== null) {
        vp.position = {
          latitude: Number(vpRow.latitude),
          longitude: Number(vpRow.longitude),
          bearing: vpRow.bearing !== null ? Number(vpRow.bearing) : undefined,
          odometer: vpRow.odometer !== null ? Number(vpRow.odometer) : undefined,
          speed: vpRow.speed !== null ? Number(vpRow.speed) : undefined
        };
      }

      if (vpRow.current_stop_sequence !== null) vp.current_stop_sequence = Number(vpRow.current_stop_sequence);
      if (vpRow.stop_id) vp.stop_id = String(vpRow.stop_id);
      if (vpRow.current_status !== null) vp.current_status = Number(vpRow.current_status);
      if (vpRow.timestamp !== null) vp.timestamp = Number(vpRow.timestamp);
      if (vpRow.congestion_level !== null) vp.congestion_level = Number(vpRow.congestion_level);
      if (vpRow.occupancy_status !== null) vp.occupancy_status = Number(vpRow.occupancy_status);

      realtime.vehicle_position = vp;
    }

    // Parse trip update
    if (tuRow) {
      realtime.trip_update = {
        delay: tuRow.delay !== null ? Number(tuRow.delay) : undefined,
        schedule_relationship: tuRow.schedule_relationship !== null ? Number(tuRow.schedule_relationship) : undefined
      };
    }

    return { ...trip, realtime };
  });
}

/**
 * Get trips with optional filters
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
    conditions.push(needsRoutesJoin ? 't.trip_id = ?' : 'trip_id = ?');
    params.push(tripId);
  }

  if (routeId) {
    conditions.push(needsRoutesJoin ? 't.route_id = ?' : 'route_id = ?');
    params.push(routeId);
  }

  if (serviceIds && serviceIds.length > 0) {
    const placeholders = serviceIds.map(() => '?').join(', ');
    conditions.push(needsRoutesJoin ? `t.service_id IN (${placeholders})` : `service_id IN (${placeholders})`);
    params.push(...serviceIds);
  }

  if (directionId !== undefined) {
    conditions.push(needsRoutesJoin ? 't.direction_id = ?' : 'direction_id = ?');
    params.push(directionId);
  }

  if (agencyId) {
    conditions.push('r.agency_id = ?');
    params.push(agencyId);
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
 * Get all trips for a service (active on a given date)
 */
export function getTripsByService(db: Database, serviceIds: string[]): Trip[] {
  if (serviceIds.length === 0) {
    return [];
  }

  const placeholders = serviceIds.map(() => '?').join(', ');
  const stmt = db.prepare(`SELECT * FROM trips WHERE service_id IN (${placeholders})`);
  stmt.bind(serviceIds);

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
