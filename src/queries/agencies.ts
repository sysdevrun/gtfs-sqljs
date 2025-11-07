/**
 * Agency Query Methods
 */

import type { Database } from 'sql.js';
import type { Agency } from '../types/gtfs';

export interface AgencyFilters {
  agencyId?: string | string[];
  limit?: number;
}

/**
 * Get agencies with optional filters
 * - Filters support both single values and arrays
 */
export function getAgencies(db: Database, filters: AgencyFilters = {}): Agency[] {
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

  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }

  const agencies: Agency[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    agencies.push(rowToAgency(row));
  }

  stmt.free();
  return agencies;
}

/**
 * Convert database row to Agency object
 */
function rowToAgency(row: Record<string, unknown>): Agency {
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
