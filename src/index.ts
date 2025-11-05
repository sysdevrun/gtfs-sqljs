/**
 * gtfs-sqljs - Load GTFS data into sql.js SQLite database
 * @author Théophile Helleboid/SysDevRun
 * @license MIT
 */

export { GtfsSqlJs, type GtfsSqlJsOptions } from './gtfs-sqljs';

// Export types
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

// Export schema definitions for advanced use
export { GTFS_SCHEMA, type TableSchema, type ColumnDefinition, type IndexDefinition } from './schema/schema';
