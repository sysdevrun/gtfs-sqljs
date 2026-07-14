/**
 * Trip Schedule Query — batch, display-ready stop times with realtime resolved.
 *
 * A constant number of SQL queries regardless of how many trips are requested:
 * trips, agencies, stop_times (joined with stops), and the two realtime tables.
 */

import type { GtfsDatabase, Row } from '../adapters/types';
import type { StopTime, Trip } from '../types/gtfs';
import type { StopTimeUpdate } from '../types/gtfs-rt';
import { TripScheduleRelationship } from '../types/gtfs-rt';
import type { ResolvedStopTimeFields } from '../time/resolve-realtime';
import { resolveRealtime } from '../time/resolve-realtime';
import { getActiveServiceIds } from './calendar';

export interface TripScheduleFilters {
  tripId?: string | string[];
  routeId?: string | string[];
  directionId?: number;
  /** Service date in YYYYMMDD format. Used to select trips (with routeId) and to compute epochs. */
  date: string;
  /** Reference "current time" in unix seconds for realtime staleness. Defaults to the system clock. */
  now?: number;
  /**
   * Which event display_epoch prefers.
   * 'departure' (default): departure everywhere, arrival at the last stop.
   * 'arrival': arrival everywhere, departure at the first stop.
   */
  displayMode?: 'departure' | 'arrival';
  /** Override the timezone used for epoch computation (defaults to the trip's agency_timezone). */
  timezone?: string;
}

/** A resolved stop time enriched with the joined stop's descriptive fields. */
export interface TripScheduleStop extends StopTime, ResolvedStopTimeFields {
  stop_name?: string;
  stop_lat?: number;
  stop_lon?: number;
  parent_station?: string;
  platform_code?: string;
}

export interface TripSchedule {
  trip: Trip;
  /** The service date the schedule was resolved for (YYYYMMDD). */
  service_date: string;
  /** IANA timezone used for epoch computation. */
  timezone: string;
  /** Trip is canceled in the realtime feed. */
  canceled: boolean;
  /** Trip-level delay in seconds (TripUpdate.delay), when the feed provides one. */
  trip_delay?: number;
  /** Trip-level schedule relationship from the realtime feed. */
  schedule_relationship?: TripScheduleRelationship;
  /** Most recent realtime load time (unix seconds) among this trip's updates. */
  rt_last_updated?: number;
  /** Whether any realtime information applies to this trip. */
  has_realtime: boolean;
  /** Resolved stop times ordered by stop_sequence. */
  stops: TripScheduleStop[];
}

type StopTimeWithStop = StopTime & {
  stop_name?: string;
  stop_lat?: number;
  stop_lon?: number;
  parent_station?: string;
  platform_code?: string;
};

interface TripUpdateRow {
  delay?: number;
  schedule_relationship?: TripScheduleRelationship;
  rt_last_updated: number;
}

function rowToTrip(row: Row): Trip {
  return {
    trip_id: String(row.trip_id),
    route_id: String(row.route_id),
    service_id: String(row.service_id),
    trip_headsign: row.trip_headsign ? String(row.trip_headsign) : undefined,
    trip_short_name: row.trip_short_name ? String(row.trip_short_name) : undefined,
    direction_id: row.direction_id !== null ? Number(row.direction_id) : undefined,
    block_id: row.block_id ? String(row.block_id) : undefined,
    shape_id: row.shape_id ? String(row.shape_id) : undefined,
    wheelchair_accessible: row.wheelchair_accessible !== null ? Number(row.wheelchair_accessible) : undefined,
    bikes_allowed: row.bikes_allowed !== null ? Number(row.bikes_allowed) : undefined,
  };
}

function rowToStopTimeWithStop(row: Row): StopTimeWithStop {
  return {
    trip_id: String(row.trip_id),
    arrival_time: row.arrival_time ? String(row.arrival_time) : undefined,
    departure_time: row.departure_time ? String(row.departure_time) : undefined,
    stop_id: String(row.stop_id),
    stop_sequence: Number(row.stop_sequence),
    stop_headsign: row.stop_headsign ? String(row.stop_headsign) : undefined,
    pickup_type: row.pickup_type !== null ? Number(row.pickup_type) : undefined,
    drop_off_type: row.drop_off_type !== null ? Number(row.drop_off_type) : undefined,
    continuous_pickup: row.continuous_pickup !== null ? Number(row.continuous_pickup) : undefined,
    continuous_drop_off: row.continuous_drop_off !== null ? Number(row.continuous_drop_off) : undefined,
    shape_dist_traveled: row.shape_dist_traveled !== null ? Number(row.shape_dist_traveled) : undefined,
    timepoint: row.timepoint !== null ? Number(row.timepoint) : undefined,
    stop_name: row.stop_name ? String(row.stop_name) : undefined,
    stop_lat: row.stop_lat !== null ? Number(row.stop_lat) : undefined,
    stop_lon: row.stop_lon !== null ? Number(row.stop_lon) : undefined,
    parent_station: row.parent_station ? String(row.parent_station) : undefined,
    platform_code: row.platform_code ? String(row.platform_code) : undefined,
  };
}

