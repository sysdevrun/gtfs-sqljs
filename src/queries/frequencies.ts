/**
 * Frequency Query Methods
 */

import type { GtfsDatabase, Row } from '../adapters/types';
import type { Frequency } from '../types/gtfs';

export interface FrequencyFilters {
  tripId?: string | string[];
  limit?: number;
}

/**
 * Get frequencies with optional filters
 * - Filters support both single values and arrays
 */
export async function getFrequencies(db: GtfsDatabase, filters: FrequencyFilters = {}): Promise<Frequency[]> {
  const { tripId, limit } = filters;

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (tripId) {
    const tripIds = Array.isArray(tripId) ? tripId : [tripId];
    if (tripIds.length > 0) {
      const placeholders = tripIds.map(() => '?').join(', ');
      conditions.push(`trip_id IN (${placeholders})`);
      params.push(...tripIds);
    }
  }

  let sql = 'SELECT * FROM frequencies';
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY trip_id, start_time';
  if (limit) {
    sql += ' LIMIT ?';
    params.push(limit);
  }

  const stmt = await db.prepare(sql);
  if (params.length > 0) {
    await stmt.bind(params);
  }

  const frequencies: Frequency[] = [];
  while (await stmt.step()) {
    const row = await stmt.getAsObject();
    frequencies.push(rowToFrequency(row));
  }

  await stmt.free();
  return frequencies;
}

/**
 * Convert database row to Frequency object
 */
function rowToFrequency(row: Row): Frequency {
  return {
    trip_id: String(row.trip_id),
    start_time: String(row.start_time),
    end_time: String(row.end_time),
    headway_secs: Number(row.headway_secs),
    // exact_times: 0 (frequency-based) is meaningful — only null maps to undefined
    exact_times: row.exact_times !== null ? Number(row.exact_times) : undefined,
  };
}
