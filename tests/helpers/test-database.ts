/**
 * Helper to create a test database with sample GTFS data
 */

import type { Database, SqlJsStatic } from 'sql.js';
import { getAllCreateStatements } from '../../src/schema/schema';

export async function createTestDatabase(SQL: SqlJsStatic): Promise<ArrayBuffer> {
  const db = new SQL.Database();

  // Create schema
  const createStatements = getAllCreateStatements();
  for (const statement of createStatements) {
    db.run(statement);
  }

  // Insert test data

  // Agency
  db.run(
    'INSERT INTO agency (agency_id, agency_name, agency_url, agency_timezone) VALUES (?, ?, ?, ?)',
    ['AGENCY1', 'Test Transit', 'https://test-transit.example.com', 'America/New_York']
  );

  // Stops
  db.run(
    'INSERT INTO stops (stop_id, stop_code, stop_name, stop_lat, stop_lon) VALUES (?, ?, ?, ?, ?)',
    ['STOP1', 'FS', 'First Street', 40.7128, -74.0060]
  );
  db.run(
    'INSERT INTO stops (stop_id, stop_code, stop_name, stop_lat, stop_lon) VALUES (?, ?, ?, ?, ?)',
    ['STOP2', 'SS', 'Second Street', 40.7138, -74.0070]
  );
  db.run(
    'INSERT INTO stops (stop_id, stop_code, stop_name, stop_lat, stop_lon) VALUES (?, ?, ?, ?, ?)',
    ['STOP3', 'TS', 'Third Street', 40.7148, -74.0080]
  );

  // Routes
  db.run(
    'INSERT INTO routes (route_id, agency_id, route_short_name, route_long_name, route_type) VALUES (?, ?, ?, ?, ?)',
    ['ROUTE1', 'AGENCY1', '1', 'Main Line', 3]
  );
  db.run(
    'INSERT INTO routes (route_id, agency_id, route_short_name, route_long_name, route_type) VALUES (?, ?, ?, ?, ?)',
    ['ROUTE2', 'AGENCY1', '2', 'Express Line', 3]
  );

  // Calendar
  db.run(
    'INSERT INTO calendar (service_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ['WEEKDAY', 1, 1, 1, 1, 1, 0, 0, '20240101', '20241231']
  );
  db.run(
    'INSERT INTO calendar (service_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ['WEEKEND', 0, 0, 0, 0, 0, 1, 1, '20240101', '20241231']
  );

  // Calendar dates (exceptions)
  db.run(
    'INSERT INTO calendar_dates (service_id, date, exception_type) VALUES (?, ?, ?)',
    ['WEEKDAY', '20240704', 2] // July 4th - remove service
  );
  db.run(
    'INSERT INTO calendar_dates (service_id, date, exception_type) VALUES (?, ?, ?)',
    ['WEEKEND', '20240704', 1] // July 4th - add weekend service
  );

  // Trips
  db.run(
    'INSERT INTO trips (trip_id, route_id, service_id, direction_id, trip_headsign) VALUES (?, ?, ?, ?, ?)',
    ['TRIP1', 'ROUTE1', 'WEEKDAY', 0, 'Northbound']
  );
  db.run(
    'INSERT INTO trips (trip_id, route_id, service_id, direction_id, trip_headsign) VALUES (?, ?, ?, ?, ?)',
    ['TRIP2', 'ROUTE1', 'WEEKDAY', 1, 'Southbound']
  );
  db.run(
    'INSERT INTO trips (trip_id, route_id, service_id, direction_id, trip_headsign) VALUES (?, ?, ?, ?, ?)',
    ['TRIP3', 'ROUTE1', 'WEEKEND', 0, 'Northbound']
  );
  db.run(
    'INSERT INTO trips (trip_id, route_id, service_id, direction_id, trip_headsign) VALUES (?, ?, ?, ?, ?)',
    ['TRIP4', 'ROUTE2', 'WEEKDAY', 0, 'Express North']
  );

  // Stop times for TRIP1
  db.run(
    'INSERT INTO stop_times (trip_id, arrival_time, departure_time, stop_id, stop_sequence) VALUES (?, ?, ?, ?, ?)',
    ['TRIP1', '08:00:00', '08:00:00', 'STOP1', 1]
  );
  db.run(
    'INSERT INTO stop_times (trip_id, arrival_time, departure_time, stop_id, stop_sequence) VALUES (?, ?, ?, ?, ?)',
    ['TRIP1', '08:10:00', '08:10:00', 'STOP2', 2]
  );
  db.run(
    'INSERT INTO stop_times (trip_id, arrival_time, departure_time, stop_id, stop_sequence) VALUES (?, ?, ?, ?, ?)',
    ['TRIP1', '08:20:00', '08:20:00', 'STOP3', 3]
  );

  // Stop times for TRIP2
  db.run(
    'INSERT INTO stop_times (trip_id, arrival_time, departure_time, stop_id, stop_sequence) VALUES (?, ?, ?, ?, ?)',
    ['TRIP2', '09:00:00', '09:00:00', 'STOP3', 1]
  );
  db.run(
    'INSERT INTO stop_times (trip_id, arrival_time, departure_time, stop_id, stop_sequence) VALUES (?, ?, ?, ?, ?)',
    ['TRIP2', '09:10:00', '09:10:00', 'STOP2', 2]
  );
  db.run(
    'INSERT INTO stop_times (trip_id, arrival_time, departure_time, stop_id, stop_sequence) VALUES (?, ?, ?, ?, ?)',
    ['TRIP2', '09:20:00', '09:20:00', 'STOP1', 3]
  );

  // Stop times for TRIP3
  db.run(
    'INSERT INTO stop_times (trip_id, arrival_time, departure_time, stop_id, stop_sequence) VALUES (?, ?, ?, ?, ?)',
    ['TRIP3', '10:00:00', '10:00:00', 'STOP1', 1]
  );
  db.run(
    'INSERT INTO stop_times (trip_id, arrival_time, departure_time, stop_id, stop_sequence) VALUES (?, ?, ?, ?, ?)',
    ['TRIP3', '10:15:00', '10:15:00', 'STOP2', 2]
  );
  db.run(
    'INSERT INTO stop_times (trip_id, arrival_time, departure_time, stop_id, stop_sequence) VALUES (?, ?, ?, ?, ?)',
    ['TRIP3', '10:30:00', '10:30:00', 'STOP3', 3]
  );

  // Stop times for TRIP4
  db.run(
    'INSERT INTO stop_times (trip_id, arrival_time, departure_time, stop_id, stop_sequence) VALUES (?, ?, ?, ?, ?)',
    ['TRIP4', '07:00:00', '07:00:00', 'STOP1', 1]
  );
  db.run(
    'INSERT INTO stop_times (trip_id, arrival_time, departure_time, stop_id, stop_sequence) VALUES (?, ?, ?, ?, ?)',
    ['TRIP4', '07:15:00', '07:15:00', 'STOP3', 2]
  );

  // Shapes - SHAPE1 for ROUTE1 (Main Line)
  db.run(
    'INSERT INTO shapes (shape_id, shape_pt_lat, shape_pt_lon, shape_pt_sequence, shape_dist_traveled) VALUES (?, ?, ?, ?, ?)',
    ['SHAPE1', 40.7128, -74.0060, 1, 0.0]
  );
  db.run(
    'INSERT INTO shapes (shape_id, shape_pt_lat, shape_pt_lon, shape_pt_sequence, shape_dist_traveled) VALUES (?, ?, ?, ?, ?)',
    ['SHAPE1', 40.7133, -74.0065, 2, 100.5]
  );
  db.run(
    'INSERT INTO shapes (shape_id, shape_pt_lat, shape_pt_lon, shape_pt_sequence, shape_dist_traveled) VALUES (?, ?, ?, ?, ?)',
    ['SHAPE1', 40.7138, -74.0070, 3, 200.0]
  );
  db.run(
    'INSERT INTO shapes (shape_id, shape_pt_lat, shape_pt_lon, shape_pt_sequence, shape_dist_traveled) VALUES (?, ?, ?, ?, ?)',
    ['SHAPE1', 40.7143, -74.0075, 4, 300.0]
  );
  db.run(
    'INSERT INTO shapes (shape_id, shape_pt_lat, shape_pt_lon, shape_pt_sequence, shape_dist_traveled) VALUES (?, ?, ?, ?, ?)',
    ['SHAPE1', 40.7148, -74.0080, 5, 400.0]
  );

  // Shapes - SHAPE2 for ROUTE2 (Express Line)
  db.run(
    'INSERT INTO shapes (shape_id, shape_pt_lat, shape_pt_lon, shape_pt_sequence) VALUES (?, ?, ?, ?)',
    ['SHAPE2', 40.7128, -74.0060, 1]
  );
  db.run(
    'INSERT INTO shapes (shape_id, shape_pt_lat, shape_pt_lon, shape_pt_sequence) VALUES (?, ?, ?, ?)',
    ['SHAPE2', 40.7148, -74.0080, 2]
  );

  // Update trips to reference shapes
  db.run('UPDATE trips SET shape_id = ? WHERE trip_id IN (?, ?)', ['SHAPE1', 'TRIP1', 'TRIP2']);
  db.run('UPDATE trips SET shape_id = ? WHERE trip_id = ?', ['SHAPE1', 'TRIP3']);
  db.run('UPDATE trips SET shape_id = ? WHERE trip_id = ?', ['SHAPE2', 'TRIP4']);

  // Export database
  const data = db.export();
  db.close();

  return data.buffer;
}
