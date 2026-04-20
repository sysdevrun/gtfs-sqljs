/**
 * Adapter types for pluggable database backends.
 *
 * gtfs-sqljs defines a narrow, async surface that any SQLite driver can
 * satisfy (sql.js, better-sqlite3, op-sqlite, expo-sqlite, …). The core
 * library no longer imports sql.js directly; consumers pick an adapter and
 * either pass a factory (`GtfsDatabaseAdapter`) into `fromZip` / `fromDatabase`
 * or hand in a pre-opened `GtfsDatabase` via `GtfsSqlJs.attach()`.
 */

export type SqlValue = string | number | null | Uint8Array;
export type Row = Record<string, SqlValue>;

export interface GtfsStatement {
  /** Bind positional parameters. May be called once per execution. */
  bind(params: SqlValue[]): Promise<void>;
  /** Advance cursor. Resolves true if a row is available. */
  step(): Promise<boolean>;
  /** Materialize current row as an object keyed by column name. */
  getAsObject(): Promise<Row>;
  /** Execute an INSERT/UPDATE/DELETE with parameters, no cursor needed. */
  run(params?: SqlValue[]): Promise<void>;
  /** Release native resources. Called after every prepare(). */
  free(): Promise<void>;
}

export interface GtfsDatabase {
  /** Prepare a SQL statement for repeated execution. */
  prepare(sql: string): Promise<GtfsStatement>;
  /** Execute a one-shot SQL string (PRAGMA, DDL, transaction control). */
  run(sql: string): Promise<void>;
  /**
   * Serialize the database to a byte buffer.
   * File-backed drivers should throw `ExportNotSupportedError`.
   */
  export(): Promise<Uint8Array>;
  /** Close and release the database. */
  close(): Promise<void>;
}

/**
 * Factory used by flows that need the library to create / load a DB on the
 * caller's behalf (fromZip, fromDatabase). Not needed for `attach()`.
 */
export interface GtfsDatabaseAdapter {
  /** Create an empty database (used by fromZip / fromZipData). */
  createEmpty(): Promise<GtfsDatabase>;
  /**
   * Open an existing database from a byte buffer (used by fromDatabase).
   * File-backed drivers that cannot load bytes into a fresh DB may throw.
   */
  openFromBuffer(buffer: ArrayBuffer | Uint8Array): Promise<GtfsDatabase>;
}

/**
 * Thrown by adapters whose underlying driver cannot serialize the database
 * to an in-memory byte buffer (op-sqlite, expo-sqlite, better-sqlite3 against
 * a file path). Callers that catch this can treat the database as
 * non-exportable; the cache layer no-ops when it sees this error.
 */
export class ExportNotSupportedError extends Error {
  constructor(message = 'export() is not supported by this adapter') {
    super(message);
    this.name = 'ExportNotSupportedError';
  }
}
