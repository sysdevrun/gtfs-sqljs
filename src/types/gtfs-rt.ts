/**
 * GTFS Realtime TypeScript types
 * Based on GTFS Realtime v2.0 specification
 */

// Enum types from GTFS-RT specification

export enum ScheduleRelationship {
  SCHEDULED = 0,
  ADDED = 1,
  UNSCHEDULED = 2,
  CANCELED = 3,
  SKIPPED = 4,
  NO_DATA = 5
}

export enum VehicleStopStatus {
  INCOMING_AT = 0,
  STOPPED_AT = 1,
  IN_TRANSIT_TO = 2
}

export enum CongestionLevel {
  UNKNOWN_CONGESTION_LEVEL = 0,
  RUNNING_SMOOTHLY = 1,
  STOP_AND_GO = 2,
  CONGESTION = 3,
  SEVERE_CONGESTION = 4
}

export enum OccupancyStatus {
  EMPTY = 0,
  MANY_SEATS_AVAILABLE = 1,
  FEW_SEATS_AVAILABLE = 2,
  STANDING_ROOM_ONLY = 3,
  CRUSHED_STANDING_ROOM_ONLY = 4,
  FULL = 5,
  NOT_ACCEPTING_PASSENGERS = 6
}

export enum AlertCause {
  UNKNOWN_CAUSE = 1,
  OTHER_CAUSE = 2,
  TECHNICAL_PROBLEM = 3,
  STRIKE = 4,
  DEMONSTRATION = 5,
  ACCIDENT = 6,
  HOLIDAY = 7,
  WEATHER = 8,
  MAINTENANCE = 9,
  CONSTRUCTION = 10,
  POLICE_ACTIVITY = 11,
  MEDICAL_EMERGENCY = 12
}

export enum AlertEffect {
  NO_SERVICE = 1,
  REDUCED_SERVICE = 2,
  SIGNIFICANT_DELAYS = 3,
  DETOUR = 4,
  ADDITIONAL_SERVICE = 5,
  MODIFIED_SERVICE = 6,
  OTHER_EFFECT = 7,
  UNKNOWN_EFFECT = 8,
  STOP_MOVED = 9,
  NO_EFFECT = 10,
  ACCESSIBILITY_ISSUE = 11
}

// Main GTFS-RT types

export interface TranslatedString {
  translation: Array<{
    text: string;
    language?: string;
  }>;
}

export interface EntitySelector {
  agency_id?: string;
  route_id?: string;
  route_type?: number;
  trip?: {
    trip_id?: string;
    route_id?: string;
    direction_id?: number;
    start_time?: string;
    start_date?: string;
    schedule_relationship?: ScheduleRelationship;
  };
  stop_id?: string;
}

export interface TimeRange {
  start?: number; // UNIX timestamp
  end?: number;   // UNIX timestamp
}

export interface Alert {
  id: string;
  active_period: TimeRange[];
  informed_entity: EntitySelector[];
  cause?: AlertCause;
  effect?: AlertEffect;
  url?: TranslatedString;
  header_text?: TranslatedString;
  description_text?: TranslatedString;
  rt_last_updated: number; // UNIX timestamp
}

export interface Position {
  latitude: number;
  longitude: number;
  bearing?: number;
  odometer?: number;
  speed?: number;
}

export interface VehicleDescriptor {
  id?: string;
  label?: string;
  license_plate?: string;
}

export interface VehiclePosition {
  trip_id: string;
  route_id?: string;
  vehicle?: VehicleDescriptor;
  position?: Position;
  current_stop_sequence?: number;
  stop_id?: string;
  current_status?: VehicleStopStatus;
  timestamp?: number;
  congestion_level?: CongestionLevel;
  occupancy_status?: OccupancyStatus;
  rt_last_updated: number; // UNIX timestamp
}

export interface StopTimeEvent {
  delay?: number;     // seconds
  time?: number;      // UNIX timestamp (absolute time)
  uncertainty?: number;
}

export interface StopTimeUpdate {
  stop_sequence?: number;
  stop_id?: string;
  arrival?: StopTimeEvent;
  departure?: StopTimeEvent;
  schedule_relationship?: ScheduleRelationship;
}

export interface TripUpdate {
  trip_id: string;
  route_id?: string;
  vehicle?: VehicleDescriptor;
  stop_time_update: StopTimeUpdate[];
  timestamp?: number;
  delay?: number;
  schedule_relationship?: ScheduleRelationship;
  rt_last_updated: number; // UNIX timestamp
}

// Enhanced types for queries with realtime data

export interface StopTimeRealtime {
  arrival_delay?: number;      // seconds
  departure_delay?: number;    // seconds
  schedule_relationship?: ScheduleRelationship;
}

export interface TripRealtime {
  vehicle_position?: VehiclePosition | null;
  trip_update?: {
    delay?: number;
    schedule_relationship?: ScheduleRelationship;
  } | null;
}

// Filter types for realtime queries

export interface AlertFilters {
  alertId?: string;
  activeOnly?: boolean;
  routeId?: string;
  stopId?: string;
  tripId?: string;
  cause?: AlertCause;
  effect?: AlertEffect;
  limit?: number;
}

export interface VehiclePositionFilters {
  tripId?: string;
  routeId?: string;
  vehicleId?: string;
  limit?: number;
}

// Configuration

export interface RealtimeConfig {
  feedUrls?: string[];
  stalenessThreshold?: number; // seconds, default 120
}
