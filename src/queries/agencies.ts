/**
 * Agency Query Methods
 */

import type { Database } from 'sql.js';
import type { Agency } from '../types/gtfs';

export interface AgencyFilters {
  agencyId?: string;
  limit?: number;
}

/**
 * Get agencies with optional filters
 */
export function getAgencies(db: Database, filters: AgencyFilters = {}): Agency[] {
  const { agencyId, limit } = filters;

  // Build WHERE clause dynamically
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (agencyId) {
    conditions.push('agency_id = ?');
    params.push(agencyId);
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
 * Get an agency by its agency_id
 */
export function getAgencyById(db: Database, agencyId: string): Agency | null {
  const stmt = db.prepare('SELECT * FROM agency WHERE agency_id = ?');
  stmt.bind([agencyId]);

  if (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    stmt.free();
    return rowToAgency(row);
  }

  stmt.free();
  return null;
}

/**
 * Get all agencies
 */
export function getAllAgencies(db: Database, limit?: number): Agency[] {
  const sql = limit
    ? `SELECT * FROM agency ORDER BY agency_name LIMIT ${limit}`
    : 'SELECT * FROM agency ORDER BY agency_name';

  const stmt = db.prepare(sql);

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
