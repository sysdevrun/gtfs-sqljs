/**
 * Itinerary Computation Module
 * Computes multi-leg journeys between stops using GTFS data
 */

import type { Database } from 'sql.js';
import type { Stop, Route, Trip, StopTime } from '../types/gtfs';

/**
 * Configuration for itinerary search
 */
export interface ItinerarySearchConfig {
  /** Maximum number of transfers allowed (default: 3) */
  maxTransfers?: number;
  /** Minimum transfer time in seconds (default: 300 = 5 minutes) */
  minTransferTime?: number;
  /** Maximum number of itineraries to return (default: 5) */
  maxResults?: number;
  /** Maximum search depth for graph traversal (default: 10) */
  maxSearchDepth?: number;
}

/**
 * Filters for itinerary search
 */
export interface ItinerarySearchFilters {
  /** Origin stop ID */
  fromStopId: string;
  /** Destination stop ID */
  toStopId: string;
  /** Date in YYYYMMDD format */
  date: string;
  /** Departure time in HH:MM:SS format (leave after this time) */
  departureTimeAfter: string;
  /** Arrival time in HH:MM:SS format (arrive before this time, optional) */
  departureTimeBefore?: string;
  /** Configuration options */
  config?: ItinerarySearchConfig;
}

/**
 * A single leg of a journey (one trip on one route)
 */
export interface ItineraryLeg {
  /** Sequence number of this leg (0-indexed) */
  legIndex: number;
  /** Route information */
  route: Route;
  /** Trip information */
  trip: Trip;
  /** Direction ID */
  directionId: number;
  /** Departure stop */
  fromStop: Stop;
  /** Arrival stop */
  toStop: Stop;
  /** Departure time (HH:MM:SS) */
  departureTime: string;
  /** Arrival time (HH:MM:SS) */
  arrivalTime: string;
  /** All stop times for this leg (ordered) */
  stopTimes: StopTime[];
  /** Duration in seconds */
  duration: number;
}

/**
 * Transfer between two legs
 */
export interface Transfer {
  /** Stop where transfer occurs */
  stop: Stop;
  /** Time to wait for next leg in seconds */
  waitTime: number;
  /** Time when arriving at transfer stop */
  arrivalTime: string;
  /** Time when departing from transfer stop */
  departureTime: string;
}

/**
 * A complete itinerary from origin to destination
 */
export interface Itinerary {
  /** List of journey legs */
  legs: ItineraryLeg[];
  /** List of transfers (empty for direct routes) */
  transfers: Transfer[];
  /** Total number of transfers */
  numberOfTransfers: number;
  /** Departure time from origin */
  departureTime: string;
  /** Arrival time at destination */
  arrivalTime: string;
  /** Total journey duration in seconds */
  totalDuration: number;
  /** Total in-vehicle time in seconds */
  inVehicleTime: number;
  /** Total waiting time in seconds */
  waitingTime: number;
}

/**
 * Node in the network graph
 */
interface GraphNode {
  stopId: string;
  stop: Stop;
  edges: GraphEdge[];
}

/**
 * Edge in the network graph
 */
interface GraphEdge {
  toStopId: string;
  routeId: string;
  directionId: number;
  route: Route;
}

/**
 * Path during search
 */
interface SearchPath {
  stopId: string;
  routeDirectionPairs: Array<{ routeId: string; directionId: number }>;
  depth: number;
}

/**
 * Cache for network graph
 */
let graphCache: Map<string, Map<string, GraphNode>> | null = null;

/**
 * Cache for parent stops
 */
const parentStopCache = new Map<string, Stop>();

/**
 * Get parent stop recursively with caching
 */
