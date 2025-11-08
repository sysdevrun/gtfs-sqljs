/**
 * Time Utility Functions for GTFS
 * Handles GTFS time format (HH:MM:SS) which can exceed 24:00:00
 */

/**
 * Convert GTFS time (HH:MM:SS) to seconds since start of service day
 * Handles times > 24:00:00 (e.g., 25:30:00 = 1:30 AM next day)
 */
export function gtfsTimeToSeconds(time: string): number {
  const [h, m, s] = time.split(':').map(Number);
  return h * 3600 + m * 60 + s;
}

/**
 * Convert seconds to GTFS time format (HH:MM:SS)
 */
export function secondsToGtfsTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Compare two GTFS times
 * Returns: < 0 if time1 < time2, 0 if equal, > 0 if time1 > time2
 */
export function compareGtfsTime(time1: string, time2: string): number {
  return gtfsTimeToSeconds(time1) - gtfsTimeToSeconds(time2);
}

/**
 * Add minutes to a GTFS time
 */
export function addMinutesToTime(time: string, minutes: number): string {
  const seconds = gtfsTimeToSeconds(time);
  const newSeconds = seconds + (minutes * 60);
  return secondsToGtfsTime(newSeconds);
}

/**
 * Calculate duration between two GTFS times in seconds
 */
export function calculateDuration(startTime: string, endTime: string): number {
  return gtfsTimeToSeconds(endTime) - gtfsTimeToSeconds(startTime);
}

/**
 * Format duration in seconds to human-readable format
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}
