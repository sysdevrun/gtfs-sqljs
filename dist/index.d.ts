import { SqlJsStatic, Database } from 'sql.js';

/**
 * GTFS Realtime TypeScript types
 * Based on GTFS Realtime v2.0 specification
 */
declare enum ScheduleRelationship {
    SCHEDULED = 0,
    ADDED = 1,
    UNSCHEDULED = 2,
    CANCELED = 3,
    SKIPPED = 4,
    NO_DATA = 5
}
declare enum VehicleStopStatus {
    INCOMING_AT = 0,
    STOPPED_AT = 1,
    IN_TRANSIT_TO = 2
}
declare enum CongestionLevel {
    UNKNOWN_CONGESTION_LEVEL = 0,
    RUNNING_SMOOTHLY = 1,
    STOP_AND_GO = 2,
    CONGESTION = 3,
    SEVERE_CONGESTION = 4
}
declare enum OccupancyStatus {
    EMPTY = 0,
    MANY_SEATS_AVAILABLE = 1,
    FEW_SEATS_AVAILABLE = 2,
    STANDING_ROOM_ONLY = 3,
    CRUSHED_STANDING_ROOM_ONLY = 4,
    FULL = 5,
    NOT_ACCEPTING_PASSENGERS = 6
}
declare enum AlertCause {
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
declare enum AlertEffect {
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
interface TranslatedString {
    translation: Array<{
        text: string;
        language?: string;
    }>;
}
interface EntitySelector {
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
interface TimeRange {
    start?: number;
    end?: number;
}
interface Alert {
    id: string;
    active_period: TimeRange[];
    informed_entity: EntitySelector[];
    cause?: AlertCause;
    effect?: AlertEffect;
    url?: TranslatedString;
    header_text?: TranslatedString;
    description_text?: TranslatedString;
    rt_last_updated: number;
}
interface Position {
    latitude: number;
    longitude: number;
    bearing?: number;
    odometer?: number;
    speed?: number;
}
interface VehicleDescriptor {
    id?: string;
    label?: string;
    license_plate?: string;
}
interface VehiclePosition {
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
    rt_last_updated: number;
}
interface StopTimeEvent {
    delay?: number;
    time?: number;
    uncertainty?: number;
}
interface StopTimeUpdate {
    stop_sequence?: number;
    stop_id?: string;
    arrival?: StopTimeEvent;
    departure?: StopTimeEvent;
    schedule_relationship?: ScheduleRelationship;
}
interface TripUpdate {
    trip_id: string;
    route_id?: string;
    vehicle?: VehicleDescriptor;
    stop_time_update: StopTimeUpdate[];
    timestamp?: number;
    delay?: number;
    schedule_relationship?: ScheduleRelationship;
    rt_last_updated: number;
}
interface StopTimeRealtime {
    arrival_delay?: number;
    departure_delay?: number;
    schedule_relationship?: ScheduleRelationship;
}
interface TripRealtime {
    vehicle_position?: VehiclePosition | null;
    trip_update?: {
        delay?: number;
        schedule_relationship?: ScheduleRelationship;
    } | null;
}
interface AlertFilters {
    alertId?: string;
    activeOnly?: boolean;
    routeId?: string;
    stopId?: string;
    tripId?: string;
    cause?: AlertCause;
    effect?: AlertEffect;
    limit?: number;
}
interface VehiclePositionFilters {
    tripId?: string;
    routeId?: string;
    vehicleId?: string;
    limit?: number;
}
interface RealtimeConfig {
    feedUrls?: string[];
    stalenessThreshold?: number;
}

/**
 * GTFS Type Definitions
 * Based on GTFS Reference: https://gtfs.org/schedule/reference/
 */
/**
 * Agency - One or more transit agencies that provide the data in this feed
 */
interface Agency {
    agency_id: string;
    agency_name: string;
    agency_url: string;
    agency_timezone: string;
    agency_lang?: string;
    agency_phone?: string;
    agency_fare_url?: string;
    agency_email?: string;
}
/**
 * Stop - Individual locations where vehicles pick up or drop off riders
 */
interface Stop {
    stop_id: string;
    stop_name: string;
    stop_lat: number;
    stop_lon: number;
    stop_code?: string;
    stop_desc?: string;
    zone_id?: string;
    stop_url?: string;
    location_type?: number;
    parent_station?: string;
    stop_timezone?: string;
    wheelchair_boarding?: number;
    level_id?: string;
    platform_code?: string;
}
/**
 * Route - Transit routes
 */
interface Route {
    route_id: string;
    route_short_name: string;
    route_long_name: string;
    route_type: number;
    agency_id?: string;
    route_desc?: string;
    route_url?: string;
    route_color?: string;
    route_text_color?: string;
    route_sort_order?: number;
    continuous_pickup?: number;
    continuous_drop_off?: number;
}
/**
 * Trip - Trips for each route
 */
interface Trip {
    route_id: string;
    service_id: string;
    trip_id: string;
    trip_headsign?: string;
    trip_short_name?: string;
    direction_id?: number;
    block_id?: string;
    shape_id?: string;
    wheelchair_accessible?: number;
    bikes_allowed?: number;
}
/**
 * StopTime - Times that a vehicle arrives at and departs from stops for each trip
 */
interface StopTime {
    trip_id: string;
    arrival_time: string;
    departure_time: string;
    stop_id: string;
    stop_sequence: number;
    stop_headsign?: string;
    pickup_type?: number;
    drop_off_type?: number;
    continuous_pickup?: number;
    continuous_drop_off?: number;
    shape_dist_traveled?: number;
    timepoint?: number;
}
/**
 * Calendar - Service dates specified using a weekly schedule with start and end dates
 */
interface Calendar {
    service_id: string;
    monday: number;
    tuesday: number;
    wednesday: number;
    thursday: number;
    friday: number;
    saturday: number;
    sunday: number;
    start_date: string;
    end_date: string;
}
/**
 * CalendarDate - Exceptions for the services defined in calendar.txt
 */
interface CalendarDate {
    service_id: string;
    date: string;
    exception_type: number;
}
/**
 * FareAttribute - Fare information for a transit agency's routes
 */
interface FareAttribute {
    fare_id: string;
    price: number;
    currency_type: string;
    payment_method: number;
    transfers: number;
    agency_id?: string;
    transfer_duration?: number;
}
/**
 * FareRule - Rules for applying fares for itineraries
 */
interface FareRule {
    fare_id: string;
    route_id?: string;
    origin_id?: string;
    destination_id?: string;
    contains_id?: string;
}
/**
 * Shape - Rules for mapping vehicle travel paths
 */
interface Shape {
    shape_id: string;
    shape_pt_lat: number;
    shape_pt_lon: number;
    shape_pt_sequence: number;
    shape_dist_traveled?: number;
}
/**
 * Frequency - Headway-based service patterns
 */
interface Frequency {
    trip_id: string;
    start_time: string;
    end_time: string;
    headway_secs: number;
    exact_times?: number;
}
/**
 * Transfer - Rules for making connections at transfer points
 */
interface Transfer {
    from_stop_id: string;
    to_stop_id: string;
    transfer_type: number;
    min_transfer_time?: number;
}
/**
 * Pathway - Pathways linking together locations within stations
 */
interface Pathway {
    pathway_id: string;
    from_stop_id: string;
    to_stop_id: string;
    pathway_mode: number;
    is_bidirectional: number;
    length?: number;
    traversal_time?: number;
    stair_count?: number;
    max_slope?: number;
    min_width?: number;
    signposted_as?: string;
    reversed_signposted_as?: string;
}
/**
 * Level - Levels within stations
 */
interface Level {
    level_id: string;
    level_index: number;
    level_name?: string;
}
/**
 * FeedInfo - Information about the dataset itself
 */
interface FeedInfo {
    feed_publisher_name: string;
    feed_publisher_url: string;
    feed_lang: string;
    default_lang?: string;
    feed_start_date?: string;
    feed_end_date?: string;
    feed_version?: string;
    feed_contact_email?: string;
    feed_contact_url?: string;
}
/**
 * Attribution - Attribution information for the dataset
 */
interface Attribution {
    attribution_id: string;
    organization_name: string;
    agency_id?: string;
    route_id?: string;
    trip_id?: string;
    is_producer?: number;
    is_operator?: number;
    is_authority?: number;
    attribution_url?: string;
    attribution_email?: string;
    attribution_phone?: string;
}

/**
 * Agency Query Methods
 */

interface AgencyFilters {
    agencyId?: string;
    limit?: number;
}

/**
 * Stop Query Methods
 */

interface StopFilters {
    stopId?: string;
    stopCode?: string;
    name?: string;
    tripId?: string;
    limit?: number;
}

/**
 * Route Query Methods
 */

interface RouteFilters {
    routeId?: string;
    agencyId?: string;
    limit?: number;
}

/**
 * Trip Query Methods
 */

interface TripFilters {
    tripId?: string;
    routeId?: string;
    serviceIds?: string[];
    directionId?: number;
    agencyId?: string;
    includeRealtime?: boolean;
    limit?: number;
}
interface TripWithRealtime extends Trip {
    realtime?: TripRealtime;
}

/**
 * Stop Time Query Methods
 */

interface StopTimeFilters {
    tripId?: string;
    stopId?: string;
    routeId?: string;
    serviceIds?: string[];
    directionId?: number;
    agencyId?: string;
    includeRealtime?: boolean;
    limit?: number;
}
interface StopTimeWithRealtime extends StopTime {
    realtime?: StopTimeRealtime;
}

interface TripUpdateFilters {
    tripId?: string;
    routeId?: string;
    vehicleId?: string;
    limit?: number;
}

interface StopTimeUpdateFilters {
    tripId?: string;
    stopId?: string;
    stopSequence?: number;
    limit?: number;
}
/**
 * Extended StopTimeUpdate with trip_id and rt_last_updated for debugging
 */
interface StopTimeUpdateWithMetadata extends StopTimeUpdate {
    trip_id: string;
    rt_last_updated: number;
}

interface GtfsSqlJsOptions {
    /**
     * Path or URL to GTFS ZIP file
     */
    zipPath?: string;
    /**
     * Pre-loaded SQLite database as ArrayBuffer
     */
    database?: ArrayBuffer;
    /**
     * Optional: Custom SQL.js instance
     */
    SQL?: SqlJsStatic;
    /**
     * Optional: Path to SQL.js WASM file (for custom loading)
     */
    locateFile?: (filename: string) => string;
    /**
     * Optional: Array of GTFS filenames to skip importing (e.g., ['shapes.txt'])
     * Tables will be created but no data will be imported for these files
     */
    skipFiles?: string[];
    /**
     * Optional: Array of GTFS-RT feed URLs for realtime data
     */
    realtimeFeedUrls?: string[];
    /**
     * Optional: Staleness threshold in seconds (default: 120)
     * Realtime data older than this will be excluded from queries
     */
    stalenessThreshold?: number;
}
declare class GtfsSqlJs {
    private db;
    private SQL;
    private realtimeFeedUrls;
    private stalenessThreshold;
    /**
     * Private constructor - use static factory methods instead
     */
    private constructor();
    /**
     * Create GtfsSqlJs instance from GTFS ZIP file
     */
    static fromZip(zipPath: string, options?: Omit<GtfsSqlJsOptions, 'zipPath' | 'database'>): Promise<GtfsSqlJs>;
    /**
     * Create GtfsSqlJs instance from existing SQLite database
     */
    static fromDatabase(database: ArrayBuffer, options?: Omit<GtfsSqlJsOptions, 'zipPath' | 'database'>): Promise<GtfsSqlJs>;
    /**
     * Initialize from ZIP file
     */
    private initFromZip;
    /**
     * Initialize from existing database
     */
    private initFromDatabase;
    /**
     * Export database to ArrayBuffer
     */
    export(): ArrayBuffer;
    /**
     * Close the database connection
     */
    close(): void;
    /**
     * Get direct access to the database (for advanced queries)
     */
    getDatabase(): Database;
    /**
     * Get an agency by its agency_id
     */
    getAgencyById(agencyId: string): Agency | null;
    /**
     * Get agencies with optional filters
     */
    getAgencies(filters?: AgencyFilters): Agency[];
    /**
     * Get a stop by its stop_id
     */
    getStopById(stopId: string): Stop | null;
    /**
     * Get stops with optional filters
     */
    getStops(filters?: StopFilters): Stop[];
    /**
     * Get a route by its route_id
     */
    getRouteById(routeId: string): Route | null;
    /**
     * Get routes with optional filters
     */
    getRoutes(filters?: RouteFilters): Route[];
    /**
     * Get active service IDs for a given date (YYYYMMDD format)
     */
    getActiveServiceIds(date: string): string[];
    /**
     * Get calendar entry by service_id
     */
    getCalendarByServiceId(serviceId: string): Calendar | null;
    /**
     * Get calendar date exceptions for a service
     */
    getCalendarDates(serviceId: string): CalendarDate[];
    /**
     * Get calendar date exceptions for a specific date
     */
    getCalendarDatesForDate(date: string): CalendarDate[];
    /**
     * Get a trip by its trip_id
     */
    getTripById(tripId: string): Trip | null;
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
    getTrips(filters?: TripFilters & {
        date?: string;
    }): Trip[];
    /**
     * Get stop times for a trip (ordered by stop_sequence)
     */
    getStopTimesByTrip(tripId: string): StopTime[];
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
    getStopTimes(filters?: StopTimeFilters & {
        date?: string;
    }): StopTime[];
    /**
     * Set GTFS-RT feed URLs
     */
    setRealtimeFeedUrls(urls: string[]): void;
    /**
     * Get currently configured GTFS-RT feed URLs
     */
    getRealtimeFeedUrls(): string[];
    /**
     * Set staleness threshold in seconds
     */
    setStalenessThreshold(seconds: number): void;
    /**
     * Get current staleness threshold
     */
    getStalenessThreshold(): number;
    /**
     * Fetch and load GTFS Realtime data from configured feed URLs or provided URLs
     * @param urls - Optional array of feed URLs. If not provided, uses configured feed URLs
     */
    fetchRealtimeData(urls?: string[]): Promise<void>;
    /**
     * Clear all realtime data from the database
     */
    clearRealtimeData(): void;
    /**
     * Get alerts with optional filters
     */
    getAlerts(filters?: AlertFilters): Alert[];
    /**
     * Get alert by ID
     */
    getAlertById(alertId: string): Alert | null;
    /**
     * Get vehicle positions with optional filters
     */
    getVehiclePositions(filters?: VehiclePositionFilters): VehiclePosition[];
    /**
     * Get vehicle position by trip ID
     */
    getVehiclePositionByTripId(tripId: string): VehiclePosition | null;
    /**
     * Get trip updates with optional filters
     */
    getTripUpdates(filters?: TripUpdateFilters): TripUpdate[];
    /**
     * Get trip update by trip ID
     */
    getTripUpdateByTripId(tripId: string): TripUpdate | null;
    /**
     * Get stop time updates with optional filters
     */
    getStopTimeUpdates(filters?: StopTimeUpdateFilters): StopTimeUpdate[];
    /**
     * Get stop time updates for a specific trip
     */
    getStopTimeUpdatesByTripId(tripId: string): StopTimeUpdate[];
    /**
     * Export all alerts without staleness filtering (for debugging)
     */
    debugExportAllAlerts(): Alert[];
    /**
     * Export all vehicle positions without staleness filtering (for debugging)
     */
    debugExportAllVehiclePositions(): VehiclePosition[];
    /**
     * Export all trip updates without staleness filtering (for debugging)
     */
    debugExportAllTripUpdates(): TripUpdate[];
    /**
     * Export all stop time updates without staleness filtering (for debugging)
     * Returns extended type with trip_id and rt_last_updated for debugging purposes
     */
    debugExportAllStopTimeUpdates(): StopTimeUpdateWithMetadata[];
}

/**
 * SQLite Schema Definitions for GTFS Data
 * Matches required/optional fields from GTFS specification
 */
interface TableSchema {
    name: string;
    columns: ColumnDefinition[];
    indexes?: IndexDefinition[];
}
interface ColumnDefinition {
    name: string;
    type: 'TEXT' | 'INTEGER' | 'REAL';
    required: boolean;
    primaryKey?: boolean;
}
interface IndexDefinition {
    name: string;
    columns: string[];
    unique?: boolean;
}
declare const GTFS_SCHEMA: TableSchema[];

export { type Agency, type AgencyFilters, type Alert, AlertCause, AlertEffect, type AlertFilters, type Attribution, type Calendar, type CalendarDate, type ColumnDefinition, CongestionLevel, type EntitySelector, type FareAttribute, type FareRule, type FeedInfo, type Frequency, GTFS_SCHEMA, GtfsSqlJs, type GtfsSqlJsOptions, type IndexDefinition, type Level, OccupancyStatus, type Pathway, type Position, type RealtimeConfig, type Route, type RouteFilters, ScheduleRelationship, type Shape, type Stop, type StopFilters, type StopTime, type StopTimeEvent, type StopTimeFilters, type StopTimeRealtime, type StopTimeUpdate, type StopTimeUpdateFilters, type StopTimeUpdateWithMetadata, type StopTimeWithRealtime, type TableSchema, type TimeRange, type Transfer, type TranslatedString, type Trip, type TripFilters, type TripRealtime, type TripUpdate, type TripUpdateFilters, type TripWithRealtime, type VehicleDescriptor, type VehiclePosition, type VehiclePositionFilters, VehicleStopStatus };
