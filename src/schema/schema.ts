/**
 * SQLite Schema Definitions for GTFS Data
 * Matches required/optional fields from GTFS specification
 */

export interface TableSchema {
  name: string;
  columns: ColumnDefinition[];
  indexes?: IndexDefinition[];
}

export interface ColumnDefinition {
  name: string;
  type: 'TEXT' | 'INTEGER' | 'REAL';
  required: boolean;
  primaryKey?: boolean;
}

export interface IndexDefinition {
  name: string;
  columns: string[];
  unique?: boolean;
}

export const GTFS_SCHEMA: TableSchema[] = [
  {
    name: 'agency',
    columns: [
      { name: 'agency_id', type: 'TEXT', required: true, primaryKey: true },
      { name: 'agency_name', type: 'TEXT', required: true },
      { name: 'agency_url', type: 'TEXT', required: true },
      { name: 'agency_timezone', type: 'TEXT', required: true },
      { name: 'agency_lang', type: 'TEXT', required: false },
      { name: 'agency_phone', type: 'TEXT', required: false },
      { name: 'agency_fare_url', type: 'TEXT', required: false },
      { name: 'agency_email', type: 'TEXT', required: false },
    ],
  },
  {
    name: 'stops',
    columns: [
      { name: 'stop_id', type: 'TEXT', required: true, primaryKey: true },
      { name: 'stop_name', type: 'TEXT', required: true },
      { name: 'stop_lat', type: 'REAL', required: true },
      { name: 'stop_lon', type: 'REAL', required: true },
      { name: 'stop_code', type: 'TEXT', required: false },
      { name: 'stop_desc', type: 'TEXT', required: false },
      { name: 'zone_id', type: 'TEXT', required: false },
      { name: 'stop_url', type: 'TEXT', required: false },
      { name: 'location_type', type: 'INTEGER', required: false },
      { name: 'parent_station', type: 'TEXT', required: false },
      { name: 'stop_timezone', type: 'TEXT', required: false },
      { name: 'wheelchair_boarding', type: 'INTEGER', required: false },
      { name: 'level_id', type: 'TEXT', required: false },
      { name: 'platform_code', type: 'TEXT', required: false },
    ],
    indexes: [
      { name: 'idx_stops_stop_code', columns: ['stop_code'] },
      { name: 'idx_stops_stop_name', columns: ['stop_name'] },
      { name: 'idx_stops_parent_station', columns: ['parent_station'] },
    ],
  },
  {
    name: 'routes',
    columns: [
      { name: 'route_id', type: 'TEXT', required: true, primaryKey: true },
      { name: 'route_short_name', type: 'TEXT', required: true },
      { name: 'route_long_name', type: 'TEXT', required: true },
      { name: 'route_type', type: 'INTEGER', required: true },
      { name: 'agency_id', type: 'TEXT', required: false },
      { name: 'route_desc', type: 'TEXT', required: false },
      { name: 'route_url', type: 'TEXT', required: false },
      { name: 'route_color', type: 'TEXT', required: false },
      { name: 'route_text_color', type: 'TEXT', required: false },
      { name: 'route_sort_order', type: 'INTEGER', required: false },
      { name: 'continuous_pickup', type: 'INTEGER', required: false },
      { name: 'continuous_drop_off', type: 'INTEGER', required: false },
    ],
    indexes: [
      { name: 'idx_routes_agency_id', columns: ['agency_id'] },
    ],
  },
  {
    name: 'trips',
    columns: [
      { name: 'trip_id', type: 'TEXT', required: true, primaryKey: true },
      { name: 'route_id', type: 'TEXT', required: true },
      { name: 'service_id', type: 'TEXT', required: true },
      { name: 'trip_headsign', type: 'TEXT', required: false },
      { name: 'trip_short_name', type: 'TEXT', required: false },
      { name: 'direction_id', type: 'INTEGER', required: false },
      { name: 'block_id', type: 'TEXT', required: false },
      { name: 'shape_id', type: 'TEXT', required: false },
      { name: 'wheelchair_accessible', type: 'INTEGER', required: false },
      { name: 'bikes_allowed', type: 'INTEGER', required: false },
    ],
    indexes: [
      { name: 'idx_trips_route_id', columns: ['route_id'] },
      { name: 'idx_trips_service_id', columns: ['service_id'] },
      { name: 'idx_trips_route_service', columns: ['route_id', 'service_id'] },
    ],
  },
  {
    name: 'stop_times',
    columns: [
      { name: 'trip_id', type: 'TEXT', required: true },
      { name: 'arrival_time', type: 'TEXT', required: true },
      { name: 'departure_time', type: 'TEXT', required: true },
      { name: 'stop_id', type: 'TEXT', required: true },
      { name: 'stop_sequence', type: 'INTEGER', required: true },
      { name: 'stop_headsign', type: 'TEXT', required: false },
      { name: 'pickup_type', type: 'INTEGER', required: false },
      { name: 'drop_off_type', type: 'INTEGER', required: false },
      { name: 'continuous_pickup', type: 'INTEGER', required: false },
      { name: 'continuous_drop_off', type: 'INTEGER', required: false },
      { name: 'shape_dist_traveled', type: 'REAL', required: false },
      { name: 'timepoint', type: 'INTEGER', required: false },
    ],
    indexes: [
      { name: 'idx_stop_times_trip_id', columns: ['trip_id'] },
      { name: 'idx_stop_times_stop_id', columns: ['stop_id'] },
      { name: 'idx_stop_times_trip_sequence', columns: ['trip_id', 'stop_sequence'] },
    ],
  },
  {
    name: 'calendar',
    columns: [
      { name: 'service_id', type: 'TEXT', required: true, primaryKey: true },
      { name: 'monday', type: 'INTEGER', required: true },
      { name: 'tuesday', type: 'INTEGER', required: true },
      { name: 'wednesday', type: 'INTEGER', required: true },
      { name: 'thursday', type: 'INTEGER', required: true },
      { name: 'friday', type: 'INTEGER', required: true },
      { name: 'saturday', type: 'INTEGER', required: true },
      { name: 'sunday', type: 'INTEGER', required: true },
      { name: 'start_date', type: 'TEXT', required: true },
      { name: 'end_date', type: 'TEXT', required: true },
    ],
  },
  {
    name: 'calendar_dates',
    columns: [
      { name: 'service_id', type: 'TEXT', required: true },
      { name: 'date', type: 'TEXT', required: true },
      { name: 'exception_type', type: 'INTEGER', required: true },
    ],
    indexes: [
      { name: 'idx_calendar_dates_service_id', columns: ['service_id'] },
      { name: 'idx_calendar_dates_date', columns: ['date'] },
      { name: 'idx_calendar_dates_service_date', columns: ['service_id', 'date'] },
    ],
  },
  {
    name: 'fare_attributes',
    columns: [
      { name: 'fare_id', type: 'TEXT', required: true, primaryKey: true },
      { name: 'price', type: 'REAL', required: true },
      { name: 'currency_type', type: 'TEXT', required: true },
      { name: 'payment_method', type: 'INTEGER', required: true },
      { name: 'transfers', type: 'INTEGER', required: true },
      { name: 'agency_id', type: 'TEXT', required: false },
      { name: 'transfer_duration', type: 'INTEGER', required: false },
    ],
  },
  {
    name: 'fare_rules',
    columns: [
      { name: 'fare_id', type: 'TEXT', required: true },
      { name: 'route_id', type: 'TEXT', required: false },
      { name: 'origin_id', type: 'TEXT', required: false },
      { name: 'destination_id', type: 'TEXT', required: false },
      { name: 'contains_id', type: 'TEXT', required: false },
    ],
    indexes: [
      { name: 'idx_fare_rules_fare_id', columns: ['fare_id'] },
      { name: 'idx_fare_rules_route_id', columns: ['route_id'] },
    ],
  },
  {
    name: 'shapes',
    columns: [
      { name: 'shape_id', type: 'TEXT', required: true },
      { name: 'shape_pt_lat', type: 'REAL', required: true },
      { name: 'shape_pt_lon', type: 'REAL', required: true },
      { name: 'shape_pt_sequence', type: 'INTEGER', required: true },
      { name: 'shape_dist_traveled', type: 'REAL', required: false },
    ],
    indexes: [
      { name: 'idx_shapes_shape_id', columns: ['shape_id'] },
      { name: 'idx_shapes_shape_sequence', columns: ['shape_id', 'shape_pt_sequence'] },
    ],
  },
  {
    name: 'frequencies',
    columns: [
      { name: 'trip_id', type: 'TEXT', required: true },
      { name: 'start_time', type: 'TEXT', required: true },
      { name: 'end_time', type: 'TEXT', required: true },
      { name: 'headway_secs', type: 'INTEGER', required: true },
      { name: 'exact_times', type: 'INTEGER', required: false },
    ],
    indexes: [
      { name: 'idx_frequencies_trip_id', columns: ['trip_id'] },
    ],
  },
  {
    name: 'transfers',
    columns: [
      { name: 'from_stop_id', type: 'TEXT', required: true },
      { name: 'to_stop_id', type: 'TEXT', required: true },
      { name: 'transfer_type', type: 'INTEGER', required: true },
      { name: 'min_transfer_time', type: 'INTEGER', required: false },
    ],
    indexes: [
      { name: 'idx_transfers_from_stop_id', columns: ['from_stop_id'] },
      { name: 'idx_transfers_to_stop_id', columns: ['to_stop_id'] },
    ],
  },
  {
    name: 'pathways',
    columns: [
      { name: 'pathway_id', type: 'TEXT', required: true, primaryKey: true },
      { name: 'from_stop_id', type: 'TEXT', required: true },
      { name: 'to_stop_id', type: 'TEXT', required: true },
      { name: 'pathway_mode', type: 'INTEGER', required: true },
      { name: 'is_bidirectional', type: 'INTEGER', required: true },
      { name: 'length', type: 'REAL', required: false },
      { name: 'traversal_time', type: 'INTEGER', required: false },
      { name: 'stair_count', type: 'INTEGER', required: false },
      { name: 'max_slope', type: 'REAL', required: false },
      { name: 'min_width', type: 'REAL', required: false },
      { name: 'signposted_as', type: 'TEXT', required: false },
      { name: 'reversed_signposted_as', type: 'TEXT', required: false },
    ],
  },
  {
    name: 'levels',
    columns: [
      { name: 'level_id', type: 'TEXT', required: true, primaryKey: true },
      { name: 'level_index', type: 'REAL', required: true },
      { name: 'level_name', type: 'TEXT', required: false },
    ],
  },
  {
    name: 'feed_info',
    columns: [
      { name: 'feed_publisher_name', type: 'TEXT', required: true },
      { name: 'feed_publisher_url', type: 'TEXT', required: true },
      { name: 'feed_lang', type: 'TEXT', required: true },
      { name: 'default_lang', type: 'TEXT', required: false },
      { name: 'feed_start_date', type: 'TEXT', required: false },
      { name: 'feed_end_date', type: 'TEXT', required: false },
      { name: 'feed_version', type: 'TEXT', required: false },
      { name: 'feed_contact_email', type: 'TEXT', required: false },
      { name: 'feed_contact_url', type: 'TEXT', required: false },
    ],
  },
  {
    name: 'attributions',
    columns: [
      { name: 'attribution_id', type: 'TEXT', required: true, primaryKey: true },
      { name: 'organization_name', type: 'TEXT', required: true },
      { name: 'agency_id', type: 'TEXT', required: false },
      { name: 'route_id', type: 'TEXT', required: false },
      { name: 'trip_id', type: 'TEXT', required: false },
      { name: 'is_producer', type: 'INTEGER', required: false },
      { name: 'is_operator', type: 'INTEGER', required: false },
      { name: 'is_authority', type: 'INTEGER', required: false },
      { name: 'attribution_url', type: 'TEXT', required: false },
      { name: 'attribution_email', type: 'TEXT', required: false },
      { name: 'attribution_phone', type: 'TEXT', required: false },
    ],
  },
];

