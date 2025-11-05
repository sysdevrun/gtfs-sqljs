/**
 * Route Query Methods
 */

import type { Database } from 'sql.js';
import type { Route } from '../types/gtfs';

export interface RouteFilters {
  routeId?: string;
  agencyId?: string;
  limit?: number;
}

/**
 * Get routes with optional filters
 */
export function getRoutes(db: Database, filters: RouteFilters = {}): Route[] {
  const { routeId, agencyId, limit } = filters;

  // Build WHERE clause dynamically
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (routeId) {
    conditions.push('route_id = ?');
    params.push(routeId);
  }

  if (agencyId) {
    conditions.push('agency_id = ?');
    params.push(agencyId);
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
 * Get a route by its route_id
 */
export function getRouteById(db: Database, routeId: string): Route | null {
  const stmt = db.prepare('SELECT * FROM routes WHERE route_id = ?');
  stmt.bind([routeId]);

  if (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    stmt.free();
    return rowToRoute(row);
  }

  stmt.free();
  return null;
}

/**
 * Get all routes
 */
export function getAllRoutes(db: Database, limit?: number): Route[] {
  const sql = limit
    ? `SELECT * FROM routes ORDER BY route_short_name, route_long_name LIMIT ${limit}`
    : 'SELECT * FROM routes ORDER BY route_short_name, route_long_name';

  const stmt = db.prepare(sql);

  const routes: Route[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    routes.push(rowToRoute(row));
  }

  stmt.free();
  return routes;
}

/**
 * Get routes by agency
 */
export function getRoutesByAgency(db: Database, agencyId: string): Route[] {
  const stmt = db.prepare(
    'SELECT * FROM routes WHERE agency_id = ? ORDER BY route_short_name, route_long_name'
  );
  stmt.bind([agencyId]);

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
