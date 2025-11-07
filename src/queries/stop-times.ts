/**
 * Stop Time Query Methods
 */

import type { Database } from 'sql.js';
import type { StopTime } from '../types/gtfs';
import type { StopTimeRealtime } from '../types/gtfs-rt';

export interface StopTimeFilters {
  tripId?: string | string[];
  stopId?: string | string[];
  routeId?: string | string[];
  serviceIds?: string | string[];
  directionId?: number | number[];
  agencyId?: string | string[];
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
           arrival_delay, arrival_time, departure_delay, departure_time, schedule_relationship
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
      arrival_time: row.arrival_time !== null ? Number(row.arrival_time) : undefined,
      departure_delay: row.departure_delay !== null ? Number(row.departure_delay) : undefined,
      departure_time: row.departure_time !== null ? Number(row.departure_time) : undefined,
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
 * - Filters support both single values and arrays
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
    const tripIds = Array.isArray(tripId) ? tripId : [tripId];
    if (tripIds.length > 0) {
      const placeholders = tripIds.map(() => '?').join(', ');
      conditions.push(needsTripsJoin ? `st.trip_id IN (${placeholders})` : `trip_id IN (${placeholders})`);
      params.push(...tripIds);
    }
  }

  if (stopId) {
    const stopIds = Array.isArray(stopId) ? stopId : [stopId];
    if (stopIds.length > 0) {
      const placeholders = stopIds.map(() => '?').join(', ');
      conditions.push(needsTripsJoin ? `st.stop_id IN (${placeholders})` : `stop_id IN (${placeholders})`);
      params.push(...stopIds);
    }
  }

  if (routeId) {
    const routeIds = Array.isArray(routeId) ? routeId : [routeId];
    if (routeIds.length > 0) {
      const placeholders = routeIds.map(() => '?').join(', ');
      conditions.push(`t.route_id IN (${placeholders})`);
      params.push(...routeIds);
    }
  }

  if (serviceIds) {
    const serviceIdArray = Array.isArray(serviceIds) ? serviceIds : [serviceIds];
    if (serviceIdArray.length > 0) {
      const placeholders = serviceIdArray.map(() => '?').join(', ');
      conditions.push(`t.service_id IN (${placeholders})`);
      params.push(...serviceIdArray);
    }
  }

  if (directionId !== undefined) {
    const directionIds = Array.isArray(directionId) ? directionId : [directionId];
    if (directionIds.length > 0) {
      const placeholders = directionIds.map(() => '?').join(', ');
      conditions.push(`t.direction_id IN (${placeholders})`);
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