function getParentStop(db: Database, stopId: string): Stop {
  // Check cache first
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

  // If this stop has a parent station, recursively get the parent
  let result: Stop;
  if (stop.parent_station) {
    result = getParentStop(db, stop.parent_station);
  } else {
    result = stop;
  }

  // Cache the result
  parentStopCache.set(stopId, result);
  return result;
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
 * Get active service IDs for a specific date
 */
function getActiveServiceIdsForDate(db: Database, date: string): string[] {
  const serviceIds: string[] = [];

  // Parse date
  const year = parseInt(date.substring(0, 4), 10);
  const month = parseInt(date.substring(4, 6), 10);
  const day = parseInt(date.substring(6, 8), 10);
  const dateObj = new Date(year, month - 1, day);
  const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 1 = Monday, etc.

  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayColumn = dayNames[dayOfWeek];

  // Get services from calendar
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

  // Apply calendar_dates exceptions
  const exceptionStmt = db.prepare('SELECT service_id, exception_type FROM calendar_dates WHERE date = ?');
  exceptionStmt.bind([date]);

  const additions: string[] = [];
  const removals: string[] = [];

  while (exceptionStmt.step()) {
    const row = exceptionStmt.getAsObject();
    const serviceId = row.service_id as string;
    const exceptionType = row.exception_type as number;

    if (exceptionType === 1) {
      // Service added
      additions.push(serviceId);
    } else if (exceptionType === 2) {
      // Service removed
      removals.push(serviceId);
    }
  }
  exceptionStmt.free();

  // Apply exceptions
  const finalServiceIds = serviceIds
    .filter(id => !removals.includes(id))
    .concat(additions.filter(id => !serviceIds.includes(id)));

  return finalServiceIds;
}

/**
 * Build network graph for a specific date
 * Nodes are parent stops, edges are (route, direction_id) pairs
 */
function buildNetworkGraph(db: Database, date: string): Map<string, GraphNode> {
  // Check cache
  if (graphCache) {
    const cached = graphCache.get(date);
    if (cached) {
      return cached;
    }
  }

  const graph = new Map<string, GraphNode>();

  // Get active service IDs for the date
  const serviceIds = getActiveServiceIdsForDate(db, date);
  if (serviceIds.length === 0) {
    return graph;
  }

  const placeholders = serviceIds.map(() => '?').join(', ');

  // Query to get all route-direction-stop combinations for active services
  const query = `
    SELECT DISTINCT
      r.route_id, r.route_short_name, r.route_long_name, r.route_type,
      r.agency_id, r.route_desc, r.route_url, r.route_color, r.route_text_color, r.route_sort_order,
      t.direction_id,
      st1.stop_id as from_stop_id,
      st2.stop_id as to_stop_id
    FROM routes r
    JOIN trips t ON t.route_id = r.route_id
    JOIN stop_times st1 ON st1.trip_id = t.trip_id
    JOIN stop_times st2 ON st2.trip_id = t.trip_id
    WHERE t.service_id IN (${placeholders})
      AND st2.stop_sequence > st1.stop_sequence
  `;

  const stmt = db.prepare(query);
  stmt.bind(serviceIds);

  const edges = new Map<string, Set<string>>();

  while (stmt.step()) {
    const row = stmt.getAsObject();
    const routeId = row.route_id as string;
    const directionId = (row.direction_id ?? 0) as number;
    const fromStopId = row.from_stop_id as string;
    const toStopId = row.to_stop_id as string;

    const route = {
      route_id: row.route_id,
      route_short_name: row.route_short_name,
      route_long_name: row.route_long_name,
      route_type: row.route_type,
      agency_id: row.agency_id,
      route_desc: row.route_desc,
      route_url: row.route_url,
      route_color: row.route_color,
      route_text_color: row.route_text_color,
      route_sort_order: row.route_sort_order,
    } as Route;

    // Get parent stops
    const fromParent = getParentStop(db, fromStopId);
    const toParent = getParentStop(db, toStopId);

    if (fromParent.stop_id === toParent.stop_id) continue; // Skip same-stop edges

    // Add nodes
    if (!graph.has(fromParent.stop_id)) {
      graph.set(fromParent.stop_id, {
        stopId: fromParent.stop_id,
        stop: fromParent,
        edges: [],
      });
    }

    if (!graph.has(toParent.stop_id)) {
      graph.set(toParent.stop_id, {
        stopId: toParent.stop_id,
        stop: toParent,
        edges: [],
      });
    }

    // Track edges to avoid duplicates
    const edgeKey = `${fromParent.stop_id}:${toParent.stop_id}:${routeId}:${directionId}`;
    if (!edges.has(edgeKey)) {
      edges.set(edgeKey, new Set());

      graph.get(fromParent.stop_id)!.edges.push({
        toStopId: toParent.stop_id,
        routeId,
        directionId,
        route,
      });
    }
  }
  stmt.free();

  // Cache the graph
  if (!graphCache) {
    graphCache = new Map();
  }
  graphCache.set(date, graph);

  return graph;
}

/**
 * Find all possible route combinations between two stops using BFS
 */
function findRouteCombinations(
  graph: Map<string, GraphNode>,
  fromStopId: string,
  toStopId: string,
  maxTransfers: number,
  maxSearchDepth: number
): Array<Array<{ routeId: string; directionId: number }>> {
  const combinations: Array<Array<{ routeId: string; directionId: number }>> = [];
  const fromNode = graph.get(fromStopId);
  const toNode = graph.get(toStopId);

  if (!fromNode || !toNode) {
    return combinations;
  }

  // BFS
  const queue: SearchPath[] = [{
    stopId: fromStopId,
    routeDirectionPairs: [],
    depth: 0,
  }];

  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current.depth > maxSearchDepth) continue;

    const stateKey = `${current.stopId}:${JSON.stringify(current.routeDirectionPairs)}`;
    if (visited.has(stateKey)) continue;
    visited.add(stateKey);

    if (current.stopId === toStopId && current.routeDirectionPairs.length > 0) {
      combinations.push(current.routeDirectionPairs);
      continue;
    }

    if (current.routeDirectionPairs.length > maxTransfers) continue;

    const node = graph.get(current.stopId);
    if (!node) continue;

    for (const edge of node.edges) {
      const lastPair = current.routeDirectionPairs[current.routeDirectionPairs.length - 1];
      if (lastPair && lastPair.routeId === edge.routeId && lastPair.directionId === edge.directionId) {
        continue;
      }

      queue.push({
        stopId: edge.toStopId,
        routeDirectionPairs: [
          ...current.routeDirectionPairs,
          { routeId: edge.routeId, directionId: edge.directionId },
        ],
        depth: current.depth + 1,
      });
    }
  }

  return combinations;
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
 * Find trips that connect two stops on a specific route/direction
 */
