import type { Database} from 'sql.js';
import type { VehiclePosition } from '../types/gtfs-rt';
import type { VehiclePositionFilters } from '../types/gtfs-rt';

export type { VehiclePositionFilters };

/**
 * Parse vehicle position from database row
 */
function parseVehiclePosition(row: Record<string, unknown>): VehiclePosition {
  const vp: VehiclePosition = {
    trip_id: String(row.trip_id),
    route_id: row.route_id ? String(row.route_id) : undefined,
    rt_last_updated: Number(row.rt_last_updated)
  };

  // Vehicle descriptor
  if (row.vehicle_id || row.vehicle_label || row.vehicle_license_plate) {
    vp.vehicle = {
      id: row.vehicle_id ? String(row.vehicle_id) : undefined,
      label: row.vehicle_label ? String(row.vehicle_label) : undefined,
      license_plate: row.vehicle_license_plate ? String(row.vehicle_license_plate) : undefined
    };
  }

  // Position
  if (row.latitude !== null && row.longitude !== null) {
    vp.position = {
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      bearing: row.bearing !== null ? Number(row.bearing) : undefined,
      odometer: row.odometer !== null ? Number(row.odometer) : undefined,
      speed: row.speed !== null ? Number(row.speed) : undefined
    };
  }

  // Other fields
  if (row.current_stop_sequence !== null) {
    vp.current_stop_sequence = Number(row.current_stop_sequence);
  }
  if (row.stop_id) {
    vp.stop_id = String(row.stop_id);
  }
  if (row.current_status !== null) {
    vp.current_status = Number(row.current_status);
  }
  if (row.timestamp !== null) {
    vp.timestamp = Number(row.timestamp);
  }
  if (row.congestion_level !== null) {
    vp.congestion_level = Number(row.congestion_level);
  }
  if (row.occupancy_status !== null) {
    vp.occupancy_status = Number(row.occupancy_status);
  }

  return vp;
}

/**
 * Get vehicle positions with optional filters
 */
export function getVehiclePositions(
  db: Database,
  filters: VehiclePositionFilters = {},
  stalenessThreshold: number = 120
): VehiclePosition[] {
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
  let sql = 'SELECT * FROM rt_vehicle_positions';
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

  const positions: VehiclePosition[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    positions.push(parseVehiclePosition(row));
  }

  stmt.free();
  return positions;
}

/**
 * Get vehicle position by trip ID
 */
export function getVehiclePositionByTripId(
  db: Database,
  tripId: string,
  stalenessThreshold: number = 120
): VehiclePosition | null {
  const positions = getVehiclePositions(db, { tripId, limit: 1 }, stalenessThreshold);
  return positions.length > 0 ? positions[0] : null;
}
