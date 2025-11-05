import type { Database } from 'sql.js';
import type { Alert, EntitySelector, TimeRange, TranslatedString } from '../types/gtfs-rt';
import type { AlertFilters } from '../types/gtfs-rt';

export type { AlertFilters };

/**
 * Parse JSON fields from database
 */
function parseAlert(row: Record<string, unknown>): Alert {
  return {
    id: String(row.id),
    active_period: row.active_period ? JSON.parse(String(row.active_period)) as TimeRange[] : [],
    informed_entity: row.informed_entity ? JSON.parse(String(row.informed_entity)) as EntitySelector[] : [],
    cause: row.cause ? Number(row.cause) : undefined,
    effect: row.effect ? Number(row.effect) : undefined,
    url: row.url ? JSON.parse(String(row.url)) as TranslatedString : undefined,
    header_text: row.header_text ? JSON.parse(String(row.header_text)) as TranslatedString : undefined,
    description_text: row.description_text ? JSON.parse(String(row.description_text)) as TranslatedString : undefined,
    rt_last_updated: Number(row.rt_last_updated)
  };
}

/**
 * Check if an alert is currently active based on its active_period
 */
function isAlertActive(alert: Alert, now: number): boolean {
  // If no active periods defined, assume always active
  if (!alert.active_period || alert.active_period.length === 0) {
    return true;
  }

  // Check if current time falls within any active period
  for (const period of alert.active_period) {
    const start = period.start || 0;
    const end = period.end || Number.MAX_SAFE_INTEGER;

    if (now >= start && now <= end) {
      return true;
    }
  }

  return false;
}

/**
 * Check if an alert affects the specified entity
 */
function alertAffectsEntity(alert: Alert, filters: AlertFilters): boolean {
  if (!alert.informed_entity || alert.informed_entity.length === 0) {
    return true; // No specific entities, assume it affects all
  }

  for (const entity of alert.informed_entity) {
    // Check route_id
    if (filters.routeId && entity.route_id === filters.routeId) {
      return true;
    }

    // Check stop_id
    if (filters.stopId && entity.stop_id === filters.stopId) {
      return true;
    }

    // Check trip_id
    if (filters.tripId && entity.trip?.trip_id === filters.tripId) {
      return true;
    }
  }

  return false;
}

/**
 * Get alerts with optional filters
 */
export function getAlerts(db: Database, filters: AlertFilters = {}, stalenessThreshold: number = 120): Alert[] {
  const {
    alertId,
    activeOnly,
    routeId,
    stopId,
    tripId,
    cause,
    effect,
    limit
  } = filters;

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  // Filter by alert ID
  if (alertId) {
    conditions.push('id = ?');
    params.push(alertId);
  }

  // Filter by cause
  if (cause !== undefined) {
    conditions.push('cause = ?');
    params.push(cause);
  }

  // Filter by effect
  if (effect !== undefined) {
    conditions.push('effect = ?');
    params.push(effect);
  }

  // Staleness filter (always applied)
  const now = Math.floor(Date.now() / 1000);
  const staleThreshold = now - stalenessThreshold;
  conditions.push('rt_last_updated >= ?');
  params.push(staleThreshold);

  // Build query
  let sql = 'SELECT * FROM rt_alerts';
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY rt_last_updated DESC';

  if (limit) {
    sql += ' LIMIT ?';
    params.push(limit);
  }

  // Execute query
  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }

  const alerts: Alert[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    const alert = parseAlert(row);

    // Apply activeOnly filter in application code
    if (activeOnly && !isAlertActive(alert, now)) {
      continue;
    }

    // Apply entity filters in application code (since informed_entity is JSON)
    if (routeId || stopId || tripId) {
      if (!alertAffectsEntity(alert, filters)) {
        continue;
      }
    }

    alerts.push(alert);
  }

  stmt.free();
  return alerts;
}

/**
 * Get alert by ID
 */
export function getAlertById(db: Database, alertId: string, stalenessThreshold: number = 120): Alert | null {
  const alerts = getAlerts(db, { alertId, limit: 1 }, stalenessThreshold);
  return alerts.length > 0 ? alerts[0] : null;
}
