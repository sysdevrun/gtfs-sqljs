/**
 * Optimized Itinerary Computation using graphlib
 * Uses Dijkstra's algorithm for efficient multi-leg journey planning
 */

import type { Database } from 'sql.js';
import type { Stop, Route, Trip, StopTime } from '../types/gtfs';
import { Graph, alg } from 'graphlib';

// Re-export types from itineraries.ts
export type {
  ItinerarySearchConfig,
  ItinerarySearchFilters,
  Itinerary,
  ItineraryLeg,
  Transfer,
} from './itineraries';

import type {
  ItinerarySearchFilters,
  ItinerarySearchConfig,
  Itinerary,
  ItineraryLeg,
  Transfer,
} from './itineraries';

/**
 * Node in the time-expanded graph representing (stop, time) pair
 */
interface GraphNode {
  stopId: string;
  time: number; // seconds since midnight
  nodeId: string; // unique identifier: "stopId:time"
}

/**
 * Edge in the graph representing a trip segment or transfer
 */
interface GraphEdge {
  type: 'trip' | 'transfer';
  duration: number; // in seconds
  tripId?: string;
  routeId?: string;
  fromStopSequence?: number;
  toStopSequence?: number;
}

/**
 * Cache for parent stops
 */
const parentStopCache = new Map<string, Stop>();

/**
 * Get parent stop recursively with caching
 */
function getParentStop(db: Database, stopId: string): Stop {
  if (parentStopCache.has(stopId)) {
    return parentStopCache.get(stopId)!;
  }

  const stmt = db.prepare('SELECT * FROM stops WHERE stop_id = ?');
  stmt.bind([stopId]);

  if (!stmt.step()) {
    stmt.free();
    throw new Error(`Stop not found: ${stopId}`);
  }

  const row = stmt.getAsObject();
  stmt.free();

  const stop: Stop = {
    stop_id: row.stop_id as string,
    stop_name: row.stop_name as string,
    stop_lat: row.stop_lat as number,
    stop_lon: row.stop_lon as number,
    stop_code: row.stop_code as string | undefined,
    stop_desc: row.stop_desc as string | undefined,
    zone_id: row.zone_id as string | undefined,
    stop_url: row.stop_url as string | undefined,
    location_type: row.location_type as number | undefined,
    parent_station: row.parent_station as string | undefined,
    stop_timezone: row.stop_timezone as string | undefined,
    wheelchair_boarding: row.wheelchair_boarding as number | undefined,
    level_id: row.level_id as string | undefined,
    platform_code: row.platform_code as string | undefined,
  };

  let result: Stop;
  if (stop.parent_station) {
    result = getParentStop(db, stop.parent_station);
  } else {
    result = stop;
  }

  parentStopCache.set(stopId, result);
  return result;
}

/**
 * Get active service IDs for a specific date
 */
function getActiveServiceIdsForDate(db: Database, date: string): string[] {
  const serviceIds: string[] = [];

  const year = parseInt(date.substring(0, 4), 10);
  const month = parseInt(date.substring(4, 6), 10);
  const day = parseInt(date.substring(6, 8), 10);
  const dateObj = new Date(year, month - 1, day);
  const dayOfWeek = dateObj.getDay();

  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayColumn = dayNames[dayOfWeek];

  const calendarStmt = db.prepare(`
    SELECT service_id FROM calendar
    WHERE ${dayColumn} = 1
      AND start_date <= ?
      AND end_date >= ?
  `);
  calendarStmt.bind([date, date]);

  while (calendarStmt.step()) {
    serviceIds.push(calendarStmt.getAsObject().service_id as string);
  }
  calendarStmt.free();

  const exceptionStmt = db.prepare('SELECT service_id, exception_type FROM calendar_dates WHERE date = ?');
  exceptionStmt.bind([date]);

  const additions: string[] = [];
  const removals: string[] = [];

  while (exceptionStmt.step()) {
    const row = exceptionStmt.getAsObject();
    const serviceId = row.service_id as string;
    const exceptionType = row.exception_type as number;

    if (exceptionType === 1) {
      additions.push(serviceId);
    } else if (exceptionType === 2) {
      removals.push(serviceId);
    }
  }
  exceptionStmt.free();

  const finalServiceIds = serviceIds
    .filter(id => !removals.includes(id))
    .concat(additions.filter(id => !serviceIds.includes(id)));

  return finalServiceIds;
}

