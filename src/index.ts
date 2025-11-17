/**
 * gtfs-sqljs - Load GTFS data into sql.js SQLite database
 * @author Théophile Helleboid/SysDevRun
 * @license MIT
 */

export {
  GtfsSqlJs,
  type GtfsSqlJsOptions,
  type AgencyFilters,
  type StopFilters,
  type RouteFilters,
  type TripFilters,
  type StopTimeFilters,
  type AlertFilters,
  type VehiclePositionFilters,
  type TripUpdateFilters,
  type StopTimeUpdateFilters,
  type Alert,
  type VehiclePosition,
  type TripUpdate,
  type TripWithRealtime,
  type StopTimeWithRealtime
} from './gtfs-sqljs';

// Export GTFS types
export type {
  Agency,
  Stop,
  Route,
  Trip,
  StopTime,
  Calendar,
  CalendarDate,
  FareAttribute,
  FareRule,
  Shape,
  Frequency,
  Transfer,
  Pathway,
  Level,
  FeedInfo,
  Attribution,
} from './types/gtfs';

// Export GTFS-RT types
export type {
  TranslatedString,
  EntitySelector,
  TimeRange,
  Position,
  VehicleDescriptor,
  StopTimeEvent,
  StopTimeUpdate,
  StopTimeRealtime,
  TripRealtime,
  RealtimeConfig
} from './types/gtfs-rt';

// Export GTFS-RT enums
export {
  ScheduleRelationship,
  VehicleStopStatus,
  CongestionLevel,
  OccupancyStatus,
  AlertCause,
  AlertEffect
} from './types/gtfs-rt';

// Export schema definitions for advanced use
export { GTFS_SCHEMA, type TableSchema, type ColumnDefinition, type IndexDefinition } from './schema/schema';

// Export cache types and interfaces
export type {
  CacheStore,
  CacheMetadata,
  CacheEntry,
  CacheEntryWithData,
  CacheStoreOptions
} from './cache/types';

// Export cache store implementations
export { IndexedDBCacheStore } from './cache/indexeddb-store';
export { FileSystemCacheStore } from './cache/fs-store';

// Export cache utilities
export { computeChecksum, computeZipChecksum, generateCacheKey } from './cache/checksum';
export { isCacheExpired, filterExpiredEntries, getCacheStats, DEFAULT_CACHE_EXPIRATION_MS } from './cache/utils';
