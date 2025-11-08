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
    arrival_time?: number;
    departure_delay?: number;
    departure_time?: number;
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
 * Metadata stored with cached GTFS databases
 */
interface CacheMetadata {
    /** Checksum of the source zip file (SHA-256) */
    checksum: string;
    /** Version number - cache is invalidated if this changes */
    version: string;
    /** Timestamp when the cache was created */
    timestamp: number;
    /** Source zip URL or path (for reference) */
    source?: string;
    /** Size of the cached database in bytes */
    size: number;
    /** Which files were skipped during import (affects cache validity) */
    skipFiles?: string[];
}
/**
 * A single cache entry with its metadata
 */
interface CacheEntry {
    /** Unique cache key */
    key: string;
    /** Cache metadata */
    metadata: CacheMetadata;
}
/**
 * A cache entry with data and metadata
 */
interface CacheEntryWithData {
    /** The cached database data */
    data: ArrayBuffer;
    /** Cache metadata */
    metadata: CacheMetadata;
}
/**
 * Interface for implementing custom cache storage backends.
 *
 * The library provides two implementations:
 * - IndexedDBCacheStore (for browsers)
 * - FileSystemCacheStore (for Node.js)
 *
 * You can implement this interface to use custom storage backends
 * (e.g., Redis, S3, or any other storage system).
 */
interface CacheStore {
    /**
     * Retrieve a cached database by key
     * @param key - Cache key (typically includes checksum and version)
     * @returns The cached entry with data and metadata, or null if not found
     */
    get(key: string): Promise<CacheEntryWithData | null>;
    /**
     * Store a database in the cache
     * @param key - Cache key
     * @param data - Database as ArrayBuffer
     * @param metadata - Metadata about the cached database
     */
    set(key: string, data: ArrayBuffer, metadata: CacheMetadata): Promise<void>;
    /**
     * Check if a cache entry exists
     * @param key - Cache key
     * @returns true if the cache entry exists
     */
    has(key: string): Promise<boolean>;
    /**
     * Delete a specific cache entry
     * @param key - Cache key
     */
    delete(key: string): Promise<void>;
    /**
     * Clear all cache entries
     */
    clear(): Promise<void>;
    /**
     * List all cached entries (optional)
     * @returns Array of cache entries with their metadata
     */
    list?(): Promise<CacheEntry[]>;
}
/**
 * Options for cache stores
 */