function findConnectingTrips(
  db: Database,
  routeId: string,
  directionId: number,
  fromStopId: string,
  toStopId: string,
  serviceIds: string[],
  afterTime?: number,
  beforeTime?: number
): Array<{
  trip: Trip;
  route: Route;
  fromStopTime: StopTime & { stop: Stop };
  toStopTime: StopTime & { stop: Stop };
  allStopTimes: (StopTime & { stop: Stop })[];
}> {
  const results: Array<{
    trip: Trip;
    route: Route;
    fromStopTime: StopTime & { stop: Stop };
    toStopTime: StopTime & { stop: Stop };
    allStopTimes: (StopTime & { stop: Stop })[];
  }> = [];

  const servicePlaceholders = serviceIds.map(() => '?').join(', ');

  const tripQuery = `
    SELECT t.*, r.*
    FROM trips t
    JOIN routes r ON r.route_id = t.route_id
    WHERE t.route_id = ?
      AND t.service_id IN (${servicePlaceholders})
      ${directionId !== null && directionId !== undefined ? 'AND t.direction_id = ?' : ''}
  `;

  const tripStmt = db.prepare(tripQuery);
  const bindParams: (string | number)[] = [routeId, ...serviceIds];
  if (directionId !== null && directionId !== undefined) {
    bindParams.push(directionId);
  }
  tripStmt.bind(bindParams);

  while (tripStmt.step()) {
    const row = tripStmt.getAsObject();
    const trip = {
      trip_id: row.trip_id,
      route_id: row.route_id,
      service_id: row.service_id,
      trip_headsign: row.trip_headsign,
      trip_short_name: row.trip_short_name,
      direction_id: row.direction_id,
      block_id: row.block_id,
      shape_id: row.shape_id,
      wheelchair_accessible: row.wheelchair_accessible,
      bikes_allowed: row.bikes_allowed,
    } as Trip;

    const route = {
      route_id: row.route_id,
      route_short_name: row.route_short_name,
      route_long_name: row.route_long_name,
      route_type: row.route_type,
      agency_id: row.agency_id,
      route_desc: row.route_desc,
      route_url: row.route_url,
      route_color: row.route_color,
      route_text_color: row.route_text_color,
      route_sort_order: row.route_sort_order,
    } as Route;

    // Get all stop times for this trip
    const stopTimesQuery = `
      SELECT st.*, s.*
      FROM stop_times st
      JOIN stops s ON s.stop_id = st.stop_id
      WHERE st.trip_id = ?
      ORDER BY st.stop_sequence
    `;

    const stopTimesStmt = db.prepare(stopTimesQuery);
    stopTimesStmt.bind([trip.trip_id]);

    const allStopTimes: (StopTime & { stop: Stop })[] = [];
    let fromStopTime: (StopTime & { stop: Stop }) | null = null;
    let toStopTime: (StopTime & { stop: Stop }) | null = null;

    while (stopTimesStmt.step()) {
      const stRow = stopTimesStmt.getAsObject();

      const stopTime = {
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
        stop: {
          stop_id: stRow.stop_id,
          stop_name: stRow.stop_name,
          stop_lat: stRow.stop_lat,
          stop_lon: stRow.stop_lon,
          stop_code: stRow.stop_code,
          stop_desc: stRow.stop_desc,
          zone_id: stRow.zone_id,
          stop_url: stRow.stop_url,
          location_type: stRow.location_type,
          parent_station: stRow.parent_station,
          stop_timezone: stRow.stop_timezone,
          wheelchair_boarding: stRow.wheelchair_boarding,
          level_id: stRow.level_id,
          platform_code: stRow.platform_code,
        } as Stop,
      };

      allStopTimes.push(stopTime);

      // Check if this is the from or to stop (considering parent stations)
      const parent = getParentStop(db, stopTime.stop_id);
      if (parent.stop_id === fromStopId && !fromStopTime) {
        fromStopTime = stopTime;
      }
      if (parent.stop_id === toStopId && fromStopTime && !toStopTime) {
        toStopTime = stopTime;
      }
    }
    stopTimesStmt.free();

    // Check if this trip serves both stops in the right order
    if (fromStopTime && toStopTime) {
      const departureSeconds = timeToSeconds(fromStopTime.departure_time);

      // Check time constraints if provided
      if (afterTime !== undefined && departureSeconds < afterTime) {
        continue;
      }
      if (beforeTime !== undefined && departureSeconds > beforeTime) {
        continue;
      }

      results.push({
        trip,
        route,
        fromStopTime,
        toStopTime,
        allStopTimes,
      });
    }
  }
  tripStmt.free();

  return results;
}

