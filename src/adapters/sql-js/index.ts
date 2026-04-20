/**
 * sql.js adapter for gtfs-sqljs.
 *
 * This module is the only file in the repository that imports `sql.js`. It
 * ships as an opt-in subpath export (`gtfs-sqljs/adapters/sql-js`) so that
 * consumers picking a different driver (op-sqlite, expo-sqlite,
 * better-sqlite3, …) never pay the cost of bundling sql.js.
 */

import initSqlJs, {
  type SqlJsStatic,
  type Database as SqlJsDatabase,
  type Statement as SqlJsStatement,
} from 'sql.js';
import type {
  GtfsDatabaseAdapter,
  GtfsDatabase,
  GtfsStatement,
  Row,
  SqlValue,
} from '../types';

export interface SqlJsAdapterOptions {
  /** Optional pre-initialized SqlJsStatic. Skips `initSqlJs()` when provided. */
  SQL?: SqlJsStatic;
  /** Optional WASM locator passed to `initSqlJs({ locateFile })`. */
  locateFile?: (filename: string) => string;
}

function wrapStatement(stmt: SqlJsStatement): GtfsStatement {
  return {
    bind: async (params) => {
      stmt.bind(params as SqlValue[]);
    },
    step: async () => stmt.step(),
    getAsObject: async () => stmt.getAsObject() as Row,
    run: async (params) => {
      stmt.run(params as SqlValue[] | undefined);
    },
    free: async () => {
      stmt.free();
    },
  };
}

export function wrapSqlJsDatabase(db: SqlJsDatabase): GtfsDatabase {
  return {
    prepare: async (sql) => wrapStatement(db.prepare(sql)),
    run: async (sql) => {
      db.run(sql);
    },
    export: async () => db.export(),
    close: async () => {
      db.close();
    },
  };
}

export async function createSqlJsAdapter(
  opts: SqlJsAdapterOptions = {}
): Promise<GtfsDatabaseAdapter> {
  const SQL =
    opts.SQL ||
    (await initSqlJs(opts.locateFile ? { locateFile: opts.locateFile } : {}));

  return {
    createEmpty: async () => wrapSqlJsDatabase(new SQL.Database()),
    openFromBuffer: async (buf) =>
      wrapSqlJsDatabase(
        new SQL.Database(buf instanceof Uint8Array ? buf : new Uint8Array(buf))
      ),
  };
}