interface CacheStoreOptions {
    /** Cache directory path (for FileSystemCacheStore) */
    dir?: string;
    /** IndexedDB database name (for IndexedDBCacheStore) */
    dbName?: string;
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
interface Transfer$1 {
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
    agencyId?: string | string[];
    limit?: number;
}

/**
 * Stop Query Methods
 */

interface StopFilters {
    stopId?: string | string[];
    stopCode?: string | string[];
    name?: string;
    tripId?: string | string[];
    limit?: number;
}

/**
 * Route Query Methods
 */

interface RouteFilters {
    routeId?: string | string[];
    agencyId?: string | string[];
    limit?: number;
}

/**
 * Trip Query Methods
 */

interface TripFilters {
    tripId?: string | string[];
    routeId?: string | string[];
    serviceIds?: string | string[];
    directionId?: number | number[];
    agencyId?: string | string[];
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
    tripId?: string | string[];
    stopId?: string | string[];
    routeId?: string | string[];
    serviceIds?: string | string[];
    directionId?: number | number[];
    agencyId?: string | string[];
    includeRealtime?: boolean;
    limit?: number;
}
interface StopTimeWithRealtime extends StopTime {
    realtime?: StopTimeRealtime;
}

/**
 * Itinerary Computation Module
 * Computes multi-leg journeys between stops using GTFS data
 */

/**
 * Configuration for itinerary search
 */
interface ItinerarySearchConfig {
    /** Maximum number of transfers allowed (default: 3) */
    maxTransfers?: number;
    /** Minimum transfer time in seconds (default: 300 = 5 minutes) */
    minTransferTime?: number;
    /** Maximum number of itineraries to return (default: 5) */
    maxResults?: number;
    /** Maximum search depth for graph traversal (default: 10) */
    maxSearchDepth?: number;
}
/**
 * Filters for itinerary search
 */
interface ItinerarySearchFilters {
    /** Origin stop ID */
    fromStopId: string;
    /** Destination stop ID */
    toStopId: string;
    /** Date in YYYYMMDD format */
    date: string;
    /** Departure time in HH:MM:SS format (leave after this time) */
    departureTimeAfter: string;
    /** Arrival time in HH:MM:SS format (arrive before this time, optional) */
    departureTimeBefore?: string;
    /** Configuration options */
    config?: ItinerarySearchConfig;
}
/**
 * A single leg of a journey (one trip on one route)
 */
interface ItineraryLeg {
    /** Sequence number of this leg (0-indexed) */
    legIndex: number;
    /** Route information */
    route: Route;
    /** Trip information */
    trip: Trip;
    /** Direction ID */
    directionId: number;
    /** Departure stop */
    fromStop: Stop;
    /** Arrival stop */
    toStop: Stop;
    /** Departure time (HH:MM:SS) */
    departureTime: string;
    /** Arrival time (HH:MM:SS) */
    arrivalTime: string;
    /** All stop times for this leg (ordered) */
    stopTimes: StopTime[];
    /** Duration in seconds */
    duration: number;
}
/**
 * Transfer between two legs
 */
interface Transfer {
    /** Stop where transfer occurs */
    stop: Stop;
    /** Time to wait for next leg in seconds */
    waitTime: number;
    /** Time when arriving at transfer stop */
    arrivalTime: string;
    /** Time when departing from transfer stop */
    departureTime: string;
}
/**
 * A complete itinerary from origin to destination
 */
interface Itinerary {
    /** List of journey legs */
    legs: ItineraryLeg[];
    /** List of transfers (empty for direct routes) */
    transfers: Transfer[];
    /** Total number of transfers */
    numberOfTransfers: number;
    /** Departure time from origin */
    departureTime: string;
    /** Arrival time at destination */
    arrivalTime: string;
    /** Total journey duration in seconds */
    totalDuration: number;
    /** Total in-vehicle time in seconds */
    inVehicleTime: number;
    /** Total waiting time in seconds */
    waitingTime: number;
}

interface TripUpdateFilters {
    tripId?: string;
    routeId?: string;
    vehicleId?: string;
    limit?: number;
}

interface StopTimeUpdateFilters {
    tripId?: string | string[];
    stopId?: string | string[];
    stopSequence?: number | number[];
    limit?: number;
}
/**
 * Extended StopTimeUpdate with trip_id and rt_last_updated for debugging
 */
interface StopTimeUpdateWithMetadata extends StopTimeUpdate {
    trip_id: string;
    rt_last_updated: number;
}

/**
 * Progress information for GTFS data loading
 */
interface ProgressInfo {
    phase: 'checking_cache' | 'loading_from_cache' | 'downloading' | 'extracting' | 'creating_schema' | 'inserting_data' | 'creating_indexes' | 'analyzing' | 'saving_cache' | 'complete';
    currentFile: string | null;
    filesCompleted: number;
    totalFiles: number;
    rowsProcessed: number;
    totalRows: number;
    percentComplete: number;
    message: string;
}
/**
 * Progress callback function type
 */
type ProgressCallback = (progress: ProgressInfo) => void;
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
    /**
     * Optional: Progress callback for tracking load progress
     * Useful for displaying progress in UI or web workers
     */
    onProgress?: ProgressCallback;
    /**
     * Optional: Cache store for persisting processed GTFS databases
     * Use IndexedDBCacheStore (browser) or FileSystemCacheStore (Node.js)
     * or implement your own CacheStore
     *
     * If not provided, caching is enabled by default with:
     * - IndexedDBCacheStore in browsers
     * - FileSystemCacheStore in Node.js
     *
     * Set to `null` to disable caching
     */
    cache?: CacheStore | null;
    /**
     * Optional: Data version string
     * When changed, cached databases are invalidated and reprocessed
     * Default: '1.0'
     */
    cacheVersion?: string;
    /**
     * Optional: Cache expiration time in milliseconds
     * Cached databases older than this will be invalidated
     * Default: 7 days (604800000 ms)
     */
    cacheExpirationMs?: number;
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
     * Helper method to load GTFS data from zip data (ArrayBuffer)
     * Used by both cache-enabled and cache-disabled paths
     */
    private loadFromZipData;
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
     * Get agencies with optional filters
     * Pass agencyId filter to get a specific agency
     */
    getAgencies(filters?: AgencyFilters): Agency[];
    /**
     * Get stops with optional filters
     * Pass stopId filter to get a specific stop
     */
    getStops(filters?: StopFilters): Stop[];
    /**
     * Get routes with optional filters
     * Pass routeId filter to get a specific route
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
     * Get trips with optional filters
     * Pass tripId filter to get a specific trip
     *
     * @param filters - Optional filters
     * @param filters.tripId - Filter by trip ID (single value or array)
     * @param filters.routeId - Filter by route ID (single value or array)
     * @param filters.date - Filter by date (YYYYMMDD format) - will get active services for that date
     * @param filters.directionId - Filter by direction ID (single value or array)
     * @param filters.agencyId - Filter by agency ID (single value or array)
     * @param filters.limit - Limit number of results
     *
     * @example
     * // Get all trips for a route on a specific date
     * const trips = gtfs.getTrips({ routeId: 'ROUTE_1', date: '20240115' });
     *
     * @example
     * // Get all trips for a route going in one direction
     * const trips = gtfs.getTrips({ routeId: 'ROUTE_1', directionId: 0 });
     *
     * @example
     * // Get a specific trip
     * const trips = gtfs.getTrips({ tripId: 'TRIP_123' });
     */
    getTrips(filters?: TripFilters & {
        date?: string;
    }): Trip[];
    /**
     * Get stop times with optional filters
     *
     * @param filters - Optional filters
     * @param filters.tripId - Filter by trip ID (single value or array)
     * @param filters.stopId - Filter by stop ID (single value or array)
     * @param filters.routeId - Filter by route ID (single value or array)
     * @param filters.date - Filter by date (YYYYMMDD format) - will get active services for that date
     * @param filters.directionId - Filter by direction ID (single value or array)
     * @param filters.agencyId - Filter by agency ID (single value or array)
     * @param filters.includeRealtime - Include realtime data (delay and time fields)
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
     *
     * @example
     * // Get stop times with realtime data
     * const stopTimes = gtfs.getStopTimes({
     *   tripId: 'TRIP_123',
     *   includeRealtime: true
     * });
     */
    getStopTimes(filters?: StopTimeFilters & {
        date?: string;
    }): StopTime[];
    /**
     * Build an ordered list of stops from multiple trips
     *
     * This is useful when you need to display a timetable for a route where different trips
     * may stop at different sets of stops (e.g., express vs local service, or trips with
     * different start/end points).
     *
     * The method intelligently merges stop sequences from all provided trips to create
     * a comprehensive ordered list of all unique stops.
     *
     * @param tripIds - Array of trip IDs to analyze
     * @returns Ordered array of Stop objects representing all unique stops
     *
     * @example
     * // Get all trips for a route going in one direction
     * const trips = gtfs.getTrips({ routeId: 'ROUTE_1', directionId: 0 });
     * const tripIds = trips.map(t => t.trip_id);
     *
     * // Build ordered stop list for all these trips
     * const stops = gtfs.buildOrderedStopList(tripIds);
     *
     * // Now you can display a timetable with all possible stops
     * stops.forEach(stop => {
     *   console.log(stop.stop_name);
     * });
     */
    buildOrderedStopList(tripIds: string[]): Stop[];
    /**
     * Compute itineraries between two stops
     *
     * This method finds possible journeys between two stops, supporting up to 3 transfers
     * by default. It builds a network graph and searches for compatible trip sequences.
     *
     * @param filters - Itinerary search filters
     * @param filters.fromStopId - Origin stop ID
     * @param filters.toStopId - Destination stop ID
     * @param filters.date - Date in YYYYMMDD format
     * @param filters.departureTimeAfter - Minimum departure time in HH:MM:SS format
     * @param filters.departureTimeBefore - Maximum departure time in HH:MM:SS format (optional)
     * @param filters.config - Optional configuration
     * @param filters.config.maxTransfers - Maximum number of transfers (default: 3)
     * @param filters.config.minTransferTime - Minimum transfer time in seconds (default: 300)
     * @param filters.config.maxResults - Maximum number of itineraries to return (default: 5)
     * @param filters.config.maxSearchDepth - Maximum search depth for graph traversal (default: 10)
     * @returns Array of itineraries sorted by earliest arrival time
     *
     * @example
     * // Find itineraries leaving after 8:00 AM
     * const itineraries = gtfs.computeItineraries({
     *   fromStopId: 'STOP_A',
     *   toStopId: 'STOP_B',
     *   date: '20240115',
     *   departureTimeAfter: '08:00:00',
     *   config: {
     *     maxTransfers: 2,
     *     maxResults: 10
     *   }
     * });
     *
     * // Display the itineraries
     * itineraries.forEach(itinerary => {
     *   console.log(`Departure: ${itinerary.departureTime}, Arrival: ${itinerary.arrivalTime}`);
     *   console.log(`Transfers: ${itinerary.numberOfTransfers}`);
     *   itinerary.legs.forEach(leg => {
     *     console.log(`  ${leg.route.route_short_name}: ${leg.fromStop.stop_name} -> ${leg.toStop.stop_name}`);
     *   });
     * });
     */
    computeItineraries(filters: ItinerarySearchFilters): Itinerary[];
    /**
     * Clear the cached network graph
     * Call this if you've updated GTFS data and want to rebuild the graph
     */
    clearItineraryCache(): void;
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
     * Pass alertId filter to get a specific alert
     */
    getAlerts(filters?: AlertFilters): Alert[];
    /**
     * Get vehicle positions with optional filters
     * Pass tripId filter to get vehicle position for a specific trip
     */
    getVehiclePositions(filters?: VehiclePositionFilters): VehiclePosition[];
    /**
     * Get trip updates with optional filters
     * Pass tripId filter to get trip update for a specific trip
     */
    getTripUpdates(filters?: TripUpdateFilters): TripUpdate[];
    /**
     * Get stop time updates with optional filters
     * Pass tripId filter to get stop time updates for a specific trip
     */
    getStopTimeUpdates(filters?: StopTimeUpdateFilters): StopTimeUpdate[];
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
    /**
     * Get cache statistics
     * @param cacheStore - Cache store to query (optional, auto-detects if not provided)
     * @returns Cache statistics including size, entry count, and age information
     */
    static getCacheStats(cacheStore?: CacheStore): Promise<{
        totalEntries: number;
        activeEntries: number;
        expiredEntries: number;
        totalSize: number;
        totalSizeMB: string;
        oldestEntry: number | null;
        newestEntry: number | null;
    }>;
    /**
     * Clean expired cache entries
     * @param cacheStore - Cache store to clean (optional, auto-detects if not provided)
     * @param expirationMs - Expiration time in milliseconds (default: 7 days)
     * @returns Number of entries deleted
     */
    static cleanExpiredCache(cacheStore?: CacheStore, expirationMs?: number): Promise<number>;
    /**
     * Clear all cache entries
     * @param cacheStore - Cache store to clear (optional, auto-detects if not provided)
     */
    static clearCache(cacheStore?: CacheStore): Promise<void>;
    /**
     * List all cache entries
     * @param cacheStore - Cache store to query (optional, auto-detects if not provided)
     * @param includeExpired - Include expired entries (default: false)
     * @returns Array of cache entries with metadata
     */
    static listCache(cacheStore?: CacheStore, includeExpired?: boolean): Promise<CacheEntry[]>;
    /**
     * Get the default cache store for the current environment
     * @returns Default cache store or null if unavailable
     */
    private static getDefaultCacheStore;
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

/**
 * IndexedDB-based cache store for browsers
 *
 * Stores GTFS databases in IndexedDB for fast access on subsequent loads.
 * Suitable for large databases (100s of MB to several GB depending on browser limits).
 *
 * @example
 * ```typescript
 * import { GtfsSqlJs, IndexedDBCacheStore } from 'gtfs-sqljs';
 *
 * const cache = new IndexedDBCacheStore();
 * const gtfs = await GtfsSqlJs.fromZip('gtfs.zip', {
 *   cache,
 *   cacheVersion: '1.0'
 * });
 * ```
 */
declare class IndexedDBCacheStore implements CacheStore {
    private dbName;
    private storeName;
    private version;
    constructor(options?: CacheStoreOptions);
    /**
     * Open IndexedDB connection
     */
    private openDB;
    /**
     * Get a cached database with metadata
     */
    get(key: string): Promise<CacheEntryWithData | null>;
    /**
     * Store a database in cache
     */
    set(key: string, data: ArrayBuffer, metadata: CacheMetadata): Promise<void>;
    /**
     * Check if a cache entry exists
     */
    has(key: string): Promise<boolean>;
    /**
     * Delete a specific cache entry
     */
    delete(key: string): Promise<void>;
    /**
     * Clear all cache entries
     */
    clear(): Promise<void>;
    /**
     * List all cached entries
     */
    list(): Promise<CacheEntry[]>;
}

/**
 * File system-based cache store for Node.js
 *
 * Stores GTFS databases as files on disk for fast access on subsequent loads.
 * Suitable for any size database (limited only by disk space).
 *
 * @example
 * ```typescript
 * import { GtfsSqlJs, FileSystemCacheStore } from 'gtfs-sqljs';
 *
 * const cache = new FileSystemCacheStore({ dir: './.cache/gtfs' });
 * const gtfs = await GtfsSqlJs.fromZip('gtfs.zip', {
 *   cache,
 *   cacheVersion: '1.0'
 * });
 * ```
 */
declare class FileSystemCacheStore implements CacheStore {
    private cacheDir;
    constructor(options?: CacheStoreOptions);
    /**
     * Get the cache directory path (lazy initialization)
     */
    private getCacheDir;
    /**
     * Ensure cache directory exists
     */
    private ensureCacheDir;
    /**
     * Get file path for a cache key
     */
    private getFilePath;
    /**
     * Get metadata file path for a cache key
     */
    private getMetadataPath;
    /**
     * Get a cached database with metadata
     */
    get(key: string): Promise<CacheEntryWithData | null>;
    /**
     * Store a database in cache
     */
    set(key: string, data: ArrayBuffer, metadata: CacheMetadata): Promise<void>;
    /**
     * Check if a cache entry exists
     */
    has(key: string): Promise<boolean>;
    /**
     * Delete a specific cache entry
     */
    delete(key: string): Promise<void>;
    /**
     * Clear all cache entries
     */
    clear(): Promise<void>;
    /**
     * List all cached entries
     */
    list(): Promise<CacheEntry[]>;
}

/**
 * Compute SHA-256 checksum of data
 * Uses Web Crypto API (available in both browser and Node.js 18+)
 */
declare function computeChecksum(data: ArrayBuffer | Uint8Array): Promise<string>;
/**
 * Compute checksum for a zip file
 * @param zipData - The zip file data (ArrayBuffer or Uint8Array)
 * @returns SHA-256 checksum as hex string
 */
declare function computeZipChecksum(zipData: ArrayBuffer | Uint8Array): Promise<string>;
/**
 * Generate a cache key from checksum, version, filesize, source, and options
 * Format: v{libVersion}_{dataVersion}_{filesize}_{checksum}_{source}_{skipFiles}
 *
 * @param checksum - SHA-256 checksum of zip file
 * @param libVersion - Library version from package.json
 * @param dataVersion - User-specified data version
 * @param filesize - Size of the zip file in bytes
 * @param source - Source URL or filename (optional)
 * @param skipFiles - Files that were skipped during import
 * @returns Cache key string
 */
declare function generateCacheKey(checksum: string, libVersion: string, dataVersion: string, filesize: number, source?: string, skipFiles?: string[]): string;

/**
 * Default cache expiration time in milliseconds (7 days)
 */
declare const DEFAULT_CACHE_EXPIRATION_MS: number;
/**
 * Check if a cache entry is expired
 * @param metadata - Cache metadata
 * @param expirationMs - Expiration time in milliseconds (default: 7 days)
 * @returns true if the cache entry is expired
 */
declare function isCacheExpired(metadata: CacheMetadata, expirationMs?: number): boolean;
/**
 * Filter out expired cache entries
 * @param entries - Array of cache entries
 * @param expirationMs - Expiration time in milliseconds (default: 7 days)
 * @returns Filtered array of non-expired entries
 */
declare function filterExpiredEntries(entries: CacheEntry[], expirationMs?: number): CacheEntry[];
/**
 * Get cache statistics
 * @param entries - Array of cache entries
 * @returns Cache statistics
 */
declare function getCacheStats(entries: CacheEntry[]): {
    totalEntries: number;
    activeEntries: number;
    expiredEntries: number;
    totalSize: number;
    totalSizeMB: string;
    oldestEntry: number | null;
    newestEntry: number | null;
};

export { type Agency, type AgencyFilters, type Alert, AlertCause, AlertEffect, type AlertFilters, type Attribution, type CacheEntry, type CacheEntryWithData, type CacheMetadata, type CacheStore, type CacheStoreOptions, type Calendar, type CalendarDate, type ColumnDefinition, CongestionLevel, DEFAULT_CACHE_EXPIRATION_MS, type EntitySelector, type FareAttribute, type FareRule, type FeedInfo, FileSystemCacheStore, type Frequency, GTFS_SCHEMA, GtfsSqlJs, type GtfsSqlJsOptions, type IndexDefinition, IndexedDBCacheStore, type Level, OccupancyStatus, type Pathway, type Position, type RealtimeConfig, type Route, type RouteFilters, ScheduleRelationship, type Shape, type Stop, type StopFilters, type StopTime, type StopTimeEvent, type StopTimeFilters, type StopTimeRealtime, type StopTimeUpdate, type StopTimeUpdateFilters, type StopTimeUpdateWithMetadata, type StopTimeWithRealtime, type TableSchema, type TimeRange, type Transfer$1 as Transfer, type TranslatedString, type Trip, type TripFilters, type TripRealtime, type TripUpdate, type TripUpdateFilters, type TripWithRealtime, type VehicleDescriptor, type VehiclePosition, type VehiclePositionFilters, VehicleStopStatus, computeChecksum, computeZipChecksum, filterExpiredEntries, generateCacheKey, getCacheStats, isCacheExpired };
