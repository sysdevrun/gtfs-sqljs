import type { Database } from 'sql.js';
import type { StopTimeUpdate } from '../types/gtfs-rt';

export interface StopTimeUpdateFilters {
  tripId?: string;
  stopId?: string;
  stopSequence?: number;
  limit?: number;
}

/**
 * Parse stop time update from database row
 */
function parseStopTimeUpdate(row: Record<string, unknown>): StopTimeUpdate {
  const stu: StopTimeUpdate = {
    stop_sequence: row.stop_sequence !== null ? Number(row.stop_sequence) : undefined,
    stop_id: row.stop_id ? String(row.stop_id) : undefined,
    schedule_relationship: row.schedule_relationship !== null ? Number(row.schedule_relationship) : undefined
  };

  // Arrival event
  if (row.arrival_delay !== null || row.arrival_time !== null || row.arrival_uncertainty !== null) {
    stu.arrival = {
      delay: row.arrival_delay !== null ? Number(row.arrival_delay) : undefined,
      time: row.arrival_time !== null ? Number(row.arrival_time) : undefined,
      uncertainty: row.arrival_uncertainty !== null ? Number(row.arrival_uncertainty) : undefined
    };
  }

  // Departure event
  if (row.departure_delay !== null || row.departure_time !== null || row.departure_uncertainty !== null) {
    stu.departure = {
      delay: row.departure_delay !== null ? Number(row.departure_delay) : undefined,
      time: row.departure_time !== null ? Number(row.departure_time) : undefined,
      uncertainty: row.departure_uncertainty !== null ? Number(row.departure_uncertainty) : undefined
    };
  }

  return stu;
}

/**
 * Extended StopTimeUpdate with trip_id and rt_last_updated for debugging
 */
export interface StopTimeUpdateWithMetadata extends StopTimeUpdate {
  trip_id: string;
  rt_last_updated: number;
}

/**
 * Parse stop time update with metadata from database row
 */
function parseStopTimeUpdateWithMetadata(row: Record<string, unknown>): StopTimeUpdateWithMetadata {
  const stu = parseStopTimeUpdate(row) as StopTimeUpdateWithMetadata;
  stu.trip_id = String(row.trip_id);
  stu.rt_last_updated = Number(row.rt_last_updated);
  return stu;
}

/**
 * Get stop time updates with optional filters
 */
export function getStopTimeUpdates(
  db: Database,
  filters: StopTimeUpdateFilters = {},
  stalenessThreshold: number = 120
): StopTimeUpdate[] {
  const { tripId, stopId, stopSequence, limit } = filters;

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  // Filter by trip_id
  if (tripId) {
    conditions.push('trip_id = ?');
    params.push(tripId);
  }

  // Filter by stop_id
  if (stopId) {
    conditions.push('stop_id = ?');
    params.push(stopId);
  }

  // Filter by stop_sequence
  if (stopSequence !== undefined) {
    conditions.push('stop_sequence = ?');
    params.push(stopSequence);
  }

  // Staleness filter (always applied)
  const now = Math.floor(Date.now() / 1000);
  const staleThreshold = now - stalenessThreshold;
  conditions.push('rt_last_updated >= ?');
  params.push(staleThreshold);

  // Build query
  let sql = 'SELECT * FROM rt_stop_time_updates';
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY trip_id, stop_sequence';

  if (limit) {
    sql += ' LIMIT ?';
    params.push(limit);
  }

  // Execute query
  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }

  const stopTimeUpdates: StopTimeUpdate[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    stopTimeUpdates.push(parseStopTimeUpdate(row));
  }

  stmt.free();
  return stopTimeUpdates;
}

/**
 * Get stop time updates for a specific trip
 */
export function getStopTimeUpdatesByTripId(
  db: Database,
  tripId: string,
  stalenessThreshold: number = 120
): StopTimeUpdate[] {
  return getStopTimeUpdates(db, { tripId }, stalenessThreshold);
}

/**
 * Get all stop time updates without staleness filtering (for debugging)
 * Returns extended type with trip_id and rt_last_updated for debugging purposes
 */
export function getAllStopTimeUpdates(db: Database): StopTimeUpdateWithMetadata[] {
  const sql = 'SELECT * FROM rt_stop_time_updates ORDER BY trip_id, stop_sequence';
  const stmt = db.prepare(sql);

  const stopTimeUpdates: StopTimeUpdateWithMetadata[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    stopTimeUpdates.push(parseStopTimeUpdateWithMetadata(row));
  }

  stmt.free();
  return stopTimeUpdates;
}