/**
 * Convert time string to seconds since midnight
 */
function timeToSeconds(time: string): number {
  const parts = time.split(':');
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  const seconds = parseInt(parts[2], 10);
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Convert seconds to time string
 */
function secondsToTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Build time-expanded graph for itinerary search
 */
function buildTimeExpandedGraph(
  db: Database,
  fromStopId: string,
  toStopId: string,
  serviceIds: string[],
  departureAfterSeconds: number,
  departureBeforeSeconds: number,
  minTransferTime: number
): { graph: Graph; nodeMap: Map<string, GraphNode> } {
  const graph = new Graph({ directed: true });
  const nodeMap = new Map<string, GraphNode>();

  // Get parent stops
  const fromParent = getParentStop(db, fromStopId);
  const toParent = getParentStop(db, toStopId);

  const servicePlaceholders = serviceIds.map(() => '?').join(', ');

  // Query all stop times for active services within time window
  // This gets all trips that could potentially be part of an itinerary
  const query = `
    SELECT
      st.trip_id,
      st.stop_id,
      st.stop_sequence,
      st.arrival_time,
      st.departure_time,
      t.route_id,
      t.direction_id,
      s.stop_id as actual_stop_id,
      s.stop_name,
      s.stop_lat,
      s.stop_lon,
      s.parent_station
    FROM stop_times st
    JOIN trips t ON t.trip_id = st.trip_id
    JOIN stops s ON s.stop_id = st.stop_id
    WHERE t.service_id IN (${servicePlaceholders})
    ORDER BY st.trip_id, st.stop_sequence
  `;

  const stmt = db.prepare(query);
  stmt.bind(serviceIds);

  // Group stop times by trip
  const tripStopTimes = new Map<string, Array<{
    stopId: string;
    parentStopId: string;
    sequence: number;
    arrivalTime: number;
    departureTime: number;
    routeId: string;
  }>>();

  while (stmt.step()) {
    const row = stmt.getAsObject();
    const tripId = row.trip_id as string;
    const stopId = row.stop_id as string;
    const parentStop = row.parent_station ? getParentStop(db, stopId) : getParentStop(db, stopId);

    const arrivalSeconds = timeToSeconds(row.arrival_time as string);
    const departureSeconds = timeToSeconds(row.departure_time as string);

    if (!tripStopTimes.has(tripId)) {
      tripStopTimes.set(tripId, []);
    }

    tripStopTimes.get(tripId)!.push({
      stopId,
      parentStopId: parentStop.stop_id,
      sequence: row.stop_sequence as number,
      arrivalTime: arrivalSeconds,
      departureTime: departureSeconds,
      routeId: row.route_id as string,
    });
  }
  stmt.free();

  // Add trip edges to graph
  for (const [tripId, stopTimes] of tripStopTimes) {
    // Only consider trips that serve stops relevant to our search
    const servesFrom = stopTimes.some(st => st.parentStopId === fromParent.stop_id);
    const servesTo = stopTimes.some(st => st.parentStopId === toParent.stop_id);

    // Skip trips that don't serve either origin or destination
    // (Could be optimized further to only include trips on promising routes)
    if (!servesFrom && !servesTo) {
      continue;
    }

    for (let i = 0; i < stopTimes.length - 1; i++) {
      const from = stopTimes[i];
      const to = stopTimes[i + 1];

      // Create nodes for departure and arrival
      const fromNodeId = `${from.parentStopId}:${from.departureTime}`;
      const toNodeId = `${to.parentStopId}:${to.arrivalTime}`;

      if (!nodeMap.has(fromNodeId)) {
        const node: GraphNode = {
          stopId: from.parentStopId,
          time: from.departureTime,
          nodeId: fromNodeId,
        };
        nodeMap.set(fromNodeId, node);
        graph.setNode(fromNodeId, node);
      }

      if (!nodeMap.has(toNodeId)) {
        const node: GraphNode = {
          stopId: to.parentStopId,
          time: to.arrivalTime,
          nodeId: toNodeId,
        };
        nodeMap.set(toNodeId, node);
        graph.setNode(toNodeId, node);
      }

      // Add edge for this trip segment
      const edge: GraphEdge = {
        type: 'trip',
        duration: to.arrivalTime - from.departureTime,
        tripId,
        routeId: from.routeId,
        fromStopSequence: from.sequence,
        toStopSequence: to.sequence,
      };

      graph.setEdge(fromNodeId, toNodeId, edge);
    }
  }

  // Add transfer edges (waiting at the same stop)
  // Group nodes by stop
  const nodesByStop = new Map<string, GraphNode[]>();
  for (const node of nodeMap.values()) {
    if (!nodesByStop.has(node.stopId)) {
      nodesByStop.set(node.stopId, []);
    }
    nodesByStop.get(node.stopId)!.push(node);
  }

  // For each stop, add transfer edges between different times
  for (const [stopId, nodes] of nodesByStop) {
    // Sort by time
    const sortedNodes = nodes.sort((a, b) => a.time - b.time);

    for (let i = 0; i < sortedNodes.length - 1; i++) {
      const fromNode = sortedNodes[i];

      // Add transfers to later times at this stop
      for (let j = i + 1; j < sortedNodes.length; j++) {
        const toNode = sortedNodes[j];
        const waitTime = toNode.time - fromNode.time;

        // Only add transfer if wait time is at least minimum transfer time
        if (waitTime >= minTransferTime) {
          const edge: GraphEdge = {
            type: 'transfer',
            duration: waitTime,
          };

          graph.setEdge(fromNode.nodeId, toNode.nodeId, edge);

          // Stop after adding a few transfers to limit graph size
          if (j - i > 10) break;
        }
      }
    }
  }

  return { graph, nodeMap };
}

/**
 * Find itinerary from path in graph
 */
function buildItineraryFromPath(
  db: Database,
  path: string[],
  graph: Graph,
  nodeMap: Map<string, GraphNode>
): Itinerary | null {
  if (path.length < 2) return null;

  const legs: ItineraryLeg[] = [];
  const transfers: Transfer[] = [];

  let currentTripId: string | null = null;
  let currentLegStart: number | null = null;

  for (let i = 0; i < path.length - 1; i++) {
    const fromNodeId = path[i];
    const toNodeId = path[i + 1];
    const edge = graph.edge(fromNodeId, toNodeId) as GraphEdge;
    const fromNode = nodeMap.get(fromNodeId)!;
    const toNode = nodeMap.get(toNodeId)!;

    if (edge.type === 'trip') {
      if (currentTripId === null || currentTripId !== edge.tripId) {
        // Starting a new trip (new leg)
        if (currentTripId !== null && currentLegStart !== null) {
          // This shouldn't happen in a properly constructed path
          // but handle it gracefully
        }

        currentTripId = edge.tripId!;
        currentLegStart = i;
      }

      // Check if this is the last segment of this trip
      const isLastSegmentOfTrip =
        i === path.length - 2 ||
        (graph.edge(path[i + 1], path[i + 2]) as GraphEdge)?.tripId !== currentTripId;

      if (isLastSegmentOfTrip && currentLegStart !== null) {
        // Build the leg
        const leg = buildLeg(
          db,
          currentTripId!,
          path.slice(currentLegStart, i + 2),
          graph,
          nodeMap,
          legs.length
        );

        if (leg) {
          legs.push(leg);

          // Check if there's a transfer after this leg
          if (i + 1 < path.length - 1) {
            const nextEdge = graph.edge(path[i + 1], path[i + 2]) as GraphEdge;
            if (nextEdge?.type === 'transfer') {
              const transferStop = getStopById(db, toNode.stopId);
              if (transferStop) {
                transfers.push({
                  stop: transferStop,
                  waitTime: nextEdge.duration,
                  arrivalTime: secondsToTime(toNode.time),
                  departureTime: secondsToTime(toNode.time + nextEdge.duration),
                });
              }
            }
          }
        }

        currentTripId = null;
        currentLegStart = null;
      }
    }
  }

  if (legs.length === 0) return null;

  const departureTime = legs[0].departureTime;
  const arrivalTime = legs[legs.length - 1].arrivalTime;
  const totalDuration = timeToSeconds(arrivalTime) - timeToSeconds(departureTime);
  const inVehicleTime = legs.reduce((sum, leg) => sum + leg.duration, 0);
  const waitingTime = transfers.reduce((sum, transfer) => sum + transfer.waitTime, 0);

  return {
    legs,
    transfers,
    numberOfTransfers: transfers.length,
    departureTime,
    arrivalTime,
    totalDuration,
    inVehicleTime,
    waitingTime,
  };
}

/**
 * Build a leg from trip path
 */
function buildLeg(
  db: Database,
  tripId: string,
  pathSegment: string[],
  graph: Graph,
  nodeMap: Map<string, GraphNode>,
  legIndex: number
): ItineraryLeg | null {
  if (pathSegment.length < 2) return null;

  const fromNode = nodeMap.get(pathSegment[0])!;
  const toNode = nodeMap.get(pathSegment[pathSegment.length - 1])!;

  // Get trip and route info
  const tripStmt = db.prepare('SELECT t.*, r.* FROM trips t JOIN routes r ON r.route_id = t.route_id WHERE t.trip_id = ?');
  tripStmt.bind([tripId]);

  if (!tripStmt.step()) {
    tripStmt.free();
    return null;
  }

  const row = tripStmt.getAsObject();
  tripStmt.free();

  const trip: Trip = {
    trip_id: row.trip_id as string,
    route_id: row.route_id as string,
    service_id: row.service_id as string,
    trip_headsign: row.trip_headsign as string | undefined,
    trip_short_name: row.trip_short_name as string | undefined,
    direction_id: row.direction_id as number | undefined,
    block_id: row.block_id as string | undefined,
    shape_id: row.shape_id as string | undefined,
    wheelchair_accessible: row.wheelchair_accessible as number | undefined,
    bikes_allowed: row.bikes_allowed as number | undefined,
  };

  const route: Route = {
    route_id: row.route_id as string,
    route_short_name: row.route_short_name as string,
    route_long_name: row.route_long_name as string,
    route_type: row.route_type as number,
    agency_id: row.agency_id as string | undefined,
    route_desc: row.route_desc as string | undefined,
    route_url: row.route_url as string | undefined,
    route_color: row.route_color as string | undefined,
    route_text_color: row.route_text_color as string | undefined,
    route_sort_order: row.route_sort_order as number | undefined,
  };

  // Get all stop times for this trip
  const stopTimesStmt = db.prepare('SELECT * FROM stop_times WHERE trip_id = ? ORDER BY stop_sequence');
  stopTimesStmt.bind([tripId]);

  const allStopTimes: StopTime[] = [];
  while (stopTimesStmt.step()) {
    const stRow = stopTimesStmt.getAsObject();
    allStopTimes.push({
      trip_id: stRow.trip_id as string,
      arrival_time: stRow.arrival_time as string,
      departure_time: stRow.departure_time as string,
      stop_id: stRow.stop_id as string,
      stop_sequence: stRow.stop_sequence as number,
      stop_headsign: stRow.stop_headsign as string | undefined,
      pickup_type: stRow.pickup_type as number | undefined,
      drop_off_type: stRow.drop_off_type as number | undefined,
      continuous_pickup: stRow.continuous_pickup as number | undefined,
      continuous_drop_off: stRow.continuous_drop_off as number | undefined,
      shape_dist_traveled: stRow.shape_dist_traveled as number | undefined,
      timepoint: stRow.timepoint as number | undefined,
    });
  }
  stopTimesStmt.free();

  // Find the from and to stops in the stop times
  const fromStop = getStopById(db, fromNode.stopId);
  const toStop = getStopById(db, toNode.stopId);

  if (!fromStop || !toStop) return null;

  const departureTime = secondsToTime(fromNode.time);
  const arrivalTime = secondsToTime(toNode.time);
  const duration = toNode.time - fromNode.time;

  return {
    legIndex,
    route,
    trip,
    directionId: (trip.direction_id ?? 0) as number,
    fromStop,
    toStop,
    departureTime,
    arrivalTime,
    stopTimes: allStopTimes,
    duration,
  };
}

/**
 * Get stop by ID
 */
function getStopById(db: Database, stopId: string): Stop | null {
  const stmt = db.prepare('SELECT * FROM stops WHERE stop_id = ?');
  stmt.bind([stopId]);

  if (!stmt.step()) {
    stmt.free();
    return null;
  }

  const row = stmt.getAsObject();
  stmt.free();

  return {
    stop_id: row.stop_id as string,
    stop_name: row.stop_name as string,
    stop_lat: row.stop_lat as number,
    stop_lon: row.stop_lon as number,
    stop_code: row.stop_code as string | undefined,
    stop_desc: row.stop_desc as string | undefined,
    zone_id: row.zone_id as string | undefined,
    stop_url: row.stop_url as string | undefined,
    location_type: row.location_type as number | undefined,
    parent_station: row.parent_station as string | undefined,
    stop_timezone: row.stop_timezone as string | undefined,
    wheelchair_boarding: row.wheelchair_boarding as number | undefined,
    level_id: row.level_id as string | undefined,
    platform_code: row.platform_code as string | undefined,
  };
}

/**
 * Compute itineraries using graphlib-based approach
 */
export function computeItinerariesGraphlib(
  db: Database,
  filters: ItinerarySearchFilters
): Itinerary[] {
  const config = filters.config || {};
  const minTransferTime = config.minTransferTime ?? 300;
  const maxResults = config.maxResults ?? 5;

  parentStopCache.clear();

  const serviceIds = getActiveServiceIdsForDate(db, filters.date);
  if (serviceIds.length === 0) {
    return [];
  }

  const departureAfterSeconds = timeToSeconds(filters.departureTimeAfter);
  const departureBeforeSeconds = filters.departureTimeBefore
    ? timeToSeconds(filters.departureTimeBefore)
    : Number.MAX_SAFE_INTEGER;

  // Build time-expanded graph
  console.log('Building time-expanded graph...');
  const startBuild = Date.now();
  const { graph, nodeMap } = buildTimeExpandedGraph(
    db,
    filters.fromStopId,
    filters.toStopId,
    serviceIds,
    departureAfterSeconds,
    departureBeforeSeconds,
    minTransferTime
  );
  console.log(`Graph built in ${Date.now() - startBuild}ms: ${graph.nodeCount()} nodes, ${graph.edgeCount()} edges`);

  // Get parent stops
  const fromParent = getParentStop(db, filters.fromStopId);
  const toParent = getParentStop(db, filters.toStopId);

  // Find all nodes for origin and destination
  const originNodes: string[] = [];
  const destNodes: string[] = [];

  for (const [nodeId, node] of nodeMap) {
    if (node.stopId === fromParent.stop_id &&
        node.time >= departureAfterSeconds &&
        node.time <= departureBeforeSeconds) {
      originNodes.push(nodeId);
    }
    if (node.stopId === toParent.stop_id) {
      destNodes.push(nodeId);
    }
  }

  console.log(`Found ${originNodes.length} origin nodes and ${destNodes.length} destination nodes`);

  // Find shortest paths from each origin to each destination
  const itineraries: Itinerary[] = [];

  for (const originNode of originNodes) {
    // Run Dijkstra from this origin
    const distances = alg.dijkstra(graph, originNode, (edge) => {
      const edgeData = edge as unknown as GraphEdge;
      return edgeData.duration;
    });

    // Check all destination nodes
    for (const destNode of destNodes) {
      if (distances[destNode] && distances[destNode].distance < Infinity) {
        // Found a path! Reconstruct it
        const path: string[] = [];
        let current = destNode;

        while (current !== originNode) {
          path.unshift(current);
          const pred = distances[current].predecessor;
          if (!pred) break;
          current = pred;
        }
        path.unshift(originNode);

        // Build itinerary from path
        const itinerary = buildItineraryFromPath(db, path, graph, nodeMap);
        if (itinerary) {
          itineraries.push(itinerary);
        }
      }
    }

    // Stop if we have enough itineraries
    if (itineraries.length >= maxResults) {
      break;
    }
  }

  // Sort by earliest arrival
  itineraries.sort((a, b) => timeToSeconds(a.arrivalTime) - timeToSeconds(b.arrivalTime));

  return itineraries.slice(0, maxResults);
}

/**
 * Clear caches
 */
export function clearGraphlibCache(): void {
  parentStopCache.clear();
}