/**
 * Generate CREATE TABLE SQL statement from schema definition
 */
export function generateCreateTableSQL(schema: TableSchema): string {
  const columns = schema.columns.map((col) => {
    const parts = [col.name, col.type];
    if (col.primaryKey) {
      parts.push('PRIMARY KEY');
    }
    if (col.required && !col.primaryKey) {
      parts.push('NOT NULL');
    }
    return parts.join(' ');
  });

  return `CREATE TABLE IF NOT EXISTS ${schema.name} (${columns.join(', ')})`;
}

/**
 * Generate CREATE INDEX SQL statements from schema definition
 */
export function generateCreateIndexSQL(schema: TableSchema): string[] {
  if (!schema.indexes) {
    return [];
  }

  return schema.indexes.map((idx) => {
    const unique = idx.unique ? 'UNIQUE ' : '';
    const columns = idx.columns.join(', ');
    return `CREATE ${unique}INDEX IF NOT EXISTS ${idx.name} ON ${schema.name} (${columns})`;
  });
}

/**
 * Get CREATE TABLE statements only (without indexes)
 */
export function getAllCreateTableStatements(): string[] {
  const statements: string[] = [];

  for (const schema of GTFS_SCHEMA) {
    statements.push(generateCreateTableSQL(schema));
  }

  return statements;
}

/**
 * Get CREATE INDEX statements only
 */
export function getAllCreateIndexStatements(): string[] {
  const statements: string[] = [];

  for (const schema of GTFS_SCHEMA) {
    statements.push(...generateCreateIndexSQL(schema));
  }

  return statements;
}

/**
 * Initialize all GTFS tables in the database (tables + indexes)
 * @deprecated Use getAllCreateTableStatements() and getAllCreateIndexStatements() separately for better performance
 */
export function getAllCreateStatements(): string[] {
  const statements: string[] = [];

  for (const schema of GTFS_SCHEMA) {
    statements.push(generateCreateTableSQL(schema));
    statements.push(...generateCreateIndexSQL(schema));
  }

  return statements;
}
