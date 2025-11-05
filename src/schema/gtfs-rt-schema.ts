import type { Database } from 'sql.js';

/**
 * Create GTFS Realtime tables in the database
 */
export function createRealtimeTables(db: Database): void {
  // Alerts table
  db.run(`
    CREATE TABLE IF NOT EXISTS rt_alerts (
      id TEXT PRIMARY KEY,
      active_period TEXT,           -- JSON array of TimeRange objects
      informed_entity TEXT,          -- JSON array of EntitySelector objects
      cause INTEGER,
      effect INTEGER,
      url TEXT,                      -- JSON TranslatedString
      header_text TEXT,              -- JSON TranslatedString
      description_text TEXT,         -- JSON TranslatedString
      rt_last_updated INTEGER NOT NULL
    )
  `);

  // Create index on rt_last_updated for staleness filtering
  db.run('CREATE INDEX IF NOT EXISTS idx_rt_alerts_updated ON rt_alerts(rt_last_updated)');

  // Vehicle Positions table
  db.run(`
    CREATE TABLE IF NOT EXISTS rt_vehicle_positions (
      trip_id TEXT PRIMARY KEY,
      route_id TEXT,
      vehicle_id TEXT,
      vehicle_label TEXT,
      vehicle_license_plate TEXT,
      latitude REAL,
      longitude REAL,
      bearing REAL,
      odometer REAL,
      speed REAL,
      current_stop_sequence INTEGER,
      stop_id TEXT,
      current_status INTEGER,
      timestamp INTEGER,
      congestion_level INTEGER,
      occupancy_status INTEGER,
      rt_last_updated INTEGER NOT NULL
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_rt_vehicle_positions_updated ON rt_vehicle_positions(rt_last_updated)');
  db.run('CREATE INDEX IF NOT EXISTS idx_rt_vehicle_positions_route ON rt_vehicle_positions(route_id)');

  // Trip Updates table
  db.run(`
    CREATE TABLE IF NOT EXISTS rt_trip_updates (
      trip_id TEXT PRIMARY KEY,
      route_id TEXT,
      vehicle_id TEXT,
      vehicle_label TEXT,
      vehicle_license_plate TEXT,
      timestamp INTEGER,
      delay INTEGER,
      schedule_relationship INTEGER,
      rt_last_updated INTEGER NOT NULL
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_rt_trip_updates_updated ON rt_trip_updates(rt_last_updated)');
  db.run('CREATE INDEX IF NOT EXISTS idx_rt_trip_updates_route ON rt_trip_updates(route_id)');

  // Stop Time Updates table (child of trip updates)
  db.run(`
    CREATE TABLE IF NOT EXISTS rt_stop_time_updates (
      trip_id TEXT NOT NULL,
      stop_sequence INTEGER,
      stop_id TEXT,
      arrival_delay INTEGER,
      arrival_time INTEGER,
      arrival_uncertainty INTEGER,
      departure_delay INTEGER,
      departure_time INTEGER,
      departure_uncertainty INTEGER,
      schedule_relationship INTEGER,
      rt_last_updated INTEGER NOT NULL,
      PRIMARY KEY (trip_id, stop_sequence),
      FOREIGN KEY (trip_id) REFERENCES rt_trip_updates(trip_id) ON DELETE CASCADE
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_rt_stop_time_updates_updated ON rt_stop_time_updates(rt_last_updated)');
  db.run('CREATE INDEX IF NOT EXISTS idx_rt_stop_time_updates_stop ON rt_stop_time_updates(stop_id)');
}

/**
 * Clear all realtime data from the database
 */
export function clearRealtimeData(db: Database): void {
  db.run('DELETE FROM rt_alerts');
  db.run('DELETE FROM rt_vehicle_positions');
  db.run('DELETE FROM rt_trip_updates');
  db.run('DELETE FROM rt_stop_time_updates');
}
