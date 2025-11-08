/**
 * Parent Stop Utilities
 * Handles parent-child stop relationships and caching
 */

import type { Database } from 'sql.js';
import type { Stop } from '../types/gtfs';

/**
 * Recursively finds the top parent of a stop
 * Returns the stop_id itself if no parent exists
 */
export function getTopParentStop(
  db: Database,
  stopId: string,
  stopCache?: Map<string, Stop>
): string {
  // Use cache if provided
  let stop: Stop | undefined;
  if (stopCache) {
    stop = stopCache.get(stopId);
  } else {
    const stmt = db.prepare('SELECT * FROM stops WHERE stop_id = ?');
    stmt.bind([stopId]);
    if (stmt.step()) {
      stop = stmt.getAsObject() as Stop;
    }
    stmt.free();
  }

  if (!stop) return stopId;

  // If no parent, this is the top
  if (!stop.parent_station) return stopId;

  // Recursively find parent's parent
  return getTopParentStop(db, stop.parent_station, stopCache);
}

/**
 * Build a cache of stopId -> topParentId
 * This should be done once when building the graph
 */
export function buildParentStopCache(db: Database): Map<string, string> {
  const cache = new Map<string, string>();
  const stopCache = new Map<string, Stop>();

  // First, load all stops into memory
  const stmt = db.prepare('SELECT * FROM stops');
  while (stmt.step()) {
    const stop = stmt.getAsObject() as Stop;
    stopCache.set(stop.stop_id, stop);
  }
  stmt.free();

  // Now build parent cache
  for (const [stopId] of stopCache) {
    cache.set(stopId, getTopParentStop(db, stopId, stopCache));
  }

  return cache;
}

/**
 * Get all child stops of a parent station
 */
export function getChildStops(db: Database, parentStopId: string): string[] {
  const childStops: string[] = [];

  const stmt = db.prepare('SELECT stop_id FROM stops WHERE parent_station = ?');
  stmt.bind([parentStopId]);

  while (stmt.step()) {
    const row = stmt.getAsObject() as { stop_id: string };
    childStops.push(row.stop_id);
  }
  stmt.free();

  // Also include the parent itself
  childStops.push(parentStopId);

  return childStops;
}

/**
 * Build reverse mapping: parentStopId -> [childStopIds]
 */
export function buildChildStopCache(db: Database): Map<string, string[]> {
  const cache = new Map<string, string[]>();

  const stmt = db.prepare('SELECT stop_id, parent_station FROM stops');
  while (stmt.step()) {
    const row = stmt.getAsObject() as { stop_id: string; parent_station?: string };

    if (row.parent_station) {
      if (!cache.has(row.parent_station)) {
        cache.set(row.parent_station, []);
      }
      cache.get(row.parent_station)!.push(row.stop_id);
    }
  }
  stmt.free();

  return cache;
}
