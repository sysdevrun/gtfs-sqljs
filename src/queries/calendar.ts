/**
 * Calendar Query Methods
 */

import type { Database } from 'sql.js';
import type { Calendar, CalendarDate } from '../types/gtfs';

/**
 * Get active service IDs for a given date
 */
export function getActiveServiceIds(db: Database, date: string): string[] {
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
  const calendarStmt = db.prepare(
    `SELECT service_id FROM calendar
     WHERE ${dayField} = 1
     AND start_date <= ?
     AND end_date >= ?`
  );
  calendarStmt.bind([date, date]);

  while (calendarStmt.step()) {
    const row = calendarStmt.getAsObject() as { service_id: string };
    serviceIds.add(row.service_id);
  }
  calendarStmt.free();

  // Check calendar_dates.txt for exceptions
  const exceptionsStmt = db.prepare('SELECT service_id, exception_type FROM calendar_dates WHERE date = ?');
  exceptionsStmt.bind([date]);

  while (exceptionsStmt.step()) {
    const row = exceptionsStmt.getAsObject() as { service_id: string; exception_type: number };
    if (row.exception_type === 1) {
      // Service added
      serviceIds.add(row.service_id);
    } else if (row.exception_type === 2) {
      // Service removed
      serviceIds.delete(row.service_id);
    }
  }
  exceptionsStmt.free();

  return Array.from(serviceIds);
}

/**
 * Get calendar entry by service_id
 */
export function getCalendarByServiceId(db: Database, serviceId: string): Calendar | null {
  const stmt = db.prepare('SELECT * FROM calendar WHERE service_id = ?');
  stmt.bind([serviceId]);

  if (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    stmt.free();
    return rowToCalendar(row);
  }

  stmt.free();
  return null;
}

/**
 * Get calendar date exceptions for a service
 */
export function getCalendarDates(db: Database, serviceId: string): CalendarDate[] {
  const stmt = db.prepare('SELECT * FROM calendar_dates WHERE service_id = ? ORDER BY date');
  stmt.bind([serviceId]);

  const dates: CalendarDate[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    dates.push(rowToCalendarDate(row));
  }

  stmt.free();
  return dates;
}

/**
 * Get calendar date exceptions for a specific date
 */
export function getCalendarDatesForDate(db: Database, date: string): CalendarDate[] {
  const stmt = db.prepare('SELECT * FROM calendar_dates WHERE date = ?');
  stmt.bind([date]);

  const dates: CalendarDate[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    dates.push(rowToCalendarDate(row));
  }

  stmt.free();
  return dates;
}

/**
 * Convert database row to Calendar object
 */
function rowToCalendar(row: Record<string, unknown>): Calendar {
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
function rowToCalendarDate(row: Record<string, unknown>): CalendarDate {
  return {
    service_id: String(row.service_id),
    date: String(row.date),
    exception_type: Number(row.exception_type),
  };
}
