/**
 * Trip Matcher
 * Matches route segments to actual trips for a specific date and time
 */

import type { Database } from 'sql.js';
import type { Stop } from '../types/gtfs';
import type {
  ItineraryPath,
  ItineraryWithTrips,
  TripOption,
  TripSegment,
  StopWithTime
} from './types';
import { compareGtfsTime, addMinutesToTime, calculateDuration } from './time-utils';
import { getChildStops } from './parent-stops';

const DEFAULT_TRANSFER_TIME_MINUTES = 5;

/**
 * Find trips matching a path for a specific date and time
 */
export function findTripsForPath(
  db: Database,
  path: ItineraryPath,
  serviceIds: string[],
  startTime: string,
  maxOptions: number = 5
): ItineraryWithTrips {
  const options: TripOption[] = [];

  // Try to find multiple departure options
  for (let optionIdx = 0; optionIdx < maxOptions; optionIdx++) {
    const tripOption = findSingleTripOption(
      db,
      path,
      serviceIds,
      startTime,
      optionIdx
    );

    if (tripOption) {
      options.push(tripOption);
      // Update start time for next option to be after this one
      if (tripOption.segments.length > 0) {
        startTime = addMinutesToTime(tripOption.departureTime, 1);
      }
    } else {
      // No more options found
      break;
    }
  }

  return { path, options };
}

/**
 * Find a single trip option
 */
function findSingleTripOption(
  db: Database,
  path: ItineraryPath,
  serviceIds: string[],
  startTime: string,
  skipCount: number
): TripOption | null {
  const tripSegments: TripSegment[] = [];
  let currentTime = startTime;

  for (const segment of path.segments) {
    // Find a trip for this segment
    const tripSegment = findTripSegment(
      db,
      segment.routeId,
      segment.directionId,
      segment.boardStopId,
      segment.alightStopId,
      serviceIds,
      currentTime,
      skipCount
    );

    if (!tripSegment) {
      // No trip found for this segment
      return null;
    }

    tripSegments.push(tripSegment);

    // Update current time to arrival time + transfer time
    currentTime = addMinutesToTime(
      tripSegment.alightTime,
      DEFAULT_TRANSFER_TIME_MINUTES
    );
  }

  if (tripSegments.length === 0) {
    return null;
  }

  return {
    segments: tripSegments,
    totalDuration: calculateDuration(
      tripSegments[0].boardTime,
      tripSegments[tripSegments.length - 1].alightTime
    ),
    departureTime: tripSegments[0].boardTime,
    arrivalTime: tripSegments[tripSegments.length - 1].alightTime
  };
}

/**
 * Find a trip segment for a specific route/direction between two stops
 */
function findTripSegment(
  db: Database,
  routeId: string,
  directionId: number,
  boardStopId: string,
  alightStopId: string,
  serviceIds: string[],
  afterTime: string,
  skipCount: number
): TripSegment | null {
  // Get child stops for both board and alight stops (to handle parent stations)
  const boardChildStops = getChildStops(db, boardStopId);
  const alightChildStops = getChildStops(db, alightStopId);

  // Find trips for this route/direction on the given service IDs
  const serviceIdPlaceholders = serviceIds.map(() => '?').join(', ');

  const tripStmt = db.prepare(`
    SELECT trip_id, trip_headsign
    FROM trips
    WHERE route_id = ?
      AND (direction_id = ? OR direction_id IS NULL)
      AND service_id IN (${serviceIdPlaceholders})
  `);
  tripStmt.bind([routeId, directionId, ...serviceIds]);

  const tripIds: Array<{ trip_id: string; trip_headsign?: string }> = [];
  while (tripStmt.step()) {
    const row = tripStmt.getAsObject() as { trip_id: string; trip_headsign?: string };
    tripIds.push(row);
  }
  tripStmt.free();

  if (tripIds.length === 0) {
    return null;
  }

  // Find candidate trips
  const candidates: TripSegment[] = [];

  for (const trip of tripIds) {
    const segment = buildTripSegment(
      db,
      trip.trip_id,
      trip.trip_headsign,
      routeId,
      directionId,
      boardChildStops,
      alightChildStops,
      boardStopId,
      alightStopId,
      afterTime
    );

    if (segment) {
      candidates.push(segment);
    }
  }

  // Sort by board time
  candidates.sort((a, b) => compareGtfsTime(a.boardTime, b.boardTime));

  // Return the (skipCount+1)th option
  return candidates[skipCount] || null;
}

/**
 * Build a trip segment from a specific trip
 */
function buildTripSegment(
  db: Database,
  tripId: string,
  tripHeadsign: string | undefined,
  routeId: string,
  directionId: number,
  boardChildStops: string[],
  alightChildStops: string[],
  boardStopId: string,
  alightStopId: string,
  afterTime: string
): TripSegment | null {
  // Get stop times for this trip
  const stopTimesStmt = db.prepare(`
    SELECT stop_id, stop_sequence, arrival_time, departure_time
    FROM stop_times
    WHERE trip_id = ?
    ORDER BY stop_sequence
  `);
  stopTimesStmt.bind([tripId]);

  const stopTimes: Array<{
    stop_id: string;
    stop_sequence: number;
    arrival_time: string;
    departure_time: string;
  }> = [];

  while (stopTimesStmt.step()) {
    const row = stopTimesStmt.getAsObject() as {
      stop_id: string;
      stop_sequence: number;
      arrival_time: string;
      departure_time: string;
    };
    stopTimes.push(row);
  }
  stopTimesStmt.free();

  // Find board and alight stops in this trip
  let boardIdx = -1;
  let alightIdx = -1;

  for (let i = 0; i < stopTimes.length; i++) {
    if (boardIdx === -1 && boardChildStops.includes(stopTimes[i].stop_id)) {
      boardIdx = i;
    } else if (boardIdx !== -1 && alightChildStops.includes(stopTimes[i].stop_id)) {
      alightIdx = i;
      break;  // Found both stops
    }
  }

  // Check if both stops were found and in correct order
  if (boardIdx === -1 || alightIdx === -1 || boardIdx >= alightIdx) {
    return null;
  }

  const boardTime = stopTimes[boardIdx].departure_time;
  const alightTime = stopTimes[alightIdx].arrival_time;

  // Check if this trip departs after the required time
  if (compareGtfsTime(boardTime, afterTime) < 0) {
    return null;
  }

  // Get stop names
  const boardStop = getStopName(db, stopTimes[boardIdx].stop_id);
  const alightStop = getStopName(db, stopTimes[alightIdx].stop_id);

  // Build intermediate stops
  const intermediateStops: StopWithTime[] = [];
  for (let i = boardIdx + 1; i < alightIdx; i++) {
    const st = stopTimes[i];
    intermediateStops.push({
      stopId: st.stop_id,
      stopName: getStopName(db, st.stop_id),
      arrivalTime: st.arrival_time,
      departureTime: st.departure_time
    });
  }

  return {
    tripId,
    routeId,
    directionId,
    tripHeadsign,
    boardStopId: stopTimes[boardIdx].stop_id,
    boardStopName: boardStop,
    alightStopId: stopTimes[alightIdx].stop_id,
    alightStopName: alightStop,
    boardTime,
    alightTime,
    intermediateStops
  };
}

/**
 * Get stop name from database
 */
function getStopName(db: Database, stopId: string): string {
  const stmt = db.prepare('SELECT stop_name FROM stops WHERE stop_id = ?');
  stmt.bind([stopId]);

  let name = stopId;
  if (stmt.step()) {
    const row = stmt.getAsObject() as { stop_name: string };
    name = row.stop_name;
  }
  stmt.free();

  return name;
}
