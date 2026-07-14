/**
 * Realtime resolution engine — pure function, no database required.
 *
 * Combines scheduled stop times with GTFS-RT stop time updates into fully
 * pre-computed times, following the GTFS-RT spec semantics:
 * - an update's delay propagates to all subsequent stops until the next update
 * - the trip-level delay applies to stops not covered by any update
 * - updates may be matched by stop_sequence or by stop_id alone
 * - a delay can be derived from an absolute time and vice versa
 * - an arrival-only or departure-only update covers the missing event
 */

import type { StopTime } from '../types/gtfs';
import type { StopTimeUpdate, TripUpdate } from '../types/gtfs-rt';
import { StopTimeScheduleRelationship, TripScheduleRelationship } from '../types/gtfs-rt';
import { parseGtfsTime, serviceDayStartEpoch } from './gtfs-time';

/** How the realtime information for a stop was obtained. */
export type RealtimeSource =
  /** A stop time update explicitly targeted this stop. */
  | 'exact'
  /** Delay propagated from an earlier stop's update (GTFS-RT spec behavior). */
  | 'propagated'
  /** Trip-level delay (TripUpdate.delay) used as fallback. */
  | 'trip_delay'
  /** No realtime information applies to this stop. */
  | 'none';

/** Computed fields added to each stop time by {@link resolveRealtime}. */
export interface ResolvedStopTimeFields {
  /** Scheduled arrival in seconds since the start of the service day (may exceed 86400). */
  scheduled_arrival_seconds?: number;
  /** Scheduled departure in seconds since the start of the service day (may exceed 86400). */
  scheduled_departure_seconds?: number;
  /** Scheduled arrival as unix epoch seconds. */
  scheduled_arrival_epoch?: number;
  /** Scheduled departure as unix epoch seconds. */
  scheduled_departure_epoch?: number;
  /** Estimated arrival as unix epoch seconds (realtime). */
  rt_arrival_epoch?: number;
  /** Estimated departure as unix epoch seconds (realtime). */
  rt_departure_epoch?: number;
  /** Arrival delay in seconds (negative = early). Set whenever realtime is known. */
  arrival_delay?: number;
  /** Departure delay in seconds (negative = early). Set whenever realtime is known. */
  departure_delay?: number;
  /** How the realtime information was obtained. */
  rt_source: RealtimeSource;
  /** Stop is skipped (GTFS-RT SKIPPED). Scheduled times remain for reference. */
  skipped: boolean;
  /** Feed explicitly signalled no realtime data for this stop (GTFS-RT NO_DATA). */
  no_data: boolean;
  /** Prediction uncertainty in seconds, when the feed provides one. */
  uncertainty?: number;
  /** Best time to display: realtime if known, scheduled otherwise. Departure for
   * regular stops and arrival at the terminus (flipped in 'arrival' display mode). */
  display_epoch?: number;
  /** Delay backing display_epoch, set only when it is a realtime estimate. */
  display_delay?: number;
  /** Whether display_epoch is a realtime estimate rather than the schedule. */
  display_is_realtime: boolean;
  /** First stop of the trip. */
  is_first: boolean;
  /** Last stop of the trip. */
  is_last: boolean;
}

export type ResolvedStopTime = StopTime & ResolvedStopTimeFields;

export interface ResolveRealtimeOptions {
  /** Service date of the trip in YYYYMMDD format. */
  serviceDate: string;
  /** IANA timezone of the agency (stop_times.txt is always in agency time). */
  timezone: string;
  /**
   * Which event display_epoch prefers.
   * 'departure' (default): departure everywhere, arrival at the last stop.
   * 'arrival': arrival everywhere, departure at the first stop.
   */
  displayMode?: 'departure' | 'arrival';
  /**
   * When set, updates whose rt_last_updated is older than now minus this many
   * seconds are ignored. Updates without rt_last_updated are always kept.
   */
  stalenessThreshold?: number;
  /** Reference "current time" in unix seconds for staleness checks. Defaults to the system clock. */
  now?: number;
}

