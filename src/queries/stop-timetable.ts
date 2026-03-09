/**
 * Stop Timetable Query
 */

import type { Database } from 'sql.js';
import type { StopTimetableFilters, StopTimetable, RouteGroup, TripWithStopTimes, StopTime, Trip, Route } from '../types/gtfs';
import { getStops } from './stops';
import { getActiveServiceIds } from './calendar';
import { getStopTimes, buildOrderedStopList } from './stop-times';
import { getTrips } from './trips';
import { getRoutes } from './routes';

/**
 * Parse a GTFS time string (HH:MM:SS) to seconds since midnight.
 * Handles times > 24:00:00 for trips that extend past midnight.
 */
function timeToSeconds(time: string): number {
  const parts = time.split(':');
  return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
}

/**
 * Get a complete stop timetable for a given stop and date.
 */
export function getStopTimetable(
  db: Database,
  filters: StopTimetableFilters,
  stalenessThreshold: number = 120
): StopTimetable {
  const { stopId: rawStopId, date, routeId, directionId, pickupType, includeRealtime } = filters;
  const stopIds = Array.isArray(rawStopId) ? rawStopId : [rawStopId];

  // 1. Get stop
  const stops = getStops(db, { stopId: stopIds });
  if (stops.length === 0) {
    throw new Error(`Stop not found: ${stopIds.join(', ')}`);
  }
  const stop = stops[0];

  // 2. Get active services
  const serviceIds = getActiveServiceIds(db, date);
  if (serviceIds.length === 0) {
    return { stop, date, routeGroups: [] };
  }

  // 3. Get stop_times at queried stop
  const stopTimesAtStop = getStopTimes(db, {
    stopId: stopIds,
    serviceIds,
    routeId,
    directionId: directionId !== undefined ? directionId : undefined,
    pickupType,
  }, stalenessThreshold) as StopTime[];

  if (stopTimesAtStop.length === 0) {
    return { stop, date, routeGroups: [] };
  }

  // 4. Get trip IDs
  const tripIds = [...new Set(stopTimesAtStop.map(st => st.trip_id))];

  // 5. Get Trip objects
  const trips = getTrips(db, { tripId: tripIds }, stalenessThreshold) as Trip[];
  const tripMap = new Map<string, Trip>();
  for (const trip of trips) {
    tripMap.set(trip.trip_id, trip);
  }

  // 6. Get Route objects
  const uniqueRouteIds = [...new Set(trips.map(t => t.route_id))];
  const routes = getRoutes(db, { routeId: uniqueRouteIds });
  const routeMap = new Map<string, Route>();
  for (const route of routes) {
    routeMap.set(route.route_id, route);
  }

  // 7. Group trips by (route_id, direction_id ?? 0)
  const groups = new Map<string, string[]>();
  for (const trip of trips) {
    const dir = trip.direction_id ?? 0;
    const key = `${trip.route_id}:${dir}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(trip.trip_id);
  }

  // 8. Build each route group
  const routeGroups: RouteGroup[] = [];

  for (const [key, groupTripIds] of groups) {
    const [groupRouteId, dirStr] = key.split(':');
    const groupDirectionId = parseInt(dirStr, 10);
    const route = routeMap.get(groupRouteId);
    if (!route) continue;

    // 8a. Build ordered stop list
    const orderedStops = buildOrderedStopList(db, groupTripIds);

    // 8b. Find queried stop index
    const stopIdSet = new Set(stopIds);
    const queriedStopIndex = orderedStops.findIndex(s => stopIdSet.has(s.stop_id));

    // 8c. Batch-fetch all stop_times for group's trips
    const allStopTimes = getStopTimes(db, {
      tripId: groupTripIds,
      includeRealtime,
    }, stalenessThreshold) as StopTime[];

    // 8d. Group by trip_id and align to orderedStops
    const stopTimesByTrip = new Map<string, Map<string, StopTime>>();
    for (const st of allStopTimes) {
      if (!stopTimesByTrip.has(st.trip_id)) {
        stopTimesByTrip.set(st.trip_id, new Map());
      }
      stopTimesByTrip.get(st.trip_id)!.set(st.stop_id, st);
    }

    const tripsWithStopTimes: TripWithStopTimes[] = [];
    for (const tripId of groupTripIds) {
      const trip = tripMap.get(tripId);
      if (!trip) continue;

      const tripStopTimeMap = stopTimesByTrip.get(tripId) ?? new Map<string, StopTime>();
      const alignedStopTimes = orderedStops.map(s => tripStopTimeMap.get(s.stop_id) ?? null);

      tripsWithStopTimes.push({ trip, stopTimes: alignedStopTimes });
    }

    // 8e. Determine most common trip_headsign
    const headsignCounts = new Map<string, number>();
    for (const tripId of groupTripIds) {
      const trip = tripMap.get(tripId);
      if (trip?.trip_headsign) {
        headsignCounts.set(trip.trip_headsign, (headsignCounts.get(trip.trip_headsign) ?? 0) + 1);
      }
    }
    let headsign: string | undefined;
    let maxCount = 0;
    for (const [h, count] of headsignCounts) {
      if (count > maxCount) {
        maxCount = count;
        headsign = h;
      }
    }

    // 8f. Sort trips by departure_time at queriedStopIndex
    tripsWithStopTimes.sort((a, b) => {
      const stA = a.stopTimes[queriedStopIndex];
      const stB = b.stopTimes[queriedStopIndex];

      // Trips with null at queried stop sort last
      if (!stA?.departure_time && !stB?.departure_time) return 0;
      if (!stA?.departure_time) return 1;
      if (!stB?.departure_time) return -1;

      return timeToSeconds(stA.departure_time) - timeToSeconds(stB.departure_time);
    });

    routeGroups.push({
      route,
      directionId: groupDirectionId,
      headsign,
      orderedStops,
      queriedStopIndex,
      trips: tripsWithStopTimes,
    });
  }

  // 9. Sort routeGroups by route_sort_order, then route_short_name, then directionId
  routeGroups.sort((a, b) => {
    const sortA = a.route.route_sort_order ?? Infinity;
    const sortB = b.route.route_sort_order ?? Infinity;
    if (sortA !== sortB) return sortA - sortB;

    const nameA = a.route.route_short_name ?? '';
    const nameB = b.route.route_short_name ?? '';
    if (nameA !== nameB) return nameA.localeCompare(nameB);

    return a.directionId - b.directionId;
  });

  // 10. Return
  return { stop, date, routeGroups };
}
