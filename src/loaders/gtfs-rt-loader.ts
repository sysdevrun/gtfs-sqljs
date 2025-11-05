import type { Database } from 'sql.js';
import protobuf from 'protobufjs';

// Types for protobuf decoded objects
interface ProtobufTranslation {
  text: string;
  language?: string;
}

interface ProtobufTranslatedString {
  translation: ProtobufTranslation[];
}

interface ProtobufAlert {
  id: string;
  activePeriod?: unknown[];
  active_period?: unknown[];
  informedEntity?: unknown[];
  informed_entity?: unknown[];
  cause?: number;
  effect?: number;
  url?: ProtobufTranslatedString;
  headerText?: ProtobufTranslatedString;
  header_text?: ProtobufTranslatedString;
  descriptionText?: ProtobufTranslatedString;
  description_text?: ProtobufTranslatedString;
}

interface ProtobufTripDescriptor {
  tripId?: string;
  trip_id?: string;
  routeId?: string;
  route_id?: string;
  scheduleRelationship?: number;
  schedule_relationship?: number;
}

interface ProtobufVehicleDescriptor {
  id?: string;
  label?: string;
  licensePlate?: string;
  license_plate?: string;
}

interface ProtobufPosition {
  latitude?: number;
  longitude?: number;
  bearing?: number;
  odometer?: number;
  speed?: number;
}

interface ProtobufVehiclePosition {
  trip?: ProtobufTripDescriptor;
  vehicle?: ProtobufVehicleDescriptor;
  position?: ProtobufPosition;
  currentStopSequence?: number;
  current_stop_sequence?: number;
  stopId?: string;
  stop_id?: string;
  currentStatus?: number;
  current_status?: number;
  timestamp?: number;
  congestionLevel?: number;
  congestion_level?: number;
  occupancyStatus?: number;
  occupancy_status?: number;
}

interface ProtobufStopTimeEvent {
  delay?: number;
  time?: number;
  uncertainty?: number;
}

interface ProtobufStopTimeUpdate {
  stopSequence?: number;
  stop_sequence?: number;
  stopId?: string;
  stop_id?: string;
  scheduleRelationship?: number;
  schedule_relationship?: number;
  arrival?: ProtobufStopTimeEvent;
  departure?: ProtobufStopTimeEvent;
}

interface ProtobufTripUpdate {
  trip?: ProtobufTripDescriptor;
  vehicle?: ProtobufVehicleDescriptor;
  timestamp?: number;
  delay?: number;
  stopTimeUpdate?: ProtobufStopTimeUpdate[];
  stop_time_update?: ProtobufStopTimeUpdate[];
}

// GTFS Realtime protobuf definition (v2.0)
// Source: https://github.com/google/transit/blob/master/gtfs-realtime/proto/gtfs-realtime.proto
const GTFS_RT_PROTO = `
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

// Fetch protobuf data from URL or local file
// Uses fetch API (available in modern browsers and Node.js 18+)
async function fetchProtobuf(source: string): Promise<Uint8Array> {
  const isUrl = source.startsWith('http://') || source.startsWith('https://');

  if (isUrl) {
    // Fetch from URL
    const response = await fetch(source, {
      headers: {
        'Accept': 'application/x-protobuf, application/octet-stream'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch GTFS-RT feed from ${source}: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }

  // Read from local file (Node.js only)
  const isNode = typeof process !== 'undefined' &&
                 process.versions != null &&
                 process.versions.node != null;

  if (isNode) {
    try {
      const fs = await import('fs');
      const buffer = await fs.promises.readFile(source);
      return new Uint8Array(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
    } catch (error) {
      throw new Error(`Failed to read GTFS-RT file from ${source}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // In browser, try fetch for relative paths
  const response = await fetch(source, {
    headers: {
      'Accept': 'application/x-protobuf, application/octet-stream'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch GTFS-RT feed from ${source}: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

// Load and parse GTFS-RT protobuf schema
let gtfsRtRoot: protobuf.Root | null = null;

function loadGtfsRtProto(): protobuf.Root {
  if (!gtfsRtRoot) {
    gtfsRtRoot = protobuf.parse(GTFS_RT_PROTO).root;
  }
  return gtfsRtRoot;
}

// Convert camelCase object keys to snake_case
function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

function convertKeysToSnakeCase(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(convertKeysToSnakeCase);
  }
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const key in obj as Record<string, unknown>) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const snakeKey = camelToSnake(key);
        result[snakeKey] = convertKeysToSnakeCase((obj as Record<string, unknown>)[key]);
      }
    }
    return result;
  }
  return obj;
}

// Parse TranslatedString to JSON
function parseTranslatedString(ts: ProtobufTranslatedString | undefined): string | null {
  if (!ts || !ts.translation || ts.translation.length === 0) {
    return null;
  }
  return JSON.stringify({
    translation: ts.translation.map((t) => ({
      text: t.text,
      language: t.language || undefined
    }))
  });
}

// Insert alerts into database
function insertAlerts(db: Database, alerts: ProtobufAlert[], timestamp: number): void {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO rt_alerts (
      id, active_period, informed_entity, cause, effect,
      url, header_text, description_text, rt_last_updated
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const alert of alerts) {
    // Map camelCase protobuf fields to snake_case
    const activePeriod = alert.activePeriod || alert.active_period || [];
    const informedEntity = alert.informedEntity || alert.informed_entity || [];
    const headerText = alert.headerText || alert.header_text;
    const descriptionText = alert.descriptionText || alert.description_text;

    // Convert nested objects to snake_case
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

// Insert vehicle positions into database
function insertVehiclePositions(db: Database, positions: ProtobufVehiclePosition[], timestamp: number): void {
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

    // Map camelCase protobuf fields to snake_case
    const tripId = (trip.tripId || trip.trip_id)!; // Safe: checked above
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

// Insert trip updates into database
function insertTripUpdates(db: Database, updates: ProtobufTripUpdate[], timestamp: number): void {
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

    // Map camelCase protobuf fields to snake_case
    const tripId = (trip.tripId || trip.trip_id)!; // Safe: checked above
    const routeId = trip.routeId || trip.route_id;
    const vehicleId = tu.vehicle?.id;
    const vehicleLabel = tu.vehicle?.label;
    const vehicleLicensePlate = tu.vehicle?.licensePlate || tu.vehicle?.license_plate;
    const scheduleRelationship = trip.scheduleRelationship || trip.schedule_relationship;
    const stopTimeUpdate = tu.stopTimeUpdate || tu.stop_time_update;

    // Insert trip update
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

    // Insert stop time updates
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

/**
 * Fetch and load GTFS Realtime data from multiple feed URLs
 * All feeds are fetched in parallel. If any feed fails, an error is thrown.
 */
export async function loadRealtimeData(db: Database, feedUrls: string[]): Promise<void> {
  const root = loadGtfsRtProto();
  const FeedMessage = root.lookupType('transit_realtime.FeedMessage');

  // Fetch all feeds in parallel
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

  // Wait for all feeds - if any fails, this will throw
  const feeds = await Promise.all(fetchPromises);

  // Current timestamp for staleness tracking
  const now = Math.floor(Date.now() / 1000);

  // Collect all entities by type
  const allAlerts: ProtobufAlert[] = [];
  const allVehiclePositions: ProtobufVehiclePosition[] = [];
  const allTripUpdates: ProtobufTripUpdate[] = [];

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

  // Insert into database
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