interface ResolvedEvent {
  delay?: number;
  epoch?: number;
}

/**
 * Resolve one StopTimeEvent against its scheduled epoch. An absolute time wins
 * over a delay when both are present (and re-derives the delay for consistency).
 */
function resolveEvent(
  event: { delay?: number; time?: number } | undefined,
  scheduledEpoch: number | undefined
): ResolvedEvent {
  if (!event) return {};
  if (event.time !== undefined && event.time !== null) {
    const delay = scheduledEpoch !== undefined ? event.time - scheduledEpoch : event.delay;
    return { delay, epoch: event.time };
  }
  if (event.delay !== undefined && event.delay !== null) {
    return {
      delay: event.delay,
      epoch: scheduledEpoch !== undefined ? scheduledEpoch + event.delay : undefined,
    };
  }
  return {};
}

/**
 * Merge scheduled stop times of a single trip with its GTFS-RT data into
 * fully resolved, display-ready stop times.
 *
 * Extra properties on the input stop times (e.g. a joined stop_name) are
 * preserved on the output objects.
 *
 * @param stopTimes - Stop times of one trip (any order; sorted by stop_sequence internally)
 * @param stopTimeUpdates - GTFS-RT stop time updates for the same trip (empty array if none)
 * @param tripUpdate - Trip-level update for delay fallback and cancellation, if any
 * @param options - Service date, timezone and display options
 */
