/**
 * Graph Builder
 * Builds a transit graph for itinerary planning
 */

import { Graph } from 'graphlib';
import type { Database } from 'sql.js';
import type { TransitGraph, RouteEdge } from './types';
import { buildParentStopCache } from './parent-stops';
import { buildOrderedStopList } from '../queries/stop-times';

/**
 * Build a transit graph for a specific date
 * Each node is a parent stop, each edge is a (route, direction) connection
 */
export function buildTransitGraph(
  db: Database,
  serviceIds: string[]
): TransitGraph {
  // Build parent stop cache
  const parentCache = buildParentStopCache(db);

  // Get all trips running on this date
  const serviceIdPlaceholders = serviceIds.map(() => '?').join(', ');
  const tripStmt = db.prepare(`
    SELECT t.trip_id, t.route_id, t.direction_id, r.route_short_name, r.route_long_name
    FROM trips t
    LEFT JOIN routes r ON t.route_id = r.route_id
    WHERE t.service_id IN (${serviceIdPlaceholders})
  `);
  tripStmt.bind(serviceIds);

  // Group trips by (route_id, direction_id)
  const routeDirectionMap = new Map<string, {
    routeId: string;
    directionId: number;
    tripIds: string[];
    routeShortName?: string;
    routeLongName?: string;
  }>();

  while (tripStmt.step()) {
    const row = tripStmt.getAsObject() as {
      trip_id: string;
      route_id: string;
      direction_id: number | null;
      route_short_name?: string;
      route_long_name?: string;
    };

    const directionId = row.direction_id ?? 0;
    const key = `${row.route_id}_${directionId}`;

    if (!routeDirectionMap.has(key)) {
      routeDirectionMap.set(key, {
        routeId: row.route_id,
        directionId,
        tripIds: [],
        routeShortName: row.route_short_name,
        routeLongName: row.route_long_name
      });
    }
    routeDirectionMap.get(key)!.tripIds.push(row.trip_id);
  }
  tripStmt.free();

  // Build graph
  const graph = new Graph({ directed: true, multigraph: true });
  const edgeMetadata = new Map<string, RouteEdge[]>();

  // Process each route/direction combination
  for (const [, routeDir] of routeDirectionMap) {
    // Get stop sequence for this route/direction
    const stopSequence = buildOrderedStopList(db, routeDir.tripIds);

    if (stopSequence.length < 2) {
      // Need at least 2 stops to create an edge
      continue;
    }

    // Convert to parent stops and remove consecutive duplicates
    const parentStopSequence: string[] = [];
    let lastParent: string | null = null;

    for (const stop of stopSequence) {
      const parentId = parentCache.get(stop.stop_id) || stop.stop_id;
      if (parentId !== lastParent) {
        parentStopSequence.push(parentId);
        lastParent = parentId;
      }
    }

    // Create edges between consecutive stops
    for (let i = 0; i < parentStopSequence.length - 1; i++) {
      const fromStop = parentStopSequence[i];
      const toStop = parentStopSequence[i + 1];

      // Add nodes if they don't exist
      if (!graph.hasNode(fromStop)) {
        graph.setNode(fromStop);
      }
      if (!graph.hasNode(toStop)) {
        graph.setNode(toStop);
      }

      // Check if this edge already exists for this route/direction
      const metadataKey = `${fromStop}->${toStop}`;
      if (!edgeMetadata.has(metadataKey)) {
        edgeMetadata.set(metadataKey, []);
      }

      // Check if we already have this route/direction for this edge
      const existingEdges = edgeMetadata.get(metadataKey)!;
      const alreadyExists = existingEdges.some(
        e => e.routeId === routeDir.routeId && e.directionId === routeDir.directionId
      );

      if (!alreadyExists) {
        // Add edge metadata
        const routeEdge: RouteEdge = {
          routeId: routeDir.routeId,
          directionId: routeDir.directionId,
          intermediateStops: [],  // No intermediate stops for direct connections
          routeShortName: routeDir.routeShortName,
          routeLongName: routeDir.routeLongName
        };

        existingEdges.push(routeEdge);

        // Add edge to graph (with weight = 1 for simple hop count)
        graph.setEdge(fromStop, toStop, {
          routeId: routeDir.routeId,
          directionId: routeDir.directionId,
          weight: 1
        });
      }
    }
  }

  return {
    graph,
    metadata: edgeMetadata,
    date: serviceIds.join(',')  // Store service IDs for reference
  };
}
