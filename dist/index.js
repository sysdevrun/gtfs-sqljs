"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  AlertCause: () => AlertCause,
  AlertEffect: () => AlertEffect,
  CongestionLevel: () => CongestionLevel,
  GTFS_SCHEMA: () => GTFS_SCHEMA,
  GtfsSqlJs: () => GtfsSqlJs,
  OccupancyStatus: () => OccupancyStatus,
  ScheduleRelationship: () => ScheduleRelationship,
  VehicleStopStatus: () => VehicleStopStatus
});
module.exports = __toCommonJS(index_exports);

// src/gtfs-sqljs.ts
var import_sql = __toESM(require("sql.js"));

// src/schema/schema.ts
var GTFS_SCHEMA = [
  {
    name: "agency",
    columns: [
      { name: "agency_id", type: "TEXT", required: true, primaryKey: true },
      { name: "agency_name", type: "TEXT", required: true },
      { name: "agency_url", type: "TEXT", required: true },
      { name: "agency_timezone", type: "TEXT", required: true },
      { name: "agency_lang", type: "TEXT", required: false },
      { name: "agency_phone", type: "TEXT", required: false },
      { name: "agency_fare_url", type: "TEXT", required: false },
      { name: "agency_email", type: "TEXT", required: false }
    ]
  },
  {
    name: "stops",
    columns: [
      { name: "stop_id", type: "TEXT", required: true, primaryKey: true },
      { name: "stop_name", type: "TEXT", required: true },
      { name: "stop_lat", type: "REAL", required: true },
      { name: "stop_lon", type: "REAL", required: true },
      { name: "stop_code", type: "TEXT", required: false },
      { name: "stop_desc", type: "TEXT", required: false },
      { name: "zone_id", type: "TEXT", required: false },
      { name: "stop_url", type: "TEXT", required: false },
      { name: "location_type", type: "INTEGER", required: false },
      { name: "parent_station", type: "TEXT", required: false },
      { name: "stop_timezone", type: "TEXT", required: false },
      { name: "wheelchair_boarding", type: "INTEGER", required: false },
      { name: "level_id", type: "TEXT", required: false },
      { name: "platform_code", type: "TEXT", required: false }
    ],
    indexes: [
      { name: "idx_stops_stop_code", columns: ["stop_code"] },
      { name: "idx_stops_stop_name", columns: ["stop_name"] },
      { name: "idx_stops_parent_station", columns: ["parent_station"] }
    ]
  },
  {
    name: "routes",
    columns: [
      { name: "route_id", type: "TEXT", required: true, primaryKey: true },
      { name: "route_short_name", type: "TEXT", required: true },
      { name: "route_long_name", type: "TEXT", required: true },
      { name: "route_type", type: "INTEGER", required: true },
      { name: "agency_id", type: "TEXT", required: false },
      { name: "route_desc", type: "TEXT", required: false },
      { name: "route_url", type: "TEXT", required: false },
      { name: "route_color", type: "TEXT", required: false },
      { name: "route_text_color", type: "TEXT", required: false },
      { name: "route_sort_order", type: "INTEGER", required: false },
      { name: "continuous_pickup", type: "INTEGER", required: false },
      { name: "continuous_drop_off", type: "INTEGER", required: false }
    ],
    indexes: [
      { name: "idx_routes_agency_id", columns: ["agency_id"] }
    ]
  },
  {
    name: "trips",
    columns: [
      { name: "trip_id", type: "TEXT", required: true, primaryKey: true },
      { name: "route_id", type: "TEXT", required: true },
      { name: "service_id", type: "TEXT", required: true },
      { name: "trip_headsign", type: "TEXT", required: false },
      { name: "trip_short_name", type: "TEXT", required: false },
      { name: "direction_id", type: "INTEGER", required: false },
      { name: "block_id", type: "TEXT", required: false },
      { name: "shape_id", type: "TEXT", required: false },
      { name: "wheelchair_accessible", type: "INTEGER", required: false },
      { name: "bikes_allowed", type: "INTEGER", required: false }
    ],
    indexes: [
      { name: "idx_trips_route_id", columns: ["route_id"] },
      { name: "idx_trips_service_id", columns: ["service_id"] },
      { name: "idx_trips_route_service", columns: ["route_id", "service_id"] }
    ]
  },
  {
    name: "stop_times",
    columns: [
      { name: "trip_id", type: "TEXT", required: true },
      { name: "arrival_time", type: "TEXT", required: true },
      { name: "departure_time", type: "TEXT", required: true },
      { name: "stop_id", type: "TEXT", required: true },
      { name: "stop_sequence", type: "INTEGER", required: true },
      { name: "stop_headsign", type: "TEXT", required: false },
      { name: "pickup_type", type: "INTEGER", required: false },
      { name: "drop_off_type", type: "INTEGER", required: false },
      { name: "continuous_pickup", type: "INTEGER", required: false },
      { name: "continuous_drop_off", type: "INTEGER", required: false },
      { name: "shape_dist_traveled", type: "REAL", required: false },
      { name: "timepoint", type: "INTEGER", required: false }
    ],
    indexes: [
      { name: "idx_stop_times_trip_id", columns: ["trip_id"] },
      { name: "idx_stop_times_stop_id", columns: ["stop_id"] },
      { name: "idx_stop_times_trip_sequence", columns: ["trip_id", "stop_sequence"] }
    ]
  },
  {
    name: "calendar",
    columns: [
      { name: "service_id", type: "TEXT", required: true, primaryKey: true },
      { name: "monday", type: "INTEGER", required: true },
      { name: "tuesday", type: "INTEGER", required: true },
      { name: "wednesday", type: "INTEGER", required: true },
      { name: "thursday", type: "INTEGER", required: true },
      { name: "friday", type: "INTEGER", required: true },
      { name: "saturday", type: "INTEGER", required: true },
      { name: "sunday", type: "INTEGER", required: true },
      { name: "start_date", type: "TEXT", required: true },
      { name: "end_date", type: "TEXT", required: true }
    ]
  },
  {
    name: "calendar_dates",
    columns: [
      { name: "service_id", type: "TEXT", required: true },
      { name: "date", type: "TEXT", required: true },
      { name: "exception_type", type: "INTEGER", required: true }
    ],
    indexes: [
      { name: "idx_calendar_dates_service_id", columns: ["service_id"] },
      { name: "idx_calendar_dates_date", columns: ["date"] },
      { name: "idx_calendar_dates_service_date", columns: ["service_id", "date"] }
    ]
  },
  {
    name: "fare_attributes",
    columns: [
      { name: "fare_id", type: "TEXT", required: true, primaryKey: true },
      { name: "price", type: "REAL", required: true },
      { name: "currency_type", type: "TEXT", required: true },
      { name: "payment_method", type: "INTEGER", required: true },
      { name: "transfers", type: "INTEGER", required: true },
      { name: "agency_id", type: "TEXT", required: false },
      { name: "transfer_duration", type: "INTEGER", required: false }
    ]
  },
  {
    name: "fare_rules",
    columns: [
      { name: "fare_id", type: "TEXT", required: true },
      { name: "route_id", type: "TEXT", required: false },
      { name: "origin_id", type: "TEXT", required: false },
      { name: "destination_id", type: "TEXT", required: false },
      { name: "contains_id", type: "TEXT", required: false }
    ],
    indexes: [
      { name: "idx_fare_rules_fare_id", columns: ["fare_id"] },
      { name: "idx_fare_rules_route_id", columns: ["route_id"] }
    ]
  },
  {
    name: "shapes",
    columns: [
      { name: "shape_id", type: "TEXT", required: true },
      { name: "shape_pt_lat", type: "REAL", required: true },
      { name: "shape_pt_lon", type: "REAL", required: true },
      { name: "shape_pt_sequence", type: "INTEGER", required: true },
      { name: "shape_dist_traveled", type: "REAL", required: false }
    ],
    indexes: [
      { name: "idx_shapes_shape_id", columns: ["shape_id"] },
      { name: "idx_shapes_shape_sequence", columns: ["shape_id", "shape_pt_sequence"] }
    ]
  },
  {
    name: "frequencies",
    columns: [
      { name: "trip_id", type: "TEXT", required: true },
      { name: "start_time", type: "TEXT", required: true },
      { name: "end_time", type: "TEXT", required: true },
      { name: "headway_secs", type: "INTEGER", required: true },
      { name: "exact_times", type: "INTEGER", required: false }
    ],
    indexes: [
      { name: "idx_frequencies_trip_id", columns: ["trip_id"] }
    ]
  },
  {
    name: "transfers",
    columns: [
      { name: "from_stop_id", type: "TEXT", required: true },
      { name: "to_stop_id", type: "TEXT", required: true },
      { name: "transfer_type", type: "INTEGER", required: true },
      { name: "min_transfer_time", type: "INTEGER", required: false }
    ],
    indexes: [
      { name: "idx_transfers_from_stop_id", columns: ["from_stop_id"] },
      { name: "idx_transfers_to_stop_id", columns: ["to_stop_id"] }
    ]
  },
  {
    name: "pathways",
    columns: [
      { name: "pathway_id", type: "TEXT", required: true, primaryKey: true },
      { name: "from_stop_id", type: "TEXT", required: true },
      { name: "to_stop_id", type: "TEXT", required: true },
      { name: "pathway_mode", type: "INTEGER", required: true },
      { name: "is_bidirectional", type: "INTEGER", required: true },
      { name: "length", type: "REAL", required: false },
      { name: "traversal_time", type: "INTEGER", required: false },
      { name: "stair_count", type: "INTEGER", required: false },
      { name: "max_slope", type: "REAL", required: false },
      { name: "min_width", type: "REAL", required: false },
      { name: "signposted_as", type: "TEXT", required: false },
      { name: "reversed_signposted_as", type: "TEXT", required: false }
    ]
  },
  {
    name: "levels",
    columns: [
      { name: "level_id", type: "TEXT", required: true, primaryKey: true },
      { name: "level_index", type: "REAL", required: true },
      { name: "level_name", type: "TEXT", required: false }
    ]
  },
  {
    name: "feed_info",
    columns: [
      { name: "feed_publisher_name", type: "TEXT", required: true },
      { name: "feed_publisher_url", type: "TEXT", required: true },
      { name: "feed_lang", type: "TEXT", required: true },
      { name: "default_lang", type: "TEXT", required: false },
      { name: "feed_start_date", type: "TEXT", required: false },
      { name: "feed_end_date", type: "TEXT", required: false },
      { name: "feed_version", type: "TEXT", required: false },
      { name: "feed_contact_email", type: "TEXT", required: false },
      { name: "feed_contact_url", type: "TEXT", required: false }
    ]
  },
  {
    name: "attributions",
    columns: [
      { name: "attribution_id", type: "TEXT", required: true, primaryKey: true },
      { name: "organization_name", type: "TEXT", required: true },
      { name: "agency_id", type: "TEXT", required: false },
      { name: "route_id", type: "TEXT", required: false },
      { name: "trip_id", type: "TEXT", required: false },
      { name: "is_producer", type: "INTEGER", required: false },
      { name: "is_operator", type: "INTEGER", required: false },
      { name: "is_authority", type: "INTEGER", required: false },
      { name: "attribution_url", type: "TEXT", required: false },
      { name: "attribution_email", type: "TEXT", required: false },
      { name: "attribution_phone", type: "TEXT", required: false }
    ]
  }
];
function generateCreateTableSQL(schema) {
  const columns = schema.columns.map((col) => {
    const parts = [col.name, col.type];
    if (col.primaryKey) {
      parts.push("PRIMARY KEY");
    }
    if (col.required && !col.primaryKey) {
      parts.push("NOT NULL");
    }
    return parts.join(" ");
  });
  return `CREATE TABLE IF NOT EXISTS ${schema.name} (${columns.join(", ")})`;
}
function generateCreateIndexSQL(schema) {
  if (!schema.indexes) {
    return [];
  }
  return schema.indexes.map((idx) => {
    const unique = idx.unique ? "UNIQUE " : "";
    const columns = idx.columns.join(", ");
    return `CREATE ${unique}INDEX IF NOT EXISTS ${idx.name} ON ${schema.name} (${columns})`;
  });
}
function getAllCreateStatements() {
  const statements = [];
  for (const schema of GTFS_SCHEMA) {
    statements.push(generateCreateTableSQL(schema));
    statements.push(...generateCreateIndexSQL(schema));
  }
  return statements;
}

