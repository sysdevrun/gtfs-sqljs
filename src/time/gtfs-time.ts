/**
 * GTFS time utilities — pure functions, no database required.
 *
 * GTFS stop times are strings like "08:15:00" measured from "noon minus 12
 * hours" on the service date (effectively midnight, except on days with a
 * daylight-saving change), in the agency's timezone. Hours may exceed 24 for
 * trips running past midnight ("25:30:00" = 01:30 the next calendar day).
 */

const GTFS_TIME_RE = /^(\d{1,3}):(\d{1,2})(?::(\d{1,2}))?$/;

/**
 * Parse a GTFS time string into seconds since the start of the service day.
 *
 * Accepts "HH:MM:SS" and lenient variants ("H:MM:SS", "HH:MM"). Hours may
 * exceed 24, so the result may exceed 86400. Returns `undefined` for
 * missing or malformed input (e.g. interpolated stop times with no value).
 */
export function parseGtfsTime(time: string | null | undefined): number | undefined {
  if (time == null) return undefined;
  const match = GTFS_TIME_RE.exec(time.trim());
  if (!match) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] !== undefined ? Number(match[3]) : 0;
  if (minutes >= 60 || seconds >= 60) return undefined;
  return hours * 3600 + minutes * 60 + seconds;
}

// One Intl.DateTimeFormat per timezone — construction is expensive, reuse is not.
const dtfCache = new Map<string, Intl.DateTimeFormat>();

function getDtf(timeZone: string): Intl.DateTimeFormat {
  let dtf = dtfCache.get(timeZone);
  if (!dtf) {
    dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    dtfCache.set(timeZone, dtf);
  }
  return dtf;
}

/** Wall-clock reading of an instant in a timezone, re-encoded as a UTC ms value. */
function wallClockAsUtcMs(epochMs: number, timeZone: string): number {
  const parts = getDtf(timeZone).formatToParts(epochMs);
  const v: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== 'literal') v[part.type] = Number(part.value);
  }
  return Date.UTC(v.year, v.month - 1, v.day, v.hour, v.minute, v.second);
}

const dayStartCache = new Map<string, number>();

/**
 * Unix epoch (seconds) of the start of a GTFS service day: local noon on the
 * service date minus 12 hours. Using noon as the anchor keeps results correct
 * on daylight-saving change days, where "midnight plus N hours" is off by the
 * shifted hour.
 *
 * @param serviceDate - Service date in YYYYMMDD format (e.g. '20260713')
 * @param timezone - IANA timezone name (e.g. 'Europe/Paris'). GTFS stop times
 *   are always expressed in the agency's timezone (`agency_timezone`).
 */
export function serviceDayStartEpoch(serviceDate: string, timezone: string): number {
  const key = `${serviceDate}|${timezone}`;
  const cached = dayStartCache.get(key);
  if (cached !== undefined) return cached;

  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(serviceDate);
  if (!match) {
    throw new Error(`Invalid service date "${serviceDate}" (expected YYYYMMDD)`);
  }
  const targetNoonWall = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0);

  // Find the instant whose wall clock in `timezone` reads exactly noon on the
  // service date: start from noon UTC and correct by the observed difference.
  // Converges in one step for fixed offsets; a second pass covers the rare
  // case where the first correction crosses a DST transition.
  let guess = targetNoonWall;
  for (let i = 0; i < 3; i++) {
    const diff = wallClockAsUtcMs(guess, timezone) - targetNoonWall;
    if (diff === 0) break;
    guess -= diff;
  }

  const result = guess / 1000 - 12 * 3600;
  dayStartCache.set(key, result);
  return result;
}

/**
 * Convert a GTFS time (seconds since the start of the service day, as returned
 * by {@link parseGtfsTime}) into a unix epoch in seconds.
 *
 * @param daySeconds - Seconds since the start of the service day (may exceed 86400)
 * @param serviceDate - Service date in YYYYMMDD format
 * @param timezone - IANA timezone name of the agency
 */
export function gtfsTimeToEpoch(daySeconds: number, serviceDate: string, timezone: string): number {
  return serviceDayStartEpoch(serviceDate, timezone) + daySeconds;
}