export function resolveRealtime<T extends StopTime>(
  stopTimes: T[],
  stopTimeUpdates: StopTimeUpdate[],
  tripUpdate: Pick<TripUpdate, 'delay' | 'schedule_relationship'> | null | undefined,
  options: ResolveRealtimeOptions
): Array<T & ResolvedStopTimeFields> {
  const { serviceDate, timezone, displayMode = 'departure' } = options;
  const dayStart = serviceDayStartEpoch(serviceDate, timezone);
  const sorted = [...stopTimes].sort((a, b) => a.stop_sequence - b.stop_sequence);

  let updates = stopTimeUpdates;
  if (options.stalenessThreshold !== undefined) {
    const now = options.now ?? Math.floor(Date.now() / 1000);
    const cutoff = now - options.stalenessThreshold;
    updates = updates.filter(u => u.rt_last_updated === undefined || u.rt_last_updated >= cutoff);
  }

  const canceled = tripUpdate?.schedule_relationship === TripScheduleRelationship.CANCELED;

  // Updates are matched by stop_sequence when present, else by stop_id.
  // stop_id-only updates are consumed in order so a loop trip visiting the
  // same stop twice does not reuse the same update.
  const bySequence = new Map<number, StopTimeUpdate>();
  const byStopId = new Map<string, StopTimeUpdate[]>();
  for (const update of updates) {
    if (update.stop_sequence !== undefined && update.stop_sequence !== null) {
      bySequence.set(update.stop_sequence, update);
    } else if (update.stop_id) {
      const queue = byStopId.get(update.stop_id);
      if (queue) queue.push(update);
      else byStopId.set(update.stop_id, [update]);
    }
  }

  let propagatedDelay: number | undefined;

  return sorted.map((st, index) => {
    const scheduledArrivalSeconds = parseGtfsTime(st.arrival_time);
    const scheduledDepartureSeconds = parseGtfsTime(st.departure_time);
    const scheduledArrivalEpoch =
      scheduledArrivalSeconds !== undefined ? dayStart + scheduledArrivalSeconds : undefined;
    const scheduledDepartureEpoch =
      scheduledDepartureSeconds !== undefined ? dayStart + scheduledDepartureSeconds : undefined;

    let update = bySequence.get(st.stop_sequence);
    if (!update) {
      const queue = byStopId.get(st.stop_id);
      if (queue && queue.length > 0) update = queue.shift();
    }

    let arrivalDelay: number | undefined;
    let departureDelay: number | undefined;
    let rtArrivalEpoch: number | undefined;
    let rtDepartureEpoch: number | undefined;
    let uncertainty: number | undefined;
    let source: RealtimeSource = 'none';
    let skipped = false;
    let noData = false;

    // An update with neither event nor a special relationship carries no
    // information — fall through to propagation / trip delay.
    const hasEvents = update !== undefined && (update.arrival !== undefined || update.departure !== undefined);
    const relationship = update?.schedule_relationship;

    if (canceled) {
      // Whole trip canceled: keep schedule for reference, no estimates.
    } else if (relationship === StopTimeScheduleRelationship.SKIPPED) {
      skipped = true;
      source = 'exact';
      // Propagation from earlier stops continues past a skipped stop.
    } else if (relationship === StopTimeScheduleRelationship.NO_DATA) {
      noData = true;
      propagatedDelay = undefined;
    } else if (hasEvents) {
      const arrival = resolveEvent(update?.arrival, scheduledArrivalEpoch);
      const departure = resolveEvent(update?.departure, scheduledDepartureEpoch);
      arrivalDelay = arrival.delay;
      rtArrivalEpoch = arrival.epoch;
      departureDelay = departure.delay;
      rtDepartureEpoch = departure.epoch;

      // Borrow the delay across events when only one side was provided.
      if (arrivalDelay === undefined && rtArrivalEpoch === undefined) {
        arrivalDelay = departureDelay;
      }
      if (departureDelay === undefined && rtDepartureEpoch === undefined) {
        departureDelay = arrivalDelay;
      }

      uncertainty = update?.departure?.uncertainty ?? update?.arrival?.uncertainty;
      source = 'exact';
      propagatedDelay = departureDelay ?? arrivalDelay;
    } else if (propagatedDelay !== undefined) {
      arrivalDelay = propagatedDelay;
      departureDelay = propagatedDelay;
      source = 'propagated';
    } else if (tripUpdate?.delay !== undefined && tripUpdate.delay !== null) {
      arrivalDelay = tripUpdate.delay;
      departureDelay = tripUpdate.delay;
      source = 'trip_delay';
    }

    if (rtArrivalEpoch === undefined && arrivalDelay !== undefined && scheduledArrivalEpoch !== undefined) {
      rtArrivalEpoch = scheduledArrivalEpoch + arrivalDelay;
    }
    if (rtDepartureEpoch === undefined && departureDelay !== undefined && scheduledDepartureEpoch !== undefined) {
      rtDepartureEpoch = scheduledDepartureEpoch + departureDelay;
    }

    const isFirst = index === 0;
    const isLast = index === sorted.length - 1;
    const useArrival = displayMode === 'departure' ? isLast : !isFirst;

    const displayScheduled = useArrival
      ? scheduledArrivalEpoch ?? scheduledDepartureEpoch
      : scheduledDepartureEpoch ?? scheduledArrivalEpoch;
    const displayRt = useArrival
      ? rtArrivalEpoch ?? rtDepartureEpoch
      : rtDepartureEpoch ?? rtArrivalEpoch;
    const displayDelay = useArrival
      ? arrivalDelay ?? departureDelay
      : departureDelay ?? arrivalDelay;

    const displayIsRealtime = displayRt !== undefined && !skipped && !noData && !canceled;

    return {
      ...st,
      scheduled_arrival_seconds: scheduledArrivalSeconds,
      scheduled_departure_seconds: scheduledDepartureSeconds,
      scheduled_arrival_epoch: scheduledArrivalEpoch,
      scheduled_departure_epoch: scheduledDepartureEpoch,
      rt_arrival_epoch: rtArrivalEpoch,
      rt_departure_epoch: rtDepartureEpoch,
      arrival_delay: arrivalDelay,
      departure_delay: departureDelay,
      rt_source: source,
      skipped,
      no_data: noData,
      uncertainty,
      display_epoch: displayIsRealtime ? displayRt : displayScheduled,
      display_delay: displayIsRealtime ? displayDelay : undefined,
      display_is_realtime: displayIsRealtime,
      is_first: isFirst,
      is_last: isLast,
    };
  });
}
