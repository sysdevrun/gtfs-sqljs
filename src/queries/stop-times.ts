/**
 * Stop Time Query Methods
 */

import type { Database } from 'sql.js';
import type { StopTime } from '../types/gtfs';

/**
 * Get stop times for a trip
 */
export function getStopTimesByTrip(db: Database, tripId: string): StopTime[] {
  const stmt = db.prepare('SELECT * FROM stop_times WHERE trip_id = ? ORDER BY stop_sequence');
  stmt.bind([tripId]);

  const stopTimes: StopTime[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    stopTimes.push(rowToStopTime(row));
  }

  stmt.free();
  return stopTimes;
}

/**
 * Get stop times for a stop
 */
export function getStopTimesByStop(db: Database, stopId: string, limit = 100): StopTime[] {
  const stmt = db.prepare(
    'SELECT * FROM stop_times WHERE stop_id = ? ORDER BY arrival_time LIMIT ?'
  );
  stmt.bind([stopId, limit]);

  const stopTimes: StopTime[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    stopTimes.push(rowToStopTime(row));
  }

  stmt.free();
  return stopTimes;
}

/**
 * Get stop times for a stop and specific trips (filtered by route/date)
 */
export function getStopTimesByStopAndTrips(
  db: Database,
  stopId: string,
  tripIds: string[]
): StopTime[] {
  if (tripIds.length === 0) {
    return [];
  }

  const placeholders = tripIds.map(() => '?').join(', ');
  const stmt = db.prepare(
    `SELECT * FROM stop_times
     WHERE stop_id = ? AND trip_id IN (${placeholders})
     ORDER BY arrival_time`
  );
  stmt.bind([stopId, ...tripIds]);

  const stopTimes: StopTime[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    stopTimes.push(rowToStopTime(row));
  }

  stmt.free();
  return stopTimes;
}

/**
 * Get stop times for a stop, route, and direction on a specific date
 */
export function getStopTimesForStopRouteDirection(
  db: Database,
  stopId: string,
  routeId: string,
  serviceIds: string[],
  directionId?: number
): StopTime[] {
  if (serviceIds.length === 0) {
    return [];
  }

  const placeholders = serviceIds.map(() => '?').join(', ');

  let sql = `
    SELECT st.* FROM stop_times st
    INNER JOIN trips t ON st.trip_id = t.trip_id
    WHERE st.stop_id = ?
    AND t.route_id = ?
    AND t.service_id IN (${placeholders})
  `;

  const params: (string | number)[] = [stopId, routeId, ...serviceIds];

  if (directionId !== undefined) {
    sql += ' AND t.direction_id = ?';
    params.push(directionId);
  }

  sql += ' ORDER BY st.arrival_time';

  const stmt = db.prepare(sql);
  stmt.bind(params);

  const stopTimes: StopTime[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    stopTimes.push(rowToStopTime(row));
  }

  stmt.free();
  return stopTimes;
}

/**
 * Convert database row to StopTime object
 */
function rowToStopTime(row: Record<string, unknown>): StopTime {
  return {
    trip_id: String(row.trip_id),
    arrival_time: String(row.arrival_time),
    departure_time: String(row.departure_time),
    stop_id: String(row.stop_id),
    stop_sequence: Number(row.stop_sequence),
    stop_headsign: row.stop_headsign ? String(row.stop_headsign) : undefined,
    pickup_type: row.pickup_type !== null ? Number(row.pickup_type) : undefined,
    drop_off_type: row.drop_off_type !== null ? Number(row.drop_off_type) : undefined,
    continuous_pickup: row.continuous_pickup !== null ? Number(row.continuous_pickup) : undefined,
    continuous_drop_off: row.continuous_drop_off !== null ? Number(row.continuous_drop_off) : undefined,
    shape_dist_traveled: row.shape_dist_traveled !== null ? Number(row.shape_dist_traveled) : undefined,
    timepoint: row.timepoint !== null ? Number(row.timepoint) : undefined,
  };
}
