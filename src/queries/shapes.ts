/**
 * Shape Query Methods
 */

import type { Database } from 'sql.js';
import type { Shape, Route } from '../types/gtfs';

export interface ShapeFilters {
  shapeId?: string | string[];
  routeId?: string | string[];
  tripId?: string | string[];
  limit?: number;
}

export interface GeoJsonGeometry {
  type: 'LineString';
  coordinates: number[][];
}

export interface GeoJsonFeature {
  type: 'Feature';
  properties: {
    shape_id: string;
    route_id?: string;
    route_short_name?: string;
    route_long_name?: string;
    route_type?: number;
    route_color?: string;
    route_text_color?: string;
    agency_id?: string;
  };
  geometry: GeoJsonGeometry;
}

export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

/**
 * Get shapes with optional filters
 * - Filters support both single values and arrays
 */
export function getShapes(
  db: Database,
  filters: ShapeFilters = {}
): Shape[] {
  const { shapeId, routeId, tripId, limit } = filters;

  // Determine if we need to join with trips table
  const needsTripsJoin = routeId !== undefined || tripId !== undefined;

  // Build WHERE clause dynamically
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (shapeId) {
    const shapeIds = Array.isArray(shapeId) ? shapeId : [shapeId];
    if (shapeIds.length > 0) {
      const placeholders = shapeIds.map(() => '?').join(', ');
      conditions.push(needsTripsJoin ? `s.shape_id IN (${placeholders})` : `shape_id IN (${placeholders})`);
      params.push(...shapeIds);
    }
  }

  if (tripId) {
    const tripIds = Array.isArray(tripId) ? tripId : [tripId];
    if (tripIds.length > 0) {
      const placeholders = tripIds.map(() => '?').join(', ');
      conditions.push(`t.trip_id IN (${placeholders})`);
      params.push(...tripIds);
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

  // Build SQL query
  let sql: string;
  if (needsTripsJoin) {
    // Join with trips to filter by route_id or trip_id
    // Use DISTINCT shape_id to get unique shapes, then join back to get all points
    sql = `
      SELECT s.* FROM shapes s
      WHERE s.shape_id IN (
        SELECT DISTINCT t.shape_id FROM trips t
        WHERE t.shape_id IS NOT NULL
        ${conditions.length > 0 ? ' AND ' + conditions.join(' AND ') : ''}
      )
      ORDER BY s.shape_id, s.shape_pt_sequence
    `;
  } else {
    sql = 'SELECT * FROM shapes';
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY shape_id, shape_pt_sequence';
  }

  if (limit) {
    sql += ' LIMIT ?';
    params.push(limit);
  }

  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }

  const shapes: Shape[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    shapes.push(rowToShape(row));
  }

  stmt.free();

  return shapes;
}

/**
 * Convert shapes to GeoJSON FeatureCollection with optional precision
 * @param db - Database instance
 * @param filters - Same filters as getShapes
 * @param precision - Number of decimal places for coordinates (default: 6)
 */
export function getShapesToGeojson(
  db: Database,
  filters: ShapeFilters = {},
  precision: number = 6
): GeoJsonFeatureCollection {
  const shapes = getShapes(db, filters);

  // Group shapes by shape_id
  const shapeGroups = new Map<string, Shape[]>();
  for (const shape of shapes) {
    const group = shapeGroups.get(shape.shape_id);
    if (group) {
      group.push(shape);
    } else {
      shapeGroups.set(shape.shape_id, [shape]);
    }
  }

  // Get route information for each shape
  const shapeRouteMap = getRoutesByShapeIds(db, Array.from(shapeGroups.keys()));

  // Build GeoJSON features
  const features: GeoJsonFeature[] = [];
  const multiplier = Math.pow(10, precision);

  for (const [shapeId, points] of shapeGroups) {
    // Sort points by sequence (should already be sorted, but ensure)
    points.sort((a, b) => a.shape_pt_sequence - b.shape_pt_sequence);

    // Build coordinates array [lon, lat] with specified precision
    const coordinates: number[][] = points.map(point => [
      Math.round(point.shape_pt_lon * multiplier) / multiplier,
      Math.round(point.shape_pt_lat * multiplier) / multiplier
    ]);

    // Get route properties
    const route = shapeRouteMap.get(shapeId);
    const properties: GeoJsonFeature['properties'] = {
      shape_id: shapeId,
    };

    if (route) {
      properties.route_id = route.route_id;
      properties.route_short_name = route.route_short_name;
      properties.route_long_name = route.route_long_name;
      properties.route_type = route.route_type;
      if (route.route_color) properties.route_color = route.route_color;
      if (route.route_text_color) properties.route_text_color = route.route_text_color;
      if (route.agency_id) properties.agency_id = route.agency_id;
    }

    features.push({
      type: 'Feature',
      properties,
      geometry: {
        type: 'LineString',
        coordinates
      }
    });
  }

  return {
    type: 'FeatureCollection',
    features
  };
}

/**
 * Get the first matching route for each shape_id
 */
function getRoutesByShapeIds(
  db: Database,
  shapeIds: string[]
): Map<string, Route> {
  if (shapeIds.length === 0) {
    return new Map();
  }

  const placeholders = shapeIds.map(() => '?').join(', ');

  // Get first route for each shape via trips table
  const sql = `
    SELECT DISTINCT t.shape_id, r.*
    FROM trips t
    INNER JOIN routes r ON t.route_id = r.route_id
    WHERE t.shape_id IN (${placeholders})
    GROUP BY t.shape_id
  `;

  const stmt = db.prepare(sql);
  stmt.bind(shapeIds);

  const result = new Map<string, Route>();
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    const shapeId = String(row.shape_id);
    result.set(shapeId, rowToRoute(row));
  }

  stmt.free();

  return result;
}

/**
 * Convert database row to Shape object
 */
function rowToShape(row: Record<string, unknown>): Shape {
  return {
    shape_id: String(row.shape_id),
    shape_pt_lat: Number(row.shape_pt_lat),
    shape_pt_lon: Number(row.shape_pt_lon),
    shape_pt_sequence: Number(row.shape_pt_sequence),
    shape_dist_traveled: row.shape_dist_traveled !== null ? Number(row.shape_dist_traveled) : undefined,
  };
}

/**
 * Convert database row to Route object
 */
function rowToRoute(row: Record<string, unknown>): Route {
  return {
    route_id: String(row.route_id),
    route_short_name: row.route_short_name ? String(row.route_short_name) : '',
    route_long_name: row.route_long_name ? String(row.route_long_name) : '',
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