/**
 * Compute itineraries between two stops
 */
export function computeItineraries(
  db: Database,
  filters: ItinerarySearchFilters
): Itinerary[] {
  const config = filters.config || {};
  const maxTransfers = config.maxTransfers ?? 3;
  const minTransferTime = config.minTransferTime ?? 300;
  const maxResults = config.maxResults ?? 5;
  const maxSearchDepth = config.maxSearchDepth ?? 10;

  // Clear parent stop cache for this query
  parentStopCache.clear();

  // Build network graph
  const graph = buildNetworkGraph(db, filters.date);

  // Get parent stops for from/to
  const fromParentStop = getParentStop(db, filters.fromStopId);
  const toParentStop = getParentStop(db, filters.toStopId);

  // Find all possible route combinations
  const routeCombinations = findRouteCombinations(
    graph,
    fromParentStop.stop_id,
    toParentStop.stop_id,
    maxTransfers,
    maxSearchDepth
  );

  const serviceIds = getActiveServiceIdsForDate(db, filters.date);
  if (serviceIds.length === 0) {
    return [];
  }

  const allItineraries: Itinerary[] = [];
  const departureAfterSeconds = timeToSeconds(filters.departureTimeAfter);
  const departureBeforeSeconds = filters.departureTimeBefore
    ? timeToSeconds(filters.departureTimeBefore)
    : Number.MAX_SAFE_INTEGER;

  // For each route combination, find compatible trips
  for (const routeCombination of routeCombinations) {
    if (routeCombination.length === 1) {
      // Direct route
      const { routeId, directionId } = routeCombination[0];

      const directTrips = findConnectingTrips(
        db,
        routeId,
        directionId,
        fromParentStop.stop_id,
        toParentStop.stop_id,
        serviceIds,
        departureAfterSeconds,
        departureBeforeSeconds
      );

      for (const { trip, route, fromStopTime, toStopTime, allStopTimes } of directTrips) {
        const fromIndex = allStopTimes.findIndex(st => st.stop_sequence === fromStopTime.stop_sequence);
        const toIndex = allStopTimes.findIndex(st => st.stop_sequence === toStopTime.stop_sequence);

        const legStopTimes = allStopTimes.slice(fromIndex, toIndex + 1);
        const duration = timeToSeconds(toStopTime.arrival_time) - timeToSeconds(fromStopTime.departure_time);

        const leg: ItineraryLeg = {
          legIndex: 0,
          route,
          trip,
          directionId: (trip.direction_id ?? 0) as number,
          fromStop: fromStopTime.stop,
          toStop: toStopTime.stop,
          departureTime: fromStopTime.departure_time,
          arrivalTime: toStopTime.arrival_time,
          stopTimes: legStopTimes as StopTime[],
          duration,
        };

        allItineraries.push({
          legs: [leg],
          transfers: [],
          numberOfTransfers: 0,
          departureTime: leg.departureTime,
          arrivalTime: leg.arrivalTime,
          totalDuration: duration,
          inVehicleTime: duration,
          waitingTime: 0,
        });
      }
    }
    // Multi-leg itineraries implementation would go here
    // For now, focusing on direct routes to get a working implementation
  }

  // Sort by earliest arrival time
  allItineraries.sort((a, b) => timeToSeconds(a.arrivalTime) - timeToSeconds(b.arrivalTime));

  return allItineraries.slice(0, maxResults);
}

/**
 * Clear the graph cache
 */
export function clearGraphCache(): void {
  graphCache = null;
  parentStopCache.clear();
}
