/**
 * better-sqlite3 adapter for gtfs-sqljs.
 *
 * Ships as an opt-in subpath export (`gtfs-sqljs/adapters/better-sqlite3`).
 * This is the only file in the repository that imports `better-sqlite3`, so
 * projects that never reference this subpath do not pull in the native
 * module.
 *
 * Typical usage (caller-managed DB, recommended for file-backed drivers):
 *
 * ```ts
 * import Database from 'better-sqlite3';
 * import { GtfsSqlJs } from 'gtfs-sqljs';
 * import { wrapBetterSqlite3 } from 'gtfs-sqljs/adapters/better-sqlite3';
 *
 * const raw = new Database('gtfs.db');
 * const gtfs = await GtfsSqlJs.attach(wrapBetterSqlite3(raw));
 * ```
 *
 * Library-managed usage (in-memory, less common):
 *
 * ```ts
 * import { GtfsSqlJs } from 'gtfs-sqljs';
 * import { createBetterSqlite3Adapter } from 'gtfs-sqljs/adapters/better-sqlite3';
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
} from '../types';

type BetterSqlite3Database = BetterSqlite3.Database;

type StatementState = {
  stmt: BetterSqlite3.Statement;
  iterator: IterableIterator<unknown> | null;
  currentRow: Row | null;
  boundParams: SqlValue[] | null;
};

function wrapStatement(db: BetterSqlite3Database, sql: string): GtfsStatement {
  const state: StatementState = {
    stmt: db.prepare(sql),
    iterator: null,
    currentRow: null,
    boundParams: null,
  };

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
      // better-sqlite3 statements are GC-managed; no explicit release needed.
    },
  };
}

/**
 * Wrap an already-open `better-sqlite3` database handle as a `GtfsDatabase`.
 * Pair with `GtfsSqlJs.attach()` — the caller retains ownership of the raw
 * handle unless `ownsDatabase: true` is passed.
 */
export function wrapBetterSqlite3(db: BetterSqlite3Database): GtfsDatabase {
  return {
    prepare: async (sql) => wrapStatement(db, sql),
    run: async (sql) => {
      db.exec(sql);
    },
    export: async () => {
      // `serialize()` only works on in-memory databases (better-sqlite3 ≥ 10).
      // File-backed DBs persist themselves on disk; the library's cache layer
      // catches this error and no-ops.
      const serialize = (db as unknown as { serialize?: () => Buffer }).serialize;
      if (typeof serialize === 'function') {
        const buf = serialize.call(db);
        return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
      }
      throw new ExportNotSupportedError(
        'better-sqlite3 cannot serialize this database. Read the underlying ' +
        'file on disk directly to persist it.'
      );
    },
    close: async () => {
      db.close();
    },
  };
}

/**
 * Factory for the library-managed path (`fromZip` / `fromZipData` /
 * `fromDatabase`). `filename` defaults to `:memory:`; pass a path to have the
 * adapter create / open a file-backed database.
 */
export function createBetterSqlite3Adapter(
  filename: string = ':memory:',
  options?: BetterSqlite3.Options
): GtfsDatabaseAdapter {
  return {
    createEmpty: async () => wrapBetterSqlite3(new BetterSqlite3(filename, options)),
    openFromBuffer: async (buf) => {
      // better-sqlite3 accepts a Buffer as the first argument and loads the
      // database bytes into an in-memory connection. The typings still say
      // `string`, so we cast through `unknown`.
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
  return params.map((p) => {
    if (p instanceof Uint8Array) {
      return Buffer.from(p.buffer, p.byteOffset, p.byteLength);
    }
    return p;
  });
}
