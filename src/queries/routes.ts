/**
 * Route Query Methods
 */

import type { Database } from 'sql.js';
import type { Route } from '../types/gtfs';

export interface RouteFilters {
  routeId?: string | string[];
  agencyId?: string | string[];
  limit?: number;
}

/**
 * Get routes with optional filters
 * - Filters support both single values and arrays
 */
export function getRoutes(db: Database, filters: RouteFilters = {}): Route[] {
  const { routeId, agencyId, limit } = filters;

  // Build WHERE clause dynamically
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (routeId) {
    const routeIds = Array.isArray(routeId) ? routeId : [routeId];
    if (routeIds.length > 0) {
      const placeholders = routeIds.map(() => '?').join(', ');
      conditions.push(`route_id IN (${placeholders})`);
      params.push(...routeIds);
    }
  }

  if (agencyId) {
    const agencyIds = Array.isArray(agencyId) ? agencyId : [agencyId];
    if (agencyIds.length > 0) {
      const placeholders = agencyIds.map(() => '?').join(', ');
      conditions.push(`agency_id IN (${placeholders})`);
      params.push(...agencyIds);
    }
  }

  // Build SQL query
  let sql = 'SELECT * FROM routes';
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY route_short_name, route_long_name';
  if (limit) {
    sql += ' LIMIT ?';
    params.push(limit);
  }

  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }

  const routes: Route[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    routes.push(rowToRoute(row));
  }

  stmt.free();
  return routes;
}

/**
 * Convert database row to Route object
 */
function rowToRoute(row: Record<string, unknown>): Route {
  return {
    route_id: String(row.route_id),
    route_short_name: String(row.route_short_name),
    route_long_name: String(row.route_long_name),
    route_type: Number(row.route_type),
    agency_id: row.agency_id ? String(row.agency_id) : undefined,
    route_desc: row.route_desc ? String(row.route_desc) : undefined,
    route_url: row.route_url ? String(row.route_url) : undefined,
    route_color: row.route_color ? String(row.route_color) : undefined,
    route_text_color: row.route_text_color ? String(row.route_text_color) : undefined,
    route_sort_order: row.route_sort_order !== null ? Number(row.route_sort_order) : undefined,
    continuous_pickup: row.continuous_pickup !== null ? Number(row.continuous_pickup) : undefined,
    continuous_drop_off: row.continuous_drop_off !== null ? Number(row.continuous_drop_off) : undefined,
  };
}
