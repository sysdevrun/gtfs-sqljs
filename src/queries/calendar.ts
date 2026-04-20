/**
 * Calendar Query Methods
 */

import type { GtfsDatabase, Row } from '../adapters/types';
import type { Calendar, CalendarDate } from '../types/gtfs';

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
 * Get calendar date exceptions for a service
 */
export async function getCalendarDates(db: GtfsDatabase, serviceId: string): Promise<CalendarDate[]> {
  const stmt = await db.prepare('SELECT * FROM calendar_dates WHERE service_id = ? ORDER BY date');
  await stmt.bind([serviceId]);

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
  const stmt = await db.prepare('SELECT * FROM calendar_dates WHERE date = ?');
  await stmt.bind([date]);

  const dates: CalendarDate[] = [];
  while (await stmt.step()) {
    const row = await stmt.getAsObject();
    dates.push(rowToCalendarDate(row));
  }

  await stmt.free();
  return dates;
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
