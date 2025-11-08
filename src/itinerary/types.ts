/**
 * Itinerary Search Type Definitions
 */

import type { Graph } from 'graphlib';

/**
 * Graph edge metadata: connection between stops via a route
 */
export interface RouteEdge {
  routeId: string;
  directionId: number;
  intermediateStops: string[];  // Parent stop IDs between start and end
  routeShortName?: string;      // For display
  routeLongName?: string;       // For display
}

/**
 * Transit graph with metadata
 */
export interface TransitGraph {
  graph: Graph;
  metadata: Map<string, RouteEdge[]>;
  date: string;  // YYYYMMDD format - the date this graph was built for
}

/**
 * Pathfinding result - a sequence of route segments
 */
export interface ItineraryPath {
  startStopId: string;           // Parent stop
  endStopId: string;             // Parent stop
  segments: RouteSegment[];      // Array of route segments
  totalTransfers: number;        // Number of transfers needed
}

/**
 * A single segment of a path (one route/direction)
 */
export interface RouteSegment {
  routeId: string;
  directionId: number;
  boardStopId: string;           // Where to board
  alightStopId: string;          // Where to alight
  intermediateStops: string[];   // Stops in between
  routeShortName?: string;
  routeLongName?: string;
}

/**
 * Itinerary with matched trips
 */
export interface ItineraryWithTrips {
  path: ItineraryPath;
  options: TripOption[];         // Multiple departure options
}

/**
 * A single trip option (complete journey)
 */
export interface TripOption {
  segments: TripSegment[];
  totalDuration: number;         // In seconds
  departureTime: string;         // HH:MM:SS
  arrivalTime: string;           // HH:MM:SS
}

/**
 * A single trip segment (one trip on one route)
 */
export interface TripSegment {
  tripId: string;
  routeId: string;
  directionId: number;
  tripHeadsign?: string;
  boardStopId: string;
  boardStopName: string;
  alightStopId: string;
  alightStopName: string;
  boardTime: string;             // HH:MM:SS
  alightTime: string;            // HH:MM:SS
  intermediateStops: StopWithTime[];
}

/**
 * Stop with arrival/departure times
 */
export interface StopWithTime {
  stopId: string;
  stopName: string;
  arrivalTime: string;
  departureTime: string;
}
