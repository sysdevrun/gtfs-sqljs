/**
 * Stop Time Query Methods
 */

import type { Database } from 'sql.js';
import type { StopTime } from '../types/gtfs';
import type { StopTimeRealtime } from '../types/gtfs-rt';

export interface StopTimeFilters {
  tripId?: string;
  stopId?: string;
  routeId?: string;
  serviceIds?: string[];
  directionId?: number;
  agencyId?: string;
  includeRealtime?: boolean;
  limit?: number;
}

export interface StopTimeWithRealtime extends StopTime {
  realtime?: StopTimeRealtime;
}

/**
 * Merge realtime data with stop times
 */
function mergeRealtimeData(
  stopTimes: StopTime[],
  db: Database,
  stalenessThreshold: number
): StopTimeWithRealtime[] {
  const now = Math.floor(Date.now() / 1000);
  const staleThreshold = now - stalenessThreshold;

  // Build map of trip_id -> stop times for this query
  const tripIds = Array.from(new Set(stopTimes.map(st => st.trip_id)));
  if (tripIds.length === 0) return stopTimes;

  const placeholders = tripIds.map(() => '?').join(', ');
  const stmt = db.prepare(`
    SELECT trip_id, stop_sequence, stop_id,
           arrival_delay, departure_delay, schedule_relationship
    FROM rt_stop_time_updates
    WHERE trip_id IN (${placeholders})
      AND rt_last_updated >= ?
  `);
  stmt.bind([...tripIds, staleThreshold]);

  // Build map of trip_id+stop_sequence -> RT data
  const rtMap = new Map<string, StopTimeRealtime>();
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    const key = `${row.trip_id}_${row.stop_sequence}`;
    rtMap.set(key, {
      arrival_delay: row.arrival_delay !== null ? Number(row.arrival_delay) : undefined,
      departure_delay: row.departure_delay !== null ? Number(row.departure_delay) : undefined,
      schedule_relationship: row.schedule_relationship !== null ? Number(row.schedule_relationship) : undefined
    });
  }
  stmt.free();

  // Merge RT data with stop times
  return stopTimes.map((st): StopTimeWithRealtime => {
    const key = `${st.trip_id}_${st.stop_sequence}`;
    const rtData = rtMap.get(key);

    if (rtData) {
      return { ...st, realtime: rtData };
    }
    return st;
  });
}

/**
 * Get stop times with optional filters
 */
export function getStopTimes(
  db: Database,
  filters: StopTimeFilters = {},
  stalenessThreshold: number = 120
): StopTime[] | StopTimeWithRealtime[] {
  const { tripId, stopId, routeId, serviceIds, directionId, agencyId, includeRealtime, limit } = filters;

  // Determine if we need to join with trips and/or routes table
  const needsTripsJoin = routeId || serviceIds || directionId !== undefined || agencyId !== undefined;
  const needsRoutesJoin = agencyId !== undefined;

  // Build WHERE clause dynamically
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (tripId) {
    conditions.push(needsTripsJoin ? 'st.trip_id = ?' : 'trip_id = ?');
    params.push(tripId);
  }

  if (stopId) {
    conditions.push(needsTripsJoin ? 'st.stop_id = ?' : 'stop_id = ?');
    params.push(stopId);
  }

  if (routeId) {
    conditions.push('t.route_id = ?');
    params.push(routeId);
  }

  if (serviceIds && serviceIds.length > 0) {
    const placeholders = serviceIds.map(() => '?').join(', ');
    conditions.push(`t.service_id IN (${placeholders})`);
    params.push(...serviceIds);
  }

  if (directionId !== undefined) {
    conditions.push('t.direction_id = ?');
    params.push(directionId);
  }

  if (agencyId) {
    conditions.push('r.agency_id = ?');
    params.push(agencyId);
  }

  // Build SQL query
  let sql: string;
  if (needsRoutesJoin) {
    sql = 'SELECT st.* FROM stop_times st INNER JOIN trips t ON st.trip_id = t.trip_id INNER JOIN routes r ON t.route_id = r.route_id';
  } else if (needsTripsJoin) {
    sql = 'SELECT st.* FROM stop_times st INNER JOIN trips t ON st.trip_id = t.trip_id';
  } else {
    sql = 'SELECT * FROM stop_times';
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  // Order by stop_sequence if filtering by trip, otherwise by arrival_time
  sql += tripId ? ' ORDER BY stop_sequence' : ' ORDER BY arrival_time';

  if (limit) {
    sql += ' LIMIT ?';
    params.push(limit);
  }

  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }

  const stopTimes: StopTime[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    stopTimes.push(rowToStopTime(row));
  }

  stmt.free();

  // Merge realtime data if requested
  if (includeRealtime) {
    return mergeRealtimeData(stopTimes, db, stalenessThreshold);
  }

  return stopTimes;
}

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
