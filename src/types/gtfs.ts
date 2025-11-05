/**
 * GTFS Type Definitions
 * Based on GTFS Reference: https://gtfs.org/schedule/reference/
 */

/**
 * Agency - One or more transit agencies that provide the data in this feed
 */
export interface Agency {
  // Required fields
  agency_id: string;
  agency_name: string;
  agency_url: string;
  agency_timezone: string;

  // Optional fields
  agency_lang?: string;
  agency_phone?: string;
  agency_fare_url?: string;
  agency_email?: string;
}

/**
 * Stop - Individual locations where vehicles pick up or drop off riders
 */
export interface Stop {
  // Required fields
  stop_id: string;
  stop_name: string;
  stop_lat: number;
  stop_lon: number;

  // Optional fields
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
export interface Route {
  // Required fields
  route_id: string;
  route_short_name: string;
  route_long_name: string;
  route_type: number;

  // Optional fields
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
export interface Trip {
  // Required fields
  route_id: string;
  service_id: string;
  trip_id: string;

  // Optional fields
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
export interface StopTime {
  // Required fields
  trip_id: string;
  arrival_time: string;
  departure_time: string;
  stop_id: string;
  stop_sequence: number;

  // Optional fields
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
export interface Calendar {
  // Required fields
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
export interface CalendarDate {
  // Required fields
  service_id: string;
  date: string;
  exception_type: number;
}

/**
 * FareAttribute - Fare information for a transit agency's routes
 */
export interface FareAttribute {
  // Required fields
  fare_id: string;
  price: number;
  currency_type: string;
  payment_method: number;
  transfers: number;

  // Optional fields
  agency_id?: string;
  transfer_duration?: number;
}

/**
 * FareRule - Rules for applying fares for itineraries
 */
export interface FareRule {
  // Required fields
  fare_id: string;

  // Optional fields
  route_id?: string;
  origin_id?: string;
  destination_id?: string;
  contains_id?: string;
}

/**
 * Shape - Rules for mapping vehicle travel paths
 */
export interface Shape {
  // Required fields
  shape_id: string;
  shape_pt_lat: number;
  shape_pt_lon: number;
  shape_pt_sequence: number;

  // Optional fields
  shape_dist_traveled?: number;
}

/**
 * Frequency - Headway-based service patterns
 */
export interface Frequency {
  // Required fields
  trip_id: string;
  start_time: string;
  end_time: string;
  headway_secs: number;

  // Optional fields
  exact_times?: number;
}

/**
 * Transfer - Rules for making connections at transfer points
 */
export interface Transfer {
  // Required fields
  from_stop_id: string;
  to_stop_id: string;
  transfer_type: number;

  // Optional fields
  min_transfer_time?: number;
}

/**
 * Pathway - Pathways linking together locations within stations
 */
export interface Pathway {
  // Required fields
  pathway_id: string;
  from_stop_id: string;
  to_stop_id: string;
  pathway_mode: number;
  is_bidirectional: number;

  // Optional fields
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
export interface Level {
  // Required fields
  level_id: string;
  level_index: number;

  // Optional fields
  level_name?: string;
}

/**
 * FeedInfo - Information about the dataset itself
 */
export interface FeedInfo {
  // Required fields
  feed_publisher_name: string;
  feed_publisher_url: string;
  feed_lang: string;

  // Optional fields
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
export interface Attribution {
  // Required fields
  attribution_id: string;
  organization_name: string;

  // Optional fields
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