async function queryAll(db: GtfsDatabase, sql: string, params: (string | number)[]): Promise<Row[]> {
  const stmt = await db.prepare(sql);
  if (params.length > 0) {
    await stmt.bind(params);
  }
  const rows: Row[] = [];
  while (await stmt.step()) {
    rows.push(await stmt.getAsObject());
  }
  await stmt.free();
  return rows;
}

/** Same as queryAll but returns [] when the table does not exist (e.g. a
 * database attached with skipSchema before any realtime table was created). */
async function queryAllIfTableExists(db: GtfsDatabase, sql: string, params: (string | number)[]): Promise<Row[]> {
  try {
    return await queryAll(db, sql, params);
  } catch (error) {
    if (error instanceof Error && /no such table/i.test(error.message)) {
      return [];
    }
    throw error;
  }
}

function placeholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ');
}

/**
 * Get display-ready schedules for one or more trips, with scheduled and
 * realtime times fully pre-computed (day-seconds, unix epochs, delays,
 * skip/cancel flags) and stop names joined in.
 *
 * Requires `tripId` and/or `routeId`. With `routeId` and no `tripId`, trips
 * are selected among services active on `date`. Results are ordered by the
 * first stop's scheduled time.
 */
export async function getTripSchedules(
  db: GtfsDatabase,
  filters: TripScheduleFilters,
  stalenessThreshold: number = 120
): Promise<TripSchedule[]> {
  const { tripId, routeId, directionId, date, displayMode, timezone: timezoneOverride } = filters;

  if (!date) {
    throw new Error('getTripSchedules requires a date (YYYYMMDD)');
  }
  if (!tripId && !routeId) {
    throw new Error('getTripSchedules requires tripId and/or routeId');
  }

  // --- Select trips (joined with routes for the agency) ---
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (tripId) {
    const tripIds = Array.isArray(tripId) ? tripId : [tripId];
    if (tripIds.length === 0) return [];
    conditions.push(`t.trip_id IN (${placeholders(tripIds.length)})`);
    params.push(...tripIds);
  }

  if (routeId) {
    const routeIds = Array.isArray(routeId) ? routeId : [routeId];
    if (routeIds.length === 0) return [];
    conditions.push(`t.route_id IN (${placeholders(routeIds.length)})`);
    params.push(...routeIds);
  }

  if (directionId !== undefined) {
    conditions.push('t.direction_id = ?');
    params.push(directionId);
  }

  // Explicit trip IDs are taken as-is; route-driven selection is restricted
  // to services active on the requested date.
  if (!tripId) {
    const serviceIds = await getActiveServiceIds(db, date);
    if (serviceIds.length === 0) return [];
    conditions.push(`t.service_id IN (${placeholders(serviceIds.length)})`);
    params.push(...serviceIds);
  }

  const tripRows = await queryAll(
    db,
    `SELECT t.*, r.agency_id AS route_agency_id
     FROM trips t LEFT JOIN routes r ON t.route_id = r.route_id
     WHERE ${conditions.join(' AND ')}`,
    params
  );
  if (tripRows.length === 0) return [];

  const trips = tripRows.map(row => ({
    trip: rowToTrip(row),
    agencyId: row.route_agency_id ? String(row.route_agency_id) : undefined,
  }));
  const tripIds = trips.map(t => t.trip.trip_id);
  const tripPlaceholders = placeholders(tripIds.length);

  // --- Agency timezones ---
  const agencyRows = await queryAll(db, 'SELECT agency_id, agency_timezone FROM agency', []);
  const agencyTimezones = new Map<string, string>();
  for (const row of agencyRows) {
    agencyTimezones.set(String(row.agency_id), String(row.agency_timezone));
  }
  const defaultTimezone = agencyRows.length > 0 ? String(agencyRows[0].agency_timezone) : 'UTC';

  // --- Stop times with stop info ---
  const stopTimeRows = await queryAll(
    db,
    `SELECT st.*, s.stop_name, s.stop_lat, s.stop_lon, s.parent_station, s.platform_code
     FROM stop_times st LEFT JOIN stops s ON st.stop_id = s.stop_id
     WHERE st.trip_id IN (${tripPlaceholders})
     ORDER BY st.trip_id, st.stop_sequence`,
    [...tripIds]
  );
  const stopTimesByTrip = new Map<string, StopTimeWithStop[]>();
  for (const row of stopTimeRows) {
    const st = rowToStopTimeWithStop(row);
    const list = stopTimesByTrip.get(st.trip_id);
    if (list) list.push(st);
    else stopTimesByTrip.set(st.trip_id, [st]);
  }

  // --- Realtime data (staleness applied in SQL) ---
  const now = filters.now ?? Math.floor(Date.now() / 1000);
  const cutoff = now - stalenessThreshold;

  const updateRows = await queryAllIfTableExists(
    db,
    `SELECT * FROM rt_stop_time_updates
     WHERE trip_id IN (${tripPlaceholders}) AND rt_last_updated >= ?`,
    [...tripIds, cutoff]
  );
  const updatesByTrip = new Map<string, StopTimeUpdate[]>();
  for (const row of updateRows) {
    const update: StopTimeUpdate = {
      trip_id: String(row.trip_id),
      stop_sequence: row.stop_sequence !== null ? Number(row.stop_sequence) : undefined,
      stop_id: row.stop_id ? String(row.stop_id) : undefined,
      schedule_relationship: row.schedule_relationship !== null ? Number(row.schedule_relationship) : undefined,
      rt_last_updated: Number(row.rt_last_updated),
    };
    if (row.arrival_delay !== null || row.arrival_time !== null || row.arrival_uncertainty !== null) {
      update.arrival = {
        delay: row.arrival_delay !== null ? Number(row.arrival_delay) : undefined,
        time: row.arrival_time !== null ? Number(row.arrival_time) : undefined,
        uncertainty: row.arrival_uncertainty !== null ? Number(row.arrival_uncertainty) : undefined,
      };
    }
    if (row.departure_delay !== null || row.departure_time !== null || row.departure_uncertainty !== null) {
      update.departure = {
        delay: row.departure_delay !== null ? Number(row.departure_delay) : undefined,
        time: row.departure_time !== null ? Number(row.departure_time) : undefined,
        uncertainty: row.departure_uncertainty !== null ? Number(row.departure_uncertainty) : undefined,
      };
    }
    const tripKey = String(row.trip_id);
    const list = updatesByTrip.get(tripKey);
    if (list) list.push(update);
    else updatesByTrip.set(tripKey, [update]);
  }

  const tripUpdateRows = await queryAllIfTableExists(
    db,
    `SELECT trip_id, delay, schedule_relationship, rt_last_updated FROM rt_trip_updates
     WHERE trip_id IN (${tripPlaceholders}) AND rt_last_updated >= ?`,
    [...tripIds, cutoff]
  );
  const tripUpdatesByTrip = new Map<string, TripUpdateRow>();
  for (const row of tripUpdateRows) {
    tripUpdatesByTrip.set(String(row.trip_id), {
      delay: row.delay !== null ? Number(row.delay) : undefined,
      schedule_relationship: row.schedule_relationship !== null ? Number(row.schedule_relationship) : undefined,
      rt_last_updated: Number(row.rt_last_updated),
    });
  }

  // --- Resolve per trip ---
  const schedules = trips.map(({ trip, agencyId }): TripSchedule => {
    const timezone =
      timezoneOverride ??
      (agencyId !== undefined ? agencyTimezones.get(agencyId) : undefined) ??
      defaultTimezone;
    const stopTimes = stopTimesByTrip.get(trip.trip_id) ?? [];
    const updates = updatesByTrip.get(trip.trip_id) ?? [];
    const tripUpdate = tripUpdatesByTrip.get(trip.trip_id);

    const stops = resolveRealtime(stopTimes, updates, tripUpdate, {
      serviceDate: date,
      timezone,
      displayMode,
    });

    let lastUpdated = tripUpdate?.rt_last_updated;
    for (const update of updates) {
      if (update.rt_last_updated !== undefined && (lastUpdated === undefined || update.rt_last_updated > lastUpdated)) {
        lastUpdated = update.rt_last_updated;
      }
    }

    return {
      trip,
      service_date: date,
      timezone,
      canceled: tripUpdate?.schedule_relationship === TripScheduleRelationship.CANCELED,
      trip_delay: tripUpdate?.delay,
      schedule_relationship: tripUpdate?.schedule_relationship,
      rt_last_updated: lastUpdated,
      has_realtime: tripUpdate !== undefined || stops.some(s => s.rt_source !== 'none'),
      stops,
    };
  });

  // Stable board ordering: by the first stop's scheduled time.
  const firstEpoch = (s: TripSchedule): number =>
    s.stops[0]?.scheduled_departure_epoch ?? s.stops[0]?.scheduled_arrival_epoch ?? Number.POSITIVE_INFINITY;
  schedules.sort((a, b) => firstEpoch(a) - firstEpoch(b));

  return schedules;
}
