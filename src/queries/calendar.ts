/**
 * Calendar Query Methods
 */

import type { GtfsDatabase, Row } from '../adapters/types';
import type { Calendar, CalendarDate } from '../types/gtfs';

export interface CalendarFilters {
  serviceId?: string | string[];
  limit?: number;
}

export interface CalendarDateFilters {
  serviceId?: string | string[];
  date?: string;
  limit?: number;
}

/**
 * Get active service IDs for a given date
 */
export async function getActiveServiceIds(db: GtfsDatabase, date: string): Promise<string[]> {
  const serviceIds = new Set<string>();

  // Parse date (format: YYYYMMDD)
  const year = parseInt(date.substring(0, 4));
  const month = parseInt(date.substring(4, 6));
  const day = parseInt(date.substring(6, 8));
  const dateObj = new Date(year, month - 1, day);
  const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 1 = Monday, etc.

  // Map day of week to GTFS calendar field
  const dayFields = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayField = dayFields[dayOfWeek];

  // Check calendar.txt for regular service
  const calendarStmt = await db.prepare(
    `SELECT service_id FROM calendar
     WHERE ${dayField} = 1
     AND start_date <= ?
     AND end_date >= ?`
  );
  await calendarStmt.bind([date, date]);

  while (await calendarStmt.step()) {
    const row = await calendarStmt.getAsObject() as { service_id: string };
    serviceIds.add(row.service_id);
  }
  await calendarStmt.free();

  // Check calendar_dates.txt for exceptions
  const exceptionsStmt = await db.prepare('SELECT service_id, exception_type FROM calendar_dates WHERE date = ?');
  await exceptionsStmt.bind([date]);

  while (await exceptionsStmt.step()) {
    const row = await exceptionsStmt.getAsObject() as { service_id: string; exception_type: number };
    if (row.exception_type === 1) {
      // Service added
      serviceIds.add(row.service_id);
    } else if (row.exception_type === 2) {
      // Service removed
      serviceIds.delete(row.service_id);
    }
  }
  await exceptionsStmt.free();

  return Array.from(serviceIds);
}

/**
 * Get calendar entries with optional filters
 * - Filters support both single values and arrays
 */
export async function getCalendars(db: GtfsDatabase, filters: CalendarFilters = {}): Promise<Calendar[]> {
  const { serviceId, limit } = filters;

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (serviceId) {
    const serviceIds = Array.isArray(serviceId) ? serviceId : [serviceId];
    if (serviceIds.length > 0) {
      const placeholders = serviceIds.map(() => '?').join(', ');
      conditions.push(`service_id IN (${placeholders})`);
      params.push(...serviceIds);
    }
  }

  let sql = 'SELECT * FROM calendar';
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY service_id';
  if (limit) {
    sql += ' LIMIT ?';
    params.push(limit);
  }

  const stmt = await db.prepare(sql);
  if (params.length > 0) {
    await stmt.bind(params);
  }

  const calendars: Calendar[] = [];
  while (await stmt.step()) {
    const row = await stmt.getAsObject();
    calendars.push(rowToCalendar(row));
  }

  await stmt.free();
  return calendars;
}

/**
 * Get calendar entry by service_id
 */
export async function getCalendarByServiceId(db: GtfsDatabase, serviceId: string): Promise<Calendar | null> {
  const stmt = await db.prepare('SELECT * FROM calendar WHERE service_id = ?');
  await stmt.bind([serviceId]);

  if (await stmt.step()) {
    const row = await stmt.getAsObject();
    await stmt.free();
    return rowToCalendar(row);
  }

  await stmt.free();
  return null;
}

/**
 * Get calendar date exceptions with optional filters
 * - Filters support both single values and arrays
 */
export async function getCalendarDates(db: GtfsDatabase, filters: CalendarDateFilters = {}): Promise<CalendarDate[]> {
  const { serviceId, date, limit } = filters;

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (serviceId) {
    const serviceIds = Array.isArray(serviceId) ? serviceId : [serviceId];
    if (serviceIds.length > 0) {
      const placeholders = serviceIds.map(() => '?').join(', ');
      conditions.push(`service_id IN (${placeholders})`);
      params.push(...serviceIds);
    }
  }

  if (date) {
    conditions.push('date = ?');
    params.push(date);
  }

  let sql = 'SELECT * FROM calendar_dates';
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY service_id, date';
  if (limit) {
    sql += ' LIMIT ?';
    params.push(limit);
  }

  const stmt = await db.prepare(sql);
  if (params.length > 0) {
    await stmt.bind(params);
  }

  const dates: CalendarDate[] = [];
  while (await stmt.step()) {
    const row = await stmt.getAsObject();
    dates.push(rowToCalendarDate(row));
  }

  await stmt.free();
  return dates;
}

/**
 * Get calendar date exceptions for a specific date
 */
export async function getCalendarDatesForDate(db: GtfsDatabase, date: string): Promise<CalendarDate[]> {
  return getCalendarDates(db, { date });
}

/**
 * Convert database row to Calendar object
 */
function rowToCalendar(row: Row): Calendar {
  return {
    service_id: String(row.service_id),
    monday: Number(row.monday),
    tuesday: Number(row.tuesday),
    wednesday: Number(row.wednesday),
    thursday: Number(row.thursday),
    friday: Number(row.friday),
    saturday: Number(row.saturday),
    sunday: Number(row.sunday),
    start_date: String(row.start_date),
    end_date: String(row.end_date),
  };
}

/**
 * Convert database row to CalendarDate object
 */
function rowToCalendarDate(row: Row): CalendarDate {
  return {
    service_id: String(row.service_id),
    date: String(row.date),
    exception_type: Number(row.exception_type),
  };
}
