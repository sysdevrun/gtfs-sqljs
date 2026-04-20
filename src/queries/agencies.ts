/**
 * Agency Query Methods
 */

import type { GtfsDatabase, Row } from '../adapters/types';
import type { Agency } from '../types/gtfs';

export interface AgencyFilters {
  agencyId?: string | string[];
  limit?: number;
}

/**
 * Get agencies with optional filters
 * - Filters support both single values and arrays
 */
export async function getAgencies(db: GtfsDatabase, filters: AgencyFilters = {}): Promise<Agency[]> {
  const { agencyId, limit } = filters;

  // Build WHERE clause dynamically
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (agencyId) {
    const agencyIds = Array.isArray(agencyId) ? agencyId : [agencyId];
    if (agencyIds.length > 0) {
      const placeholders = agencyIds.map(() => '?').join(', ');
      conditions.push(`agency_id IN (${placeholders})`);
      params.push(...agencyIds);
    }
  }

  // Build SQL query
  let sql = 'SELECT * FROM agency';
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY agency_name';
  if (limit) {
    sql += ' LIMIT ?';
    params.push(limit);
  }

  const stmt = await db.prepare(sql);
  if (params.length > 0) {
    await stmt.bind(params);
  }

  const agencies: Agency[] = [];
  while (await stmt.step()) {
    const row = await stmt.getAsObject();
    agencies.push(rowToAgency(row));
  }

  await stmt.free();
  return agencies;
}

/**
 * Convert database row to Agency object
 */
function rowToAgency(row: Row): Agency {
  return {
    agency_id: String(row.agency_id),
    agency_name: String(row.agency_name),
    agency_url: String(row.agency_url),
    agency_timezone: String(row.agency_timezone),
    agency_lang: row.agency_lang ? String(row.agency_lang) : undefined,
    agency_phone: row.agency_phone ? String(row.agency_phone) : undefined,
    agency_fare_url: row.agency_fare_url ? String(row.agency_fare_url) : undefined,
    agency_email: row.agency_email ? String(row.agency_email) : undefined,
  };
}