// src/loaders/zip-loader.ts
var import_jszip = __toESM(require("jszip"));
async function loadGTFSZip(source) {
  let zipData;
  if (typeof source === "string") {
    zipData = await fetchZip(source);
  } else {
    zipData = source;
  }
  const zip = await import_jszip.default.loadAsync(zipData);
  const files = {};
  const filePromises = [];
  zip.forEach((relativePath, file) => {
    if (!file.dir && relativePath.endsWith(".txt")) {
      const fileName = relativePath.split("/").pop() || relativePath;
      filePromises.push(
        file.async("string").then((content) => {
          files[fileName] = content;
        })
      );
    }
  });
  await Promise.all(filePromises);
  return files;
}
async function fetchZip(source) {
  const isUrl = source.startsWith("http://") || source.startsWith("https://");
  if (isUrl) {
    if (typeof fetch !== "undefined") {
      const response = await fetch(source);
      if (!response.ok) {
        throw new Error(`Failed to fetch GTFS ZIP: ${response.status} ${response.statusText}`);
      }
      return await response.arrayBuffer();
    }
    throw new Error("fetch is not available to load URL");
  }
  const isNode = typeof process !== "undefined" && process.versions != null && process.versions.node != null;
  if (isNode) {
    try {
      const fs = await import("fs");
      const buffer = await fs.promises.readFile(source);
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    } catch (error) {
      throw new Error(`Failed to read GTFS ZIP file: ${error}`);
    }
  }
  if (typeof fetch !== "undefined") {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Failed to fetch GTFS ZIP: ${response.status} ${response.statusText}`);
    }
    return await response.arrayBuffer();
  }
  throw new Error("No method available to load ZIP file");
}

// src/loaders/csv-parser.ts
var import_papaparse = __toESM(require("papaparse"));
function parseCSV(text) {
  const result = import_papaparse.default.parse(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
    transform: (value) => value.trim()
  });
  if (result.errors.length > 0) {
    console.warn("CSV parsing warnings:", result.errors);
  }
  const headers = result.meta.fields || [];
  const rows = result.data;
  return { headers, rows };
}
function convertRowTypes(row, columnTypes) {
  const result = {};
  for (const [key, type] of Object.entries(columnTypes)) {
    const value = row[key];
    if (value === void 0 || value === null || value === "") {
      result[key] = null;
      continue;
    }
    if (type === "INTEGER") {
      const parsed = parseInt(value, 10);
      result[key] = isNaN(parsed) ? null : parsed;
    } else if (type === "REAL") {
      const parsed = parseFloat(value);
      result[key] = isNaN(parsed) ? null : parsed;
    } else {
      result[key] = value;
    }
  }
  return result;
}

// src/loaders/data-loader.ts
async function loadGTFSData(db, files, skipFiles) {
  const fileToSchema = /* @__PURE__ */ new Map();
  for (const schema of GTFS_SCHEMA) {
    fileToSchema.set(`${schema.name}.txt`, schema);
  }
  const skipSet = new Set(skipFiles?.map((f) => f.toLowerCase()) || []);
  for (const [fileName, content] of Object.entries(files)) {
    const schema = fileToSchema.get(fileName);
    if (!schema) {
      continue;
    }
    if (skipSet.has(fileName.toLowerCase())) {
      console.log(`Skipping import of ${fileName} (table ${schema.name} created but empty)`);
      continue;
    }
    await loadTableData(db, schema, content);
  }
}
async function loadTableData(db, schema, csvContent) {
  const { headers, rows } = parseCSV(csvContent);
  if (rows.length === 0) {
    return;
  }
  const columnTypes = {};
  for (const col of schema.columns) {
    columnTypes[col.name] = col.type;
  }
  const columns = headers.filter((h) => schema.columns.some((c) => c.name === h));
  const placeholders = columns.map(() => "?").join(", ");
  const insertSQL = `INSERT INTO ${schema.name} (${columns.join(", ")}) VALUES (${placeholders})`;
  const stmt = db.prepare(insertSQL);
  for (const row of rows) {
    const typedRow = convertRowTypes(row, columnTypes);
    const values = columns.map((col) => {
      const value = typedRow[col];
      return value === null || value === void 0 ? null : value;
    });
    try {
      stmt.run(values);
    } catch (error) {
      console.error(`Error inserting row into ${schema.name}:`, error);
      console.error("Row data:", row);
      throw error;
    }
  }
  stmt.free();
}

// src/schema/gtfs-rt-schema.ts
function createRealtimeTables(db) {
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
  db.run("CREATE INDEX IF NOT EXISTS idx_rt_alerts_updated ON rt_alerts(rt_last_updated)");
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
  db.run("CREATE INDEX IF NOT EXISTS idx_rt_vehicle_positions_updated ON rt_vehicle_positions(rt_last_updated)");
  db.run("CREATE INDEX IF NOT EXISTS idx_rt_vehicle_positions_route ON rt_vehicle_positions(route_id)");
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
  db.run("CREATE INDEX IF NOT EXISTS idx_rt_trip_updates_updated ON rt_trip_updates(rt_last_updated)");
  db.run("CREATE INDEX IF NOT EXISTS idx_rt_trip_updates_route ON rt_trip_updates(route_id)");
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
  db.run("CREATE INDEX IF NOT EXISTS idx_rt_stop_time_updates_updated ON rt_stop_time_updates(rt_last_updated)");
  db.run("CREATE INDEX IF NOT EXISTS idx_rt_stop_time_updates_stop ON rt_stop_time_updates(stop_id)");
}
function clearRealtimeData(db) {
  db.run("DELETE FROM rt_alerts");
  db.run("DELETE FROM rt_vehicle_positions");
  db.run("DELETE FROM rt_trip_updates");
  db.run("DELETE FROM rt_stop_time_updates");
}

// src/loaders/gtfs-rt-loader.ts
var import_protobufjs = __toESM(require("protobufjs"));
var GTFS_RT_PROTO = `
syntax = "proto2";
option java_package = "com.google.transit.realtime";
package transit_realtime;

message FeedMessage {
  required FeedHeader header = 1;
  repeated FeedEntity entity = 2;
}

message FeedHeader {
  required string gtfs_realtime_version = 1;
  enum Incrementality {
    FULL_DATASET = 0;
    DIFFERENTIAL = 1;
  }
  optional Incrementality incrementality = 2 [default = FULL_DATASET];
  optional uint64 timestamp = 3;
}

message FeedEntity {
  required string id = 1;
  optional bool is_deleted = 2 [default = false];
  optional TripUpdate trip_update = 3;
  optional VehiclePosition vehicle = 4;
  optional Alert alert = 5;
}

message TripUpdate {
  required TripDescriptor trip = 1;
  optional VehicleDescriptor vehicle = 3;
  repeated StopTimeUpdate stop_time_update = 2;
  optional uint64 timestamp = 4;
  optional int32 delay = 5;

  message StopTimeEvent {
    optional int32 delay = 1;
    optional int64 time = 2;
    optional int32 uncertainty = 3;
  }

  message StopTimeUpdate {
    optional uint32 stop_sequence = 1;
    optional string stop_id = 4;
    optional StopTimeEvent arrival = 2;
    optional StopTimeEvent departure = 3;
    enum ScheduleRelationship {
      SCHEDULED = 0;
      SKIPPED = 1;
      NO_DATA = 2;
    }
    optional ScheduleRelationship schedule_relationship = 5 [default = SCHEDULED];
  }
}

message VehiclePosition {
  optional TripDescriptor trip = 1;
  optional VehicleDescriptor vehicle = 8;
  optional Position position = 2;
  optional uint32 current_stop_sequence = 3;
  optional string stop_id = 7;
  enum VehicleStopStatus {
    INCOMING_AT = 0;
    STOPPED_AT = 1;
    IN_TRANSIT_TO = 2;
  }
  optional VehicleStopStatus current_status = 4 [default = IN_TRANSIT_TO];
  optional uint64 timestamp = 5;
  enum CongestionLevel {
    UNKNOWN_CONGESTION_LEVEL = 0;
    RUNNING_SMOOTHLY = 1;
    STOP_AND_GO = 2;
    CONGESTION = 3;
    SEVERE_CONGESTION = 4;
  }
  optional CongestionLevel congestion_level = 6;
  enum OccupancyStatus {
    EMPTY = 0;
    MANY_SEATS_AVAILABLE = 1;
    FEW_SEATS_AVAILABLE = 2;
    STANDING_ROOM_ONLY = 3;
    CRUSHED_STANDING_ROOM_ONLY = 4;
    FULL = 5;
    NOT_ACCEPTING_PASSENGERS = 6;
  }
  optional OccupancyStatus occupancy_status = 9;
}

message Alert {
  repeated TimeRange active_period = 1;
  repeated EntitySelector informed_entity = 5;

  enum Cause {
    UNKNOWN_CAUSE = 1;
    OTHER_CAUSE = 2;
    TECHNICAL_PROBLEM = 3;
    STRIKE = 4;
    DEMONSTRATION = 5;
    ACCIDENT = 6;
    HOLIDAY = 7;
    WEATHER = 8;
    MAINTENANCE = 9;
    CONSTRUCTION = 10;
    POLICE_ACTIVITY = 11;
    MEDICAL_EMERGENCY = 12;
  }
  optional Cause cause = 6 [default = UNKNOWN_CAUSE];

  enum Effect {
    NO_SERVICE = 1;
    REDUCED_SERVICE = 2;
    SIGNIFICANT_DELAYS = 3;
    DETOUR = 4;
    ADDITIONAL_SERVICE = 5;
    MODIFIED_SERVICE = 6;
    OTHER_EFFECT = 7;
    UNKNOWN_EFFECT = 8;
    STOP_MOVED = 9;
    NO_EFFECT = 10;
    ACCESSIBILITY_ISSUE = 11;
  }
  optional Effect effect = 7 [default = UNKNOWN_EFFECT];
  optional TranslatedString url = 8;
  optional TranslatedString header_text = 10;
  optional TranslatedString description_text = 11;
}

message TimeRange {
  optional uint64 start = 1;
  optional uint64 end = 2;
}

message Position {
  required float latitude = 1;
  required float longitude = 2;
  optional float bearing = 3;
  optional double odometer = 4;
  optional float speed = 5;
}

message TripDescriptor {
  optional string trip_id = 1;
  optional string route_id = 5;
  optional uint32 direction_id = 6;
  optional string start_time = 2;
  optional string start_date = 3;
  enum ScheduleRelationship {
    SCHEDULED = 0;
    ADDED = 1;
    UNSCHEDULED = 2;
    CANCELED = 3;
  }
  optional ScheduleRelationship schedule_relationship = 4;
}

message VehicleDescriptor {
  optional string id = 1;
  optional string label = 2;
  optional string license_plate = 3;
}

message EntitySelector {
  optional string agency_id = 1;
  optional string route_id = 2;
  optional int32 route_type = 3;
  optional TripDescriptor trip = 4;
  optional string stop_id = 5;
}

message TranslatedString {
  message Translation {
    required string text = 1;
    optional string language = 2;
  }
  repeated Translation translation = 1;
}
`;
async function fetchProtobuf(source) {
  const isUrl = source.startsWith("http://") || source.startsWith("https://");
  if (isUrl) {
    const response2 = await fetch(source, {
      headers: {
        "Accept": "application/x-protobuf, application/octet-stream"
      }
    });
    if (!response2.ok) {
      throw new Error(`Failed to fetch GTFS-RT feed from ${source}: ${response2.status} ${response2.statusText}`);
    }
    const arrayBuffer2 = await response2.arrayBuffer();
    return new Uint8Array(arrayBuffer2);
  }
  const isNode = typeof process !== "undefined" && process.versions != null && process.versions.node != null;
  if (isNode) {
    try {
      const fs = await import("fs");
      const buffer = await fs.promises.readFile(source);
      return new Uint8Array(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
    } catch (error) {
      throw new Error(`Failed to read GTFS-RT file from ${source}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const response = await fetch(source, {
    headers: {
      "Accept": "application/x-protobuf, application/octet-stream"
    }
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch GTFS-RT feed from ${source}: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}
var gtfsRtRoot = null;
function loadGtfsRtProto() {
  if (!gtfsRtRoot) {
    gtfsRtRoot = import_protobufjs.default.parse(GTFS_RT_PROTO).root;
  }
  return gtfsRtRoot;
}
function camelToSnake(str) {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}
function convertKeysToSnakeCase(obj) {
  if (obj === null || obj === void 0) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(convertKeysToSnakeCase);
  }
  if (typeof obj === "object") {
    const result = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const snakeKey = camelToSnake(key);
        result[snakeKey] = convertKeysToSnakeCase(obj[key]);
      }
    }
    return result;
  }
  return obj;
}
function parseTranslatedString(ts) {
  if (!ts || !ts.translation || ts.translation.length === 0) {
    return null;
  }
  return JSON.stringify({
    translation: ts.translation.map((t) => ({
      text: t.text,
      language: t.language || void 0
    }))
  });
}
function insertAlerts(db, alerts, timestamp) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO rt_alerts (
      id, active_period, informed_entity, cause, effect,
      url, header_text, description_text, rt_last_updated
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const alert of alerts) {
    const activePeriod = alert.activePeriod || alert.active_period || [];
    const informedEntity = alert.informedEntity || alert.informed_entity || [];
    const headerText = alert.headerText || alert.header_text;
    const descriptionText = alert.descriptionText || alert.description_text;
    const activePeriodSnake = convertKeysToSnakeCase(activePeriod);
    const informedEntitySnake = convertKeysToSnakeCase(informedEntity);
    stmt.run([
      alert.id,
      JSON.stringify(activePeriodSnake),
      JSON.stringify(informedEntitySnake),
      alert.cause || null,
      alert.effect || null,
      parseTranslatedString(alert.url),
      parseTranslatedString(headerText),
      parseTranslatedString(descriptionText),
      timestamp
    ]);
  }
  stmt.free();
}
function insertVehiclePositions(db, positions, timestamp) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO rt_vehicle_positions (
      trip_id, route_id, vehicle_id, vehicle_label, vehicle_license_plate,
      latitude, longitude, bearing, odometer, speed,
      current_stop_sequence, stop_id, current_status, timestamp,
      congestion_level, occupancy_status, rt_last_updated
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const vp of positions) {
    const trip = vp.trip;
    if (!trip || !(trip.tripId || trip.trip_id)) continue;
    const tripId = trip.tripId || trip.trip_id;
    const routeId = trip.routeId || trip.route_id;
    const vehicleId = vp.vehicle?.id;
    const vehicleLabel = vp.vehicle?.label;
    const vehicleLicensePlate = vp.vehicle?.licensePlate || vp.vehicle?.license_plate;
    const currentStopSequence = vp.currentStopSequence || vp.current_stop_sequence;
    const stopId = vp.stopId || vp.stop_id;
    const currentStatus = vp.currentStatus || vp.current_status;
    const congestionLevel = vp.congestionLevel || vp.congestion_level;
    const occupancyStatus = vp.occupancyStatus || vp.occupancy_status;
    stmt.run([
      tripId,
      routeId || null,
      vehicleId || null,
      vehicleLabel || null,
      vehicleLicensePlate || null,
      vp.position?.latitude || null,
      vp.position?.longitude || null,
      vp.position?.bearing || null,
      vp.position?.odometer || null,
      vp.position?.speed || null,
      currentStopSequence || null,
      stopId || null,
      currentStatus || null,
      vp.timestamp || null,
      congestionLevel || null,
      occupancyStatus || null,
      timestamp
    ]);
  }
  stmt.free();
}
function insertTripUpdates(db, updates, timestamp) {
  const tripStmt = db.prepare(`
    INSERT OR REPLACE INTO rt_trip_updates (
      trip_id, route_id, vehicle_id, vehicle_label, vehicle_license_plate,
      timestamp, delay, schedule_relationship, rt_last_updated
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const stopTimeStmt = db.prepare(`
    INSERT OR REPLACE INTO rt_stop_time_updates (
      trip_id, stop_sequence, stop_id,
      arrival_delay, arrival_time, arrival_uncertainty,
      departure_delay, departure_time, departure_uncertainty,
      schedule_relationship, rt_last_updated
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const tu of updates) {
    const trip = tu.trip;
    if (!trip || !(trip.tripId || trip.trip_id)) continue;
    const tripId = trip.tripId || trip.trip_id;
    const routeId = trip.routeId || trip.route_id;
    const vehicleId = tu.vehicle?.id;
    const vehicleLabel = tu.vehicle?.label;
    const vehicleLicensePlate = tu.vehicle?.licensePlate || tu.vehicle?.license_plate;
    const scheduleRelationship = trip.scheduleRelationship || trip.schedule_relationship;
    const stopTimeUpdate = tu.stopTimeUpdate || tu.stop_time_update;
    tripStmt.run([
      tripId,
      routeId || null,
      vehicleId || null,
      vehicleLabel || null,
      vehicleLicensePlate || null,
      tu.timestamp || null,
      tu.delay || null,
      scheduleRelationship || null,
      timestamp
    ]);
    if (stopTimeUpdate) {
      for (const stu of stopTimeUpdate) {
        const stopSequence = stu.stopSequence || stu.stop_sequence;
        const stopId = stu.stopId || stu.stop_id;
        const scheduleRel = stu.scheduleRelationship || stu.schedule_relationship;
        stopTimeStmt.run([
          tripId,
          stopSequence || null,
          stopId || null,
          stu.arrival?.delay || null,
          stu.arrival?.time || null,
          stu.arrival?.uncertainty || null,
          stu.departure?.delay || null,
          stu.departure?.time || null,
          stu.departure?.uncertainty || null,
          scheduleRel || null,
          timestamp
        ]);
      }
    }
  }
  tripStmt.free();
  stopTimeStmt.free();
}
async function loadRealtimeData(db, feedUrls) {
  const root = loadGtfsRtProto();
  const FeedMessage = root.lookupType("transit_realtime.FeedMessage");
  const fetchPromises = feedUrls.map(async (url) => {
    try {
      const data = await fetchProtobuf(url);
      const message = FeedMessage.decode(data);
      return FeedMessage.toObject(message, {
        longs: Number,
        enums: Number,
        bytes: String,
        defaults: false,
        arrays: true,
        objects: true,
        oneofs: true
      });
    } catch (error) {
      throw new Error(`Failed to fetch or parse GTFS-RT feed from ${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  const feeds = await Promise.all(fetchPromises);
  const now = Math.floor(Date.now() / 1e3);
  const allAlerts = [];
  const allVehiclePositions = [];
  const allTripUpdates = [];
  for (const feed of feeds) {
    if (!feed.entity) continue;
    for (const entity of feed.entity) {
      if (entity.alert) {
        allAlerts.push({ id: entity.id, ...entity.alert });
      }
      if (entity.vehicle) {
        allVehiclePositions.push(entity.vehicle);
      }
      if (entity.tripUpdate) {
        allTripUpdates.push(entity.tripUpdate);
      }
    }
  }
  if (allAlerts.length > 0) {
    insertAlerts(db, allAlerts, now);
  }
  if (allVehiclePositions.length > 0) {
    insertVehiclePositions(db, allVehiclePositions, now);
  }
  if (allTripUpdates.length > 0) {
    insertTripUpdates(db, allTripUpdates, now);
  }
}

// src/queries/agencies.ts
function getAgencies(db, filters = {}) {
  const { agencyId, limit } = filters;
  const conditions = [];
  const params = [];
  if (agencyId) {
    conditions.push("agency_id = ?");
    params.push(agencyId);
  }
  let sql = "SELECT * FROM agency";
  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }
  sql += " ORDER BY agency_name";
  if (limit) {
    sql += " LIMIT ?";
    params.push(limit);
  }
  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }
  const agencies = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    agencies.push(rowToAgency(row));
  }
  stmt.free();
  return agencies;
}
function getAgencyById(db, agencyId) {
  const stmt = db.prepare("SELECT * FROM agency WHERE agency_id = ?");
  stmt.bind([agencyId]);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return rowToAgency(row);
  }
  stmt.free();
  return null;
}
function rowToAgency(row) {
  return {
    agency_id: String(row.agency_id),
    agency_name: String(row.agency_name),
    agency_url: String(row.agency_url),
    agency_timezone: String(row.agency_timezone),
    agency_lang: row.agency_lang ? String(row.agency_lang) : void 0,
    agency_phone: row.agency_phone ? String(row.agency_phone) : void 0,
    agency_fare_url: row.agency_fare_url ? String(row.agency_fare_url) : void 0,
    agency_email: row.agency_email ? String(row.agency_email) : void 0
  };
}

// src/queries/stops.ts
function getStops(db, filters = {}) {
  const { stopId, stopCode, name, tripId, limit } = filters;
  if (tripId) {
    return getStopsByTrip(db, tripId);
  }
  const conditions = [];
  const params = [];
  if (stopId) {
    conditions.push("stop_id = ?");
    params.push(stopId);
  }
  if (stopCode) {
    conditions.push("stop_code = ?");
    params.push(stopCode);
  }
  if (name) {
    conditions.push("stop_name LIKE ?");
    params.push(`%${name}%`);
  }
  let sql = "SELECT * FROM stops";
  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }
  sql += " ORDER BY stop_name";
  if (limit) {
    sql += " LIMIT ?";
    params.push(limit);
  }
  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }
  const stops = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    stops.push(rowToStop(row));
  }
  stmt.free();
  return stops;
}
function getStopById(db, stopId) {
  const stmt = db.prepare("SELECT * FROM stops WHERE stop_id = ?");
  stmt.bind([stopId]);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return rowToStop(row);
  }
  stmt.free();
  return null;
}
function getStopsByTrip(db, tripId) {
  const stmt = db.prepare(`
    SELECT s.* FROM stops s
    INNER JOIN stop_times st ON s.stop_id = st.stop_id
    WHERE st.trip_id = ?
    ORDER BY st.stop_sequence
  `);
  stmt.bind([tripId]);
  const stops = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    stops.push(rowToStop(row));
  }
  stmt.free();
  return stops;
}
function rowToStop(row) {
  return {
    stop_id: String(row.stop_id),
    stop_name: String(row.stop_name),
    stop_lat: Number(row.stop_lat),
    stop_lon: Number(row.stop_lon),
    stop_code: row.stop_code ? String(row.stop_code) : void 0,
    stop_desc: row.stop_desc ? String(row.stop_desc) : void 0,
    zone_id: row.zone_id ? String(row.zone_id) : void 0,
    stop_url: row.stop_url ? String(row.stop_url) : void 0,
    location_type: row.location_type !== null ? Number(row.location_type) : void 0,
    parent_station: row.parent_station ? String(row.parent_station) : void 0,
    stop_timezone: row.stop_timezone ? String(row.stop_timezone) : void 0,
    wheelchair_boarding: row.wheelchair_boarding !== null ? Number(row.wheelchair_boarding) : void 0,
    level_id: row.level_id ? String(row.level_id) : void 0,
    platform_code: row.platform_code ? String(row.platform_code) : void 0
  };
}

// src/queries/routes.ts
function getRoutes(db, filters = {}) {
  const { routeId, agencyId, limit } = filters;
  const conditions = [];
  const params = [];
  if (routeId) {
    conditions.push("route_id = ?");
    params.push(routeId);
  }
  if (agencyId) {
    conditions.push("agency_id = ?");
    params.push(agencyId);
  }
  let sql = "SELECT * FROM routes";
  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }
  sql += " ORDER BY route_short_name, route_long_name";
  if (limit) {
    sql += " LIMIT ?";
    params.push(limit);
  }
  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }
  const routes = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    routes.push(rowToRoute(row));
  }
  stmt.free();
  return routes;
}
function getRouteById(db, routeId) {
  const stmt = db.prepare("SELECT * FROM routes WHERE route_id = ?");
  stmt.bind([routeId]);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return rowToRoute(row);
  }
  stmt.free();
  return null;
}
function rowToRoute(row) {
  return {
    route_id: String(row.route_id),
    route_short_name: String(row.route_short_name),
    route_long_name: String(row.route_long_name),
    route_type: Number(row.route_type),
    agency_id: row.agency_id ? String(row.agency_id) : void 0,
    route_desc: row.route_desc ? String(row.route_desc) : void 0,
    route_url: row.route_url ? String(row.route_url) : void 0,
    route_color: row.route_color ? String(row.route_color) : void 0,
    route_text_color: row.route_text_color ? String(row.route_text_color) : void 0,
    route_sort_order: row.route_sort_order !== null ? Number(row.route_sort_order) : void 0,
    continuous_pickup: row.continuous_pickup !== null ? Number(row.continuous_pickup) : void 0,
    continuous_drop_off: row.continuous_drop_off !== null ? Number(row.continuous_drop_off) : void 0
  };
}

// src/queries/calendar.ts
function getActiveServiceIds(db, date) {
  const serviceIds = /* @__PURE__ */ new Set();
  const year = parseInt(date.substring(0, 4));
  const month = parseInt(date.substring(4, 6));
  const day = parseInt(date.substring(6, 8));
  const dateObj = new Date(year, month - 1, day);
  const dayOfWeek = dateObj.getDay();
  const dayFields = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const dayField = dayFields[dayOfWeek];
  const calendarStmt = db.prepare(
    `SELECT service_id FROM calendar
     WHERE ${dayField} = 1
     AND start_date <= ?
     AND end_date >= ?`
  );
  calendarStmt.bind([date, date]);
  while (calendarStmt.step()) {
    const row = calendarStmt.getAsObject();
    serviceIds.add(row.service_id);
  }
  calendarStmt.free();
  const exceptionsStmt = db.prepare("SELECT service_id, exception_type FROM calendar_dates WHERE date = ?");
  exceptionsStmt.bind([date]);
  while (exceptionsStmt.step()) {
    const row = exceptionsStmt.getAsObject();
    if (row.exception_type === 1) {
      serviceIds.add(row.service_id);
    } else if (row.exception_type === 2) {
      serviceIds.delete(row.service_id);
    }
  }
  exceptionsStmt.free();
  return Array.from(serviceIds);
}
function getCalendarByServiceId(db, serviceId) {
  const stmt = db.prepare("SELECT * FROM calendar WHERE service_id = ?");
  stmt.bind([serviceId]);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return rowToCalendar(row);
  }
  stmt.free();
  return null;
}
function getCalendarDates(db, serviceId) {
  const stmt = db.prepare("SELECT * FROM calendar_dates WHERE service_id = ? ORDER BY date");
  stmt.bind([serviceId]);
  const dates = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    dates.push(rowToCalendarDate(row));
  }
  stmt.free();
  return dates;
}
function getCalendarDatesForDate(db, date) {
  const stmt = db.prepare("SELECT * FROM calendar_dates WHERE date = ?");
  stmt.bind([date]);
  const dates = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    dates.push(rowToCalendarDate(row));
  }
  stmt.free();
  return dates;
}
function rowToCalendar(row) {
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
    end_date: String(row.end_date)
  };
}
function rowToCalendarDate(row) {
  return {
    service_id: String(row.service_id),
    date: String(row.date),
    exception_type: Number(row.exception_type)
  };
}

// src/queries/rt-vehicle-positions.ts
function parseVehiclePosition(row) {
  const vp = {
    trip_id: String(row.trip_id),
    route_id: row.route_id ? String(row.route_id) : void 0,
    rt_last_updated: Number(row.rt_last_updated)
  };
  if (row.vehicle_id || row.vehicle_label || row.vehicle_license_plate) {
    vp.vehicle = {
      id: row.vehicle_id ? String(row.vehicle_id) : void 0,
      label: row.vehicle_label ? String(row.vehicle_label) : void 0,
      license_plate: row.vehicle_license_plate ? String(row.vehicle_license_plate) : void 0
    };
  }
  if (row.latitude !== null && row.longitude !== null) {
    vp.position = {
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      bearing: row.bearing !== null ? Number(row.bearing) : void 0,
      odometer: row.odometer !== null ? Number(row.odometer) : void 0,
      speed: row.speed !== null ? Number(row.speed) : void 0
    };
  }
  if (row.current_stop_sequence !== null) {
    vp.current_stop_sequence = Number(row.current_stop_sequence);
  }
  if (row.stop_id) {
    vp.stop_id = String(row.stop_id);
  }
  if (row.current_status !== null) {
    vp.current_status = Number(row.current_status);
  }
  if (row.timestamp !== null) {
    vp.timestamp = Number(row.timestamp);
  }
  if (row.congestion_level !== null) {
    vp.congestion_level = Number(row.congestion_level);
  }
  if (row.occupancy_status !== null) {
    vp.occupancy_status = Number(row.occupancy_status);
  }
  return vp;
}
function getVehiclePositions(db, filters = {}, stalenessThreshold = 120) {
  const { tripId, routeId, vehicleId, limit } = filters;
  const conditions = [];
  const params = [];
  if (tripId) {
    conditions.push("trip_id = ?");
    params.push(tripId);
  }
  if (routeId) {
    conditions.push("route_id = ?");
    params.push(routeId);
  }
  if (vehicleId) {
    conditions.push("vehicle_id = ?");
    params.push(vehicleId);
  }
  const now = Math.floor(Date.now() / 1e3);
  const staleThreshold = now - stalenessThreshold;
  conditions.push("rt_last_updated >= ?");
  params.push(staleThreshold);
  let sql = "SELECT * FROM rt_vehicle_positions";
  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }
  sql += " ORDER BY rt_last_updated DESC";
  if (limit) {
    sql += " LIMIT ?";
    params.push(limit);
  }
  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }
  const positions = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    positions.push(parseVehiclePosition(row));
  }
  stmt.free();
  return positions;
}
function getVehiclePositionByTripId(db, tripId, stalenessThreshold = 120) {
  const positions = getVehiclePositions(db, { tripId, limit: 1 }, stalenessThreshold);
  return positions.length > 0 ? positions[0] : null;
}
function getAllVehiclePositions(db) {
  const sql = "SELECT * FROM rt_vehicle_positions ORDER BY rt_last_updated DESC";
  const stmt = db.prepare(sql);
  const positions = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    positions.push(parseVehiclePosition(row));
  }
  stmt.free();
  return positions;
}

// src/queries/trips.ts
function mergeRealtimeData(trips, db, stalenessThreshold) {
  const now = Math.floor(Date.now() / 1e3);
  const staleThreshold = now - stalenessThreshold;
  const tripIds = trips.map((t) => t.trip_id);
  if (tripIds.length === 0) return trips;
  const placeholders = tripIds.map(() => "?").join(", ");
  const vpStmt = db.prepare(`
    SELECT * FROM rt_vehicle_positions
    WHERE trip_id IN (${placeholders})
      AND rt_last_updated >= ?
  `);
  vpStmt.bind([...tripIds, staleThreshold]);
  const vpMap = /* @__PURE__ */ new Map();
  while (vpStmt.step()) {
    const row = vpStmt.getAsObject();
    const vp = parseVehiclePosition(row);
    vpMap.set(vp.trip_id, vp);
  }
  vpStmt.free();
  const tuStmt = db.prepare(`
    SELECT * FROM rt_trip_updates
    WHERE trip_id IN (${placeholders})
      AND rt_last_updated >= ?
  `);
  tuStmt.bind([...tripIds, staleThreshold]);
  const tuMap = /* @__PURE__ */ new Map();
  while (tuStmt.step()) {
    const row = tuStmt.getAsObject();
    const tripId = String(row.trip_id);
    tuMap.set(tripId, {
      delay: row.delay !== null ? Number(row.delay) : void 0,
      schedule_relationship: row.schedule_relationship !== null ? Number(row.schedule_relationship) : void 0
    });
  }
  tuStmt.free();
  return trips.map((trip) => {
    const vp = vpMap.get(trip.trip_id);
    const tu = tuMap.get(trip.trip_id);
    if (!vp && !tu) {
      return { ...trip, realtime: { vehicle_position: null, trip_update: null } };
    }
    return {
      ...trip,
      realtime: {
        vehicle_position: vp || null,
        trip_update: tu || null
      }
    };
  });
}
function getTrips(db, filters = {}, stalenessThreshold = 120) {
  const { tripId, routeId, serviceIds, directionId, agencyId, includeRealtime, limit } = filters;
  const needsRoutesJoin = agencyId !== void 0;
  const conditions = [];
  const params = [];
  if (tripId) {
    conditions.push(needsRoutesJoin ? "t.trip_id = ?" : "trip_id = ?");
    params.push(tripId);
  }
  if (routeId) {
    conditions.push(needsRoutesJoin ? "t.route_id = ?" : "route_id = ?");
    params.push(routeId);
  }
  if (serviceIds && serviceIds.length > 0) {
    const placeholders = serviceIds.map(() => "?").join(", ");
    conditions.push(needsRoutesJoin ? `t.service_id IN (${placeholders})` : `service_id IN (${placeholders})`);
    params.push(...serviceIds);
  }
  if (directionId !== void 0) {
    conditions.push(needsRoutesJoin ? "t.direction_id = ?" : "direction_id = ?");
    params.push(directionId);
  }
  if (agencyId) {
    conditions.push("r.agency_id = ?");
    params.push(agencyId);
  }
  let sql = needsRoutesJoin ? "SELECT t.* FROM trips t INNER JOIN routes r ON t.route_id = r.route_id" : "SELECT * FROM trips";
  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }
  if (limit) {
    sql += " LIMIT ?";
    params.push(limit);
  }
  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }
  const trips = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    trips.push(rowToTrip(row));
  }
  stmt.free();
  if (includeRealtime) {
    return mergeRealtimeData(trips, db, stalenessThreshold);
  }
  return trips;
}
function getTripById(db, tripId) {
  const stmt = db.prepare("SELECT * FROM trips WHERE trip_id = ?");
  stmt.bind([tripId]);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return rowToTrip(row);
  }
  stmt.free();
  return null;
}
function rowToTrip(row) {
  return {
    trip_id: String(row.trip_id),
    route_id: String(row.route_id),
    service_id: String(row.service_id),
    trip_headsign: row.trip_headsign ? String(row.trip_headsign) : void 0,
    trip_short_name: row.trip_short_name ? String(row.trip_short_name) : void 0,
    direction_id: row.direction_id !== null ? Number(row.direction_id) : void 0,
    block_id: row.block_id ? String(row.block_id) : void 0,
    shape_id: row.shape_id ? String(row.shape_id) : void 0,
    wheelchair_accessible: row.wheelchair_accessible !== null ? Number(row.wheelchair_accessible) : void 0,
    bikes_allowed: row.bikes_allowed !== null ? Number(row.bikes_allowed) : void 0
  };
}

// src/queries/stop-times.ts
function mergeRealtimeData2(stopTimes, db, stalenessThreshold) {
  const now = Math.floor(Date.now() / 1e3);
  const staleThreshold = now - stalenessThreshold;
  const tripIds = Array.from(new Set(stopTimes.map((st) => st.trip_id)));
  if (tripIds.length === 0) return stopTimes;
  const placeholders = tripIds.map(() => "?").join(", ");
  const stmt = db.prepare(`
    SELECT trip_id, stop_sequence, stop_id,
           arrival_delay, departure_delay, schedule_relationship
    FROM rt_stop_time_updates
    WHERE trip_id IN (${placeholders})
      AND rt_last_updated >= ?
  `);
  stmt.bind([...tripIds, staleThreshold]);
  const rtMap = /* @__PURE__ */ new Map();
  while (stmt.step()) {
    const row = stmt.getAsObject();
    const key = `${row.trip_id}_${row.stop_sequence}`;
    rtMap.set(key, {
      arrival_delay: row.arrival_delay !== null ? Number(row.arrival_delay) : void 0,
      departure_delay: row.departure_delay !== null ? Number(row.departure_delay) : void 0,
      schedule_relationship: row.schedule_relationship !== null ? Number(row.schedule_relationship) : void 0
    });
  }
  stmt.free();
  return stopTimes.map((st) => {
    const key = `${st.trip_id}_${st.stop_sequence}`;
    const rtData = rtMap.get(key);
    if (rtData) {
      return { ...st, realtime: rtData };
    }
    return st;
  });
}
function getStopTimes(db, filters = {}, stalenessThreshold = 120) {
  const { tripId, stopId, routeId, serviceIds, directionId, agencyId, includeRealtime, limit } = filters;
  const needsTripsJoin = routeId || serviceIds || directionId !== void 0 || agencyId !== void 0;
  const needsRoutesJoin = agencyId !== void 0;
  const conditions = [];
  const params = [];
  if (tripId) {
    conditions.push(needsTripsJoin ? "st.trip_id = ?" : "trip_id = ?");
    params.push(tripId);
  }
  if (stopId) {
    conditions.push(needsTripsJoin ? "st.stop_id = ?" : "stop_id = ?");
    params.push(stopId);
  }
  if (routeId) {
    conditions.push("t.route_id = ?");
    params.push(routeId);
  }
  if (serviceIds && serviceIds.length > 0) {
    const placeholders = serviceIds.map(() => "?").join(", ");
    conditions.push(`t.service_id IN (${placeholders})`);
    params.push(...serviceIds);
  }
  if (directionId !== void 0) {
    conditions.push("t.direction_id = ?");
    params.push(directionId);
  }
  if (agencyId) {
    conditions.push("r.agency_id = ?");
    params.push(agencyId);
  }
  let sql;
  if (needsRoutesJoin) {
    sql = "SELECT st.* FROM stop_times st INNER JOIN trips t ON st.trip_id = t.trip_id INNER JOIN routes r ON t.route_id = r.route_id";
  } else if (needsTripsJoin) {
    sql = "SELECT st.* FROM stop_times st INNER JOIN trips t ON st.trip_id = t.trip_id";
  } else {
    sql = "SELECT * FROM stop_times";
  }
  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }
  sql += tripId ? " ORDER BY stop_sequence" : " ORDER BY arrival_time";
  if (limit) {
    sql += " LIMIT ?";
    params.push(limit);
  }
  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }
  const stopTimes = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    stopTimes.push(rowToStopTime(row));
  }
  stmt.free();
  if (includeRealtime) {
    return mergeRealtimeData2(stopTimes, db, stalenessThreshold);
  }
  return stopTimes;
}
function getStopTimesByTrip(db, tripId) {
  const stmt = db.prepare("SELECT * FROM stop_times WHERE trip_id = ? ORDER BY stop_sequence");
  stmt.bind([tripId]);
  const stopTimes = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    stopTimes.push(rowToStopTime(row));
  }
  stmt.free();
  return stopTimes;
}
function rowToStopTime(row) {
  return {
    trip_id: String(row.trip_id),
    arrival_time: String(row.arrival_time),
    departure_time: String(row.departure_time),
    stop_id: String(row.stop_id),
    stop_sequence: Number(row.stop_sequence),
    stop_headsign: row.stop_headsign ? String(row.stop_headsign) : void 0,
    pickup_type: row.pickup_type !== null ? Number(row.pickup_type) : void 0,
    drop_off_type: row.drop_off_type !== null ? Number(row.drop_off_type) : void 0,
    continuous_pickup: row.continuous_pickup !== null ? Number(row.continuous_pickup) : void 0,
    continuous_drop_off: row.continuous_drop_off !== null ? Number(row.continuous_drop_off) : void 0,
    shape_dist_traveled: row.shape_dist_traveled !== null ? Number(row.shape_dist_traveled) : void 0,
    timepoint: row.timepoint !== null ? Number(row.timepoint) : void 0
  };
}

// src/queries/rt-alerts.ts
function parseAlert(row) {
  return {
    id: String(row.id),
    active_period: row.active_period ? JSON.parse(String(row.active_period)) : [],
    informed_entity: row.informed_entity ? JSON.parse(String(row.informed_entity)) : [],
    cause: row.cause ? Number(row.cause) : void 0,
    effect: row.effect ? Number(row.effect) : void 0,
    url: row.url ? JSON.parse(String(row.url)) : void 0,
    header_text: row.header_text ? JSON.parse(String(row.header_text)) : void 0,
    description_text: row.description_text ? JSON.parse(String(row.description_text)) : void 0,
    rt_last_updated: Number(row.rt_last_updated)
  };
}
function isAlertActive(alert, now) {
  if (!alert.active_period || alert.active_period.length === 0) {
    return true;
  }
  for (const period of alert.active_period) {
    const start = period.start || 0;
    const end = period.end || Number.MAX_SAFE_INTEGER;
    if (now >= start && now <= end) {
      return true;
    }
  }
  return false;
}
function alertAffectsEntity(alert, filters) {
  if (!alert.informed_entity || alert.informed_entity.length === 0) {
    return true;
  }
  for (const entity of alert.informed_entity) {
    if (filters.routeId && entity.route_id === filters.routeId) {
      return true;
    }
    if (filters.stopId && entity.stop_id === filters.stopId) {
      return true;
    }
    if (filters.tripId && entity.trip?.trip_id === filters.tripId) {
      return true;
    }
  }
  return false;
}
function getAlerts(db, filters = {}, stalenessThreshold = 120) {
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
  const conditions = [];
  const params = [];
  if (alertId) {
    conditions.push("id = ?");
    params.push(alertId);
  }
  if (cause !== void 0) {
    conditions.push("cause = ?");
    params.push(cause);
  }
  if (effect !== void 0) {
    conditions.push("effect = ?");
    params.push(effect);
  }
  const now = Math.floor(Date.now() / 1e3);
  const staleThreshold = now - stalenessThreshold;
  conditions.push("rt_last_updated >= ?");
  params.push(staleThreshold);
  let sql = "SELECT * FROM rt_alerts";
  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }
  sql += " ORDER BY rt_last_updated DESC";
  if (limit) {
    sql += " LIMIT ?";
    params.push(limit);
  }
  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }
  const alerts = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    const alert = parseAlert(row);
    if (activeOnly && !isAlertActive(alert, now)) {
      continue;
    }
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
function getAlertById(db, alertId, stalenessThreshold = 120) {
  const alerts = getAlerts(db, { alertId, limit: 1 }, stalenessThreshold);
  return alerts.length > 0 ? alerts[0] : null;
}
function getAllAlerts(db) {
  const sql = "SELECT * FROM rt_alerts ORDER BY rt_last_updated DESC";
  const stmt = db.prepare(sql);
  const alerts = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    alerts.push(parseAlert(row));
  }
  stmt.free();
  return alerts;
}

// src/queries/rt-trip-updates.ts
function parseTripUpdate(row) {
  const tu = {
    trip_id: String(row.trip_id),
    route_id: row.route_id ? String(row.route_id) : void 0,
    stop_time_update: [],
    // Will be populated separately
    timestamp: row.timestamp !== null ? Number(row.timestamp) : void 0,
    delay: row.delay !== null ? Number(row.delay) : void 0,
    schedule_relationship: row.schedule_relationship !== null ? Number(row.schedule_relationship) : void 0,
    rt_last_updated: Number(row.rt_last_updated)
  };
  if (row.vehicle_id || row.vehicle_label || row.vehicle_license_plate) {
    tu.vehicle = {
      id: row.vehicle_id ? String(row.vehicle_id) : void 0,
      label: row.vehicle_label ? String(row.vehicle_label) : void 0,
      license_plate: row.vehicle_license_plate ? String(row.vehicle_license_plate) : void 0
    };
  }
  return tu;
}
function getTripUpdates(db, filters = {}, stalenessThreshold = 120) {
  const { tripId, routeId, vehicleId, limit } = filters;
  const conditions = [];
  const params = [];
  if (tripId) {
    conditions.push("trip_id = ?");
    params.push(tripId);
  }
  if (routeId) {
    conditions.push("route_id = ?");
    params.push(routeId);
  }
  if (vehicleId) {
    conditions.push("vehicle_id = ?");
    params.push(vehicleId);
  }
  const now = Math.floor(Date.now() / 1e3);
  const staleThreshold = now - stalenessThreshold;
  conditions.push("rt_last_updated >= ?");
  params.push(staleThreshold);
  let sql = "SELECT * FROM rt_trip_updates";
  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }
  sql += " ORDER BY rt_last_updated DESC";
  if (limit) {
    sql += " LIMIT ?";
    params.push(limit);
  }
  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }
  const tripUpdates = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    tripUpdates.push(parseTripUpdate(row));
  }
  stmt.free();
  return tripUpdates;
}
function getTripUpdateByTripId(db, tripId, stalenessThreshold = 120) {
  const updates = getTripUpdates(db, { tripId, limit: 1 }, stalenessThreshold);
  return updates.length > 0 ? updates[0] : null;
}
function getAllTripUpdates(db) {
  const sql = "SELECT * FROM rt_trip_updates ORDER BY rt_last_updated DESC";
  const stmt = db.prepare(sql);
  const tripUpdates = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    tripUpdates.push(parseTripUpdate(row));
  }
  stmt.free();
  return tripUpdates;
}

// src/queries/rt-stop-time-updates.ts
function parseStopTimeUpdate(row) {
  const stu = {
    stop_sequence: row.stop_sequence !== null ? Number(row.stop_sequence) : void 0,
    stop_id: row.stop_id ? String(row.stop_id) : void 0,
    schedule_relationship: row.schedule_relationship !== null ? Number(row.schedule_relationship) : void 0
  };
  if (row.arrival_delay !== null || row.arrival_time !== null || row.arrival_uncertainty !== null) {
    stu.arrival = {
      delay: row.arrival_delay !== null ? Number(row.arrival_delay) : void 0,
      time: row.arrival_time !== null ? Number(row.arrival_time) : void 0,
      uncertainty: row.arrival_uncertainty !== null ? Number(row.arrival_uncertainty) : void 0
    };
  }
  if (row.departure_delay !== null || row.departure_time !== null || row.departure_uncertainty !== null) {
    stu.departure = {
      delay: row.departure_delay !== null ? Number(row.departure_delay) : void 0,
      time: row.departure_time !== null ? Number(row.departure_time) : void 0,
      uncertainty: row.departure_uncertainty !== null ? Number(row.departure_uncertainty) : void 0
    };
  }
  return stu;
}
function parseStopTimeUpdateWithMetadata(row) {
  const stu = parseStopTimeUpdate(row);
  stu.trip_id = String(row.trip_id);
  stu.rt_last_updated = Number(row.rt_last_updated);
  return stu;
}
function getStopTimeUpdates(db, filters = {}, stalenessThreshold = 120) {
  const { tripId, stopId, stopSequence, limit } = filters;
  const conditions = [];
  const params = [];
  if (tripId) {
    conditions.push("trip_id = ?");
    params.push(tripId);
  }
  if (stopId) {
    conditions.push("stop_id = ?");
    params.push(stopId);
  }
  if (stopSequence !== void 0) {
    conditions.push("stop_sequence = ?");
    params.push(stopSequence);
  }
  const now = Math.floor(Date.now() / 1e3);
  const staleThreshold = now - stalenessThreshold;
  conditions.push("rt_last_updated >= ?");
  params.push(staleThreshold);
  let sql = "SELECT * FROM rt_stop_time_updates";
  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }
  sql += " ORDER BY trip_id, stop_sequence";
  if (limit) {
    sql += " LIMIT ?";
    params.push(limit);
  }
  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }
  const stopTimeUpdates = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    stopTimeUpdates.push(parseStopTimeUpdate(row));
  }
  stmt.free();
  return stopTimeUpdates;
}
function getStopTimeUpdatesByTripId(db, tripId, stalenessThreshold = 120) {
  return getStopTimeUpdates(db, { tripId }, stalenessThreshold);
}
function getAllStopTimeUpdates(db) {
  const sql = "SELECT * FROM rt_stop_time_updates ORDER BY trip_id, stop_sequence";
  const stmt = db.prepare(sql);
  const stopTimeUpdates = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    stopTimeUpdates.push(parseStopTimeUpdateWithMetadata(row));
  }
  stmt.free();
  return stopTimeUpdates;
}

// src/gtfs-sqljs.ts
var GtfsSqlJs = class _GtfsSqlJs {
  /**
   * Private constructor - use static factory methods instead
   */
  constructor() {
    this.db = null;
    this.SQL = null;
    this.realtimeFeedUrls = [];
    this.stalenessThreshold = 120;
  }
  /**
   * Create GtfsSqlJs instance from GTFS ZIP file
   */
  static async fromZip(zipPath, options = {}) {
    const instance = new _GtfsSqlJs();
    await instance.initFromZip(zipPath, options);
    return instance;
  }
  /**
   * Create GtfsSqlJs instance from existing SQLite database
   */
  static async fromDatabase(database, options = {}) {
    const instance = new _GtfsSqlJs();
    await instance.initFromDatabase(database, options);
    return instance;
  }
  /**
   * Initialize from ZIP file
   */
  async initFromZip(zipPath, options) {
    this.SQL = options.SQL || await (0, import_sql.default)(options.locateFile ? { locateFile: options.locateFile } : {});
    this.db = new this.SQL.Database();
    const createStatements = getAllCreateStatements();
    for (const statement of createStatements) {
      this.db.run(statement);
    }
    createRealtimeTables(this.db);
    const files = await loadGTFSZip(zipPath);
    await loadGTFSData(this.db, files, options.skipFiles);
    if (options.realtimeFeedUrls) {
      this.realtimeFeedUrls = options.realtimeFeedUrls;
    }
    if (options.stalenessThreshold !== void 0) {
      this.stalenessThreshold = options.stalenessThreshold;
    }
  }
  /**
   * Initialize from existing database
   */
  async initFromDatabase(database, options) {
    this.SQL = options.SQL || await (0, import_sql.default)(options.locateFile ? { locateFile: options.locateFile } : {});
    this.db = new this.SQL.Database(new Uint8Array(database));
    createRealtimeTables(this.db);
    if (options.realtimeFeedUrls) {
      this.realtimeFeedUrls = options.realtimeFeedUrls;
    }
    if (options.stalenessThreshold !== void 0) {
      this.stalenessThreshold = options.stalenessThreshold;
    }
  }
  /**
   * Export database to ArrayBuffer
   */
  export() {
    if (!this.db) {
      throw new Error("Database not initialized");
    }
    const data = this.db.export();
    const buffer = new ArrayBuffer(data.length);
    new Uint8Array(buffer).set(data);
    return buffer;
  }
  /**
   * Close the database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
  /**
   * Get direct access to the database (for advanced queries)
   */
  getDatabase() {
    if (!this.db) {
      throw new Error("Database not initialized");
    }
    return this.db;
  }
  // ==================== Agency Methods ====================
  /**
   * Get an agency by its agency_id
   */
  getAgencyById(agencyId) {
    if (!this.db) throw new Error("Database not initialized");
    return getAgencyById(this.db, agencyId);
  }
  /**
   * Get agencies with optional filters
   */
  getAgencies(filters) {
    if (!this.db) throw new Error("Database not initialized");
    return getAgencies(this.db, filters);
  }
  // ==================== Stop Methods ====================
  /**
   * Get a stop by its stop_id
   */
  getStopById(stopId) {
    if (!this.db) throw new Error("Database not initialized");
    return getStopById(this.db, stopId);
  }
  /**
   * Get stops with optional filters
   */
  getStops(filters) {
    if (!this.db) throw new Error("Database not initialized");
    return getStops(this.db, filters);
  }
  // ==================== Route Methods ====================
  /**
   * Get a route by its route_id
   */
  getRouteById(routeId) {
    if (!this.db) throw new Error("Database not initialized");
    return getRouteById(this.db, routeId);
  }
  /**
   * Get routes with optional filters
   */
  getRoutes(filters) {
    if (!this.db) throw new Error("Database not initialized");
    return getRoutes(this.db, filters);
  }
  // ==================== Calendar Methods ====================
  /**
   * Get active service IDs for a given date (YYYYMMDD format)
   */
  getActiveServiceIds(date) {
    if (!this.db) throw new Error("Database not initialized");
    return getActiveServiceIds(this.db, date);
  }
  /**
   * Get calendar entry by service_id
   */
  getCalendarByServiceId(serviceId) {
    if (!this.db) throw new Error("Database not initialized");
    return getCalendarByServiceId(this.db, serviceId);
  }
  /**
   * Get calendar date exceptions for a service
   */
  getCalendarDates(serviceId) {
    if (!this.db) throw new Error("Database not initialized");
    return getCalendarDates(this.db, serviceId);
  }
  /**
   * Get calendar date exceptions for a specific date
   */
  getCalendarDatesForDate(date) {
    if (!this.db) throw new Error("Database not initialized");
    return getCalendarDatesForDate(this.db, date);
  }
  // ==================== Trip Methods ====================
  /**
   * Get a trip by its trip_id
   */
  getTripById(tripId) {
    if (!this.db) throw new Error("Database not initialized");
    return getTripById(this.db, tripId);
  }
  /**
   * Get trips with optional filters
   *
   * @param filters - Optional filters
   * @param filters.tripId - Filter by trip ID
   * @param filters.routeId - Filter by route ID
   * @param filters.date - Filter by date (YYYYMMDD format) - will get active services for that date
   * @param filters.directionId - Filter by direction ID
   * @param filters.agencyId - Filter by agency ID
   * @param filters.limit - Limit number of results
   *
   * @example
   * // Get all trips for a route on a specific date
   * const trips = gtfs.getTrips({ routeId: 'ROUTE_1', date: '20240115' });
   *
   * @example
   * // Get all trips for a route going in one direction
   * const trips = gtfs.getTrips({ routeId: 'ROUTE_1', directionId: 0 });
   */
  getTrips(filters) {
    if (!this.db) throw new Error("Database not initialized");
    const { date, ...restFilters } = filters || {};
    const finalFilters = { ...restFilters };
    if (date) {
      const serviceIds = getActiveServiceIds(this.db, date);
      finalFilters.serviceIds = serviceIds;
    }
    return getTrips(this.db, finalFilters, this.stalenessThreshold);
  }
  // ==================== Stop Time Methods ====================
  /**
   * Get stop times for a trip (ordered by stop_sequence)
   */
  getStopTimesByTrip(tripId) {
    if (!this.db) throw new Error("Database not initialized");
    return getStopTimesByTrip(this.db, tripId);
  }
  /**
   * Get stop times with optional filters
   *
   * @param filters - Optional filters
   * @param filters.tripId - Filter by trip ID
   * @param filters.stopId - Filter by stop ID
   * @param filters.routeId - Filter by route ID
   * @param filters.date - Filter by date (YYYYMMDD format) - will get active services for that date
   * @param filters.directionId - Filter by direction ID
   * @param filters.agencyId - Filter by agency ID
   * @param filters.limit - Limit number of results
   *
   * @example
   * // Get stop times for a specific trip
   * const stopTimes = gtfs.getStopTimes({ tripId: 'TRIP_123' });
   *
   * @example
   * // Get stop times at a stop for a specific route on a date
   * const stopTimes = gtfs.getStopTimes({
   *   stopId: 'STOP_123',
   *   routeId: 'ROUTE_1',
   *   date: '20240115'
   * });
   */
  getStopTimes(filters) {
    if (!this.db) throw new Error("Database not initialized");
    const { date, ...restFilters } = filters || {};
    const finalFilters = { ...restFilters };
    if (date) {
      const serviceIds = getActiveServiceIds(this.db, date);
      finalFilters.serviceIds = serviceIds;
    }
    return getStopTimes(this.db, finalFilters, this.stalenessThreshold);
  }
  // ==================== Realtime Methods ====================
  /**
   * Set GTFS-RT feed URLs
   */
  setRealtimeFeedUrls(urls) {
    this.realtimeFeedUrls = urls;
  }
  /**
   * Get currently configured GTFS-RT feed URLs
   */
  getRealtimeFeedUrls() {
    return [...this.realtimeFeedUrls];
  }
  /**
   * Set staleness threshold in seconds
   */
  setStalenessThreshold(seconds) {
    this.stalenessThreshold = seconds;
  }
  /**
   * Get current staleness threshold
   */
  getStalenessThreshold() {
    return this.stalenessThreshold;
  }
  /**
   * Fetch and load GTFS Realtime data from configured feed URLs or provided URLs
   * @param urls - Optional array of feed URLs. If not provided, uses configured feed URLs
   */
  async fetchRealtimeData(urls) {
    if (!this.db) throw new Error("Database not initialized");
    const feedUrls = urls || this.realtimeFeedUrls;
    if (feedUrls.length === 0) {
      throw new Error("No realtime feed URLs configured. Use setRealtimeFeedUrls() or pass urls parameter.");
    }
    await loadRealtimeData(this.db, feedUrls);
  }
  /**
   * Clear all realtime data from the database
   */
  clearRealtimeData() {
    if (!this.db) throw new Error("Database not initialized");
    clearRealtimeData(this.db);
  }
  /**
   * Get alerts with optional filters
   */
  getAlerts(filters) {
    if (!this.db) throw new Error("Database not initialized");
    return getAlerts(this.db, filters, this.stalenessThreshold);
  }
  /**
   * Get alert by ID
   */
  getAlertById(alertId) {
    if (!this.db) throw new Error("Database not initialized");
    return getAlertById(this.db, alertId, this.stalenessThreshold);
  }
  /**
   * Get vehicle positions with optional filters
   */
  getVehiclePositions(filters) {
    if (!this.db) throw new Error("Database not initialized");
    return getVehiclePositions(this.db, filters, this.stalenessThreshold);
  }
  /**
   * Get vehicle position by trip ID
   */
  getVehiclePositionByTripId(tripId) {
    if (!this.db) throw new Error("Database not initialized");
    return getVehiclePositionByTripId(this.db, tripId, this.stalenessThreshold);
  }
  /**
   * Get trip updates with optional filters
   */
  getTripUpdates(filters) {
    if (!this.db) throw new Error("Database not initialized");
    return getTripUpdates(this.db, filters, this.stalenessThreshold);
  }
  /**
   * Get trip update by trip ID
   */
  getTripUpdateByTripId(tripId) {
    if (!this.db) throw new Error("Database not initialized");
    return getTripUpdateByTripId(this.db, tripId, this.stalenessThreshold);
  }
  /**
   * Get stop time updates with optional filters
   */
  getStopTimeUpdates(filters) {
    if (!this.db) throw new Error("Database not initialized");
    return getStopTimeUpdates(this.db, filters, this.stalenessThreshold);
  }
  /**
   * Get stop time updates for a specific trip
   */
  getStopTimeUpdatesByTripId(tripId) {
    if (!this.db) throw new Error("Database not initialized");
    return getStopTimeUpdatesByTripId(this.db, tripId, this.stalenessThreshold);
  }
  // ==================== Debug Export Methods ====================
  // These methods export all realtime data without staleness filtering
  // for debugging purposes
  /**
   * Export all alerts without staleness filtering (for debugging)
   */
  debugExportAllAlerts() {
    if (!this.db) throw new Error("Database not initialized");
    return getAllAlerts(this.db);
  }
  /**
   * Export all vehicle positions without staleness filtering (for debugging)
   */
  debugExportAllVehiclePositions() {
    if (!this.db) throw new Error("Database not initialized");
    return getAllVehiclePositions(this.db);
  }
  /**
   * Export all trip updates without staleness filtering (for debugging)
   */
  debugExportAllTripUpdates() {
    if (!this.db) throw new Error("Database not initialized");
    return getAllTripUpdates(this.db);
  }
  /**
   * Export all stop time updates without staleness filtering (for debugging)
   * Returns extended type with trip_id and rt_last_updated for debugging purposes
   */
  debugExportAllStopTimeUpdates() {
    if (!this.db) throw new Error("Database not initialized");
    return getAllStopTimeUpdates(this.db);
  }
};

// src/types/gtfs-rt.ts
var ScheduleRelationship = /* @__PURE__ */ ((ScheduleRelationship2) => {
  ScheduleRelationship2[ScheduleRelationship2["SCHEDULED"] = 0] = "SCHEDULED";
  ScheduleRelationship2[ScheduleRelationship2["ADDED"] = 1] = "ADDED";
  ScheduleRelationship2[ScheduleRelationship2["UNSCHEDULED"] = 2] = "UNSCHEDULED";
  ScheduleRelationship2[ScheduleRelationship2["CANCELED"] = 3] = "CANCELED";
  ScheduleRelationship2[ScheduleRelationship2["SKIPPED"] = 4] = "SKIPPED";
  ScheduleRelationship2[ScheduleRelationship2["NO_DATA"] = 5] = "NO_DATA";
  return ScheduleRelationship2;
})(ScheduleRelationship || {});
var VehicleStopStatus = /* @__PURE__ */ ((VehicleStopStatus2) => {
  VehicleStopStatus2[VehicleStopStatus2["INCOMING_AT"] = 0] = "INCOMING_AT";
  VehicleStopStatus2[VehicleStopStatus2["STOPPED_AT"] = 1] = "STOPPED_AT";
  VehicleStopStatus2[VehicleStopStatus2["IN_TRANSIT_TO"] = 2] = "IN_TRANSIT_TO";
  return VehicleStopStatus2;
})(VehicleStopStatus || {});
var CongestionLevel = /* @__PURE__ */ ((CongestionLevel2) => {
  CongestionLevel2[CongestionLevel2["UNKNOWN_CONGESTION_LEVEL"] = 0] = "UNKNOWN_CONGESTION_LEVEL";
  CongestionLevel2[CongestionLevel2["RUNNING_SMOOTHLY"] = 1] = "RUNNING_SMOOTHLY";
  CongestionLevel2[CongestionLevel2["STOP_AND_GO"] = 2] = "STOP_AND_GO";
  CongestionLevel2[CongestionLevel2["CONGESTION"] = 3] = "CONGESTION";
  CongestionLevel2[CongestionLevel2["SEVERE_CONGESTION"] = 4] = "SEVERE_CONGESTION";
  return CongestionLevel2;
})(CongestionLevel || {});
var OccupancyStatus = /* @__PURE__ */ ((OccupancyStatus2) => {
  OccupancyStatus2[OccupancyStatus2["EMPTY"] = 0] = "EMPTY";
  OccupancyStatus2[OccupancyStatus2["MANY_SEATS_AVAILABLE"] = 1] = "MANY_SEATS_AVAILABLE";
  OccupancyStatus2[OccupancyStatus2["FEW_SEATS_AVAILABLE"] = 2] = "FEW_SEATS_AVAILABLE";
  OccupancyStatus2[OccupancyStatus2["STANDING_ROOM_ONLY"] = 3] = "STANDING_ROOM_ONLY";
  OccupancyStatus2[OccupancyStatus2["CRUSHED_STANDING_ROOM_ONLY"] = 4] = "CRUSHED_STANDING_ROOM_ONLY";
  OccupancyStatus2[OccupancyStatus2["FULL"] = 5] = "FULL";
  OccupancyStatus2[OccupancyStatus2["NOT_ACCEPTING_PASSENGERS"] = 6] = "NOT_ACCEPTING_PASSENGERS";
  return OccupancyStatus2;
})(OccupancyStatus || {});
var AlertCause = /* @__PURE__ */ ((AlertCause2) => {
  AlertCause2[AlertCause2["UNKNOWN_CAUSE"] = 1] = "UNKNOWN_CAUSE";
  AlertCause2[AlertCause2["OTHER_CAUSE"] = 2] = "OTHER_CAUSE";
  AlertCause2[AlertCause2["TECHNICAL_PROBLEM"] = 3] = "TECHNICAL_PROBLEM";
  AlertCause2[AlertCause2["STRIKE"] = 4] = "STRIKE";
  AlertCause2[AlertCause2["DEMONSTRATION"] = 5] = "DEMONSTRATION";
  AlertCause2[AlertCause2["ACCIDENT"] = 6] = "ACCIDENT";
  AlertCause2[AlertCause2["HOLIDAY"] = 7] = "HOLIDAY";
  AlertCause2[AlertCause2["WEATHER"] = 8] = "WEATHER";
  AlertCause2[AlertCause2["MAINTENANCE"] = 9] = "MAINTENANCE";
  AlertCause2[AlertCause2["CONSTRUCTION"] = 10] = "CONSTRUCTION";
  AlertCause2[AlertCause2["POLICE_ACTIVITY"] = 11] = "POLICE_ACTIVITY";
  AlertCause2[AlertCause2["MEDICAL_EMERGENCY"] = 12] = "MEDICAL_EMERGENCY";
  return AlertCause2;
})(AlertCause || {});
var AlertEffect = /* @__PURE__ */ ((AlertEffect2) => {
  AlertEffect2[AlertEffect2["NO_SERVICE"] = 1] = "NO_SERVICE";
  AlertEffect2[AlertEffect2["REDUCED_SERVICE"] = 2] = "REDUCED_SERVICE";
  AlertEffect2[AlertEffect2["SIGNIFICANT_DELAYS"] = 3] = "SIGNIFICANT_DELAYS";
  AlertEffect2[AlertEffect2["DETOUR"] = 4] = "DETOUR";
  AlertEffect2[AlertEffect2["ADDITIONAL_SERVICE"] = 5] = "ADDITIONAL_SERVICE";
  AlertEffect2[AlertEffect2["MODIFIED_SERVICE"] = 6] = "MODIFIED_SERVICE";
  AlertEffect2[AlertEffect2["OTHER_EFFECT"] = 7] = "OTHER_EFFECT";
  AlertEffect2[AlertEffect2["UNKNOWN_EFFECT"] = 8] = "UNKNOWN_EFFECT";
  AlertEffect2[AlertEffect2["STOP_MOVED"] = 9] = "STOP_MOVED";
  AlertEffect2[AlertEffect2["NO_EFFECT"] = 10] = "NO_EFFECT";
  AlertEffect2[AlertEffect2["ACCESSIBILITY_ISSUE"] = 11] = "ACCESSIBILITY_ISSUE";
  return AlertEffect2;
})(AlertEffect || {});
/**
 * gtfs-sqljs - Load GTFS data into sql.js SQLite database
 * @author Théophile Helleboid/SysDevRun
 * @license MIT
 */
//# sourceMappingURL=index.js.map