/**
 * better-sqlite3 adapter for gtfs-sqljs.
 *
 * Reference implementation. Copy into your project and import directly, or
 * re-export from your own module. `better-sqlite3` stays in your
 * dependencies — gtfs-sqljs does not depend on it at runtime.
 *
 * Usage (caller-managed DB, recommended for file-backed drivers):
 *
 * ```ts
 * import Database from 'better-sqlite3';
 * import { GtfsSqlJs } from 'gtfs-sqljs';
 * import { wrapBetterSqlite3 } from './examples/adapters/BetterSqlite3Adapter';
 *
 * const raw = new Database('gtfs.db');
 * const gtfs = await GtfsSqlJs.attach(wrapBetterSqlite3(raw));
 * ```
 *
 * Usage (library-managed, in-memory — less common):
 *
 * ```ts
 * import { GtfsSqlJs } from 'gtfs-sqljs';
 * import { createBetterSqlite3Adapter } from './examples/adapters/BetterSqlite3Adapter';
 *
 * const gtfs = await GtfsSqlJs.fromZip(url, {
 *   adapter: createBetterSqlite3Adapter(),
 * });
 * ```
 */

import BetterSqlite3 from 'better-sqlite3';
import {
  ExportNotSupportedError,
  type GtfsDatabase,
  type GtfsDatabaseAdapter,
  type GtfsStatement,
  type Row,
  type SqlValue,
} from 'gtfs-sqljs';

type BetterSqlite3Database = BetterSqlite3.Database;

type StatementState = {
  stmt: BetterSqlite3.Statement;
  iterator: IterableIterator<unknown> | null;
  currentRow: Row | null;
  boundParams: SqlValue[] | null;
};

function wrapStatement(
  db: BetterSqlite3Database,
  sql: string
): GtfsStatement {
  const state: StatementState = {
    stmt: db.prepare(sql),
    iterator: null,
    currentRow: null,
    boundParams: null,
  };

  // better-sqlite3 switches on whether the statement returns rows.
  // `pluck(false)` + `raw(false)` is the default object-row mode we want.
  try {
    state.stmt.raw(false);
  } catch {
    // Non-SELECT statements throw; harmless.
  }

  const resetIterator = () => {
    state.iterator = null;
    state.currentRow = null;
  };

  return {
    bind: async (params) => {
      state.boundParams = params;
      resetIterator();
    },
    step: async () => {
      if (!state.iterator) {
        const params = state.boundParams ?? [];
        state.iterator = state.stmt.iterate(...toPositionalArgs(params));
      }
      const next = state.iterator.next();
      if (next.done) {
        state.currentRow = null;
        return false;
      }
      state.currentRow = next.value as Row;
      return true;
    },
    getAsObject: async () => state.currentRow ?? {},
    run: async (params) => {
      state.stmt.run(...toPositionalArgs(params ?? []));
      resetIterator();
    },
    free: async () => {
      resetIterator();
      // better-sqlite3 statements are garbage-collected; nothing to free.
    },
  };
}

export function wrapBetterSqlite3(db: BetterSqlite3Database): GtfsDatabase {
  return {
    prepare: async (sql) => wrapStatement(db, sql),
    run: async (sql) => {
      db.exec(sql);
    },
    export: async () => {
      // better-sqlite3 can only serialize in-memory databases, and only in
      // versions ≥10. For a file-backed DB the caller should read the file.
      const serialize = (db as unknown as { serialize?: () => Buffer }).serialize;
      if (typeof serialize === 'function') {
        const buf = serialize.call(db);
        return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
      }
      throw new ExportNotSupportedError(
        'better-sqlite3 does not support in-memory serialization for this database. ' +
        'Read the underlying file on disk directly to persist it.'
      );
    },
    close: async () => {
      db.close();
    },
  };
}

export function createBetterSqlite3Adapter(
  filename: string = ':memory:',
  options?: BetterSqlite3.Options
): GtfsDatabaseAdapter {
  return {
    createEmpty: async () => wrapBetterSqlite3(new BetterSqlite3(filename, options)),
    openFromBuffer: async (buf) => {
      // better-sqlite3 accepts a Buffer as the first argument and loads the
      // database bytes into an in-memory connection.
      const data = buf instanceof Uint8Array
        ? Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength)
        : Buffer.from(new Uint8Array(buf));
      const db = new (BetterSqlite3 as unknown as new (
        b: Buffer,
        o?: BetterSqlite3.Options
      ) => BetterSqlite3Database)(data, options);
      return wrapBetterSqlite3(db);
    },
  };
}

function toPositionalArgs(params: SqlValue[]): unknown[] {
  // better-sqlite3 expects rest-args, and does not accept `undefined` — we
  // pass nulls through and coerce Uint8Array to Buffer for BLOBs.
  return params.map((p) => {
    if (p instanceof Uint8Array) {
      return Buffer.from(p.buffer, p.byteOffset, p.byteLength);
    }
    return p;
  });
}
