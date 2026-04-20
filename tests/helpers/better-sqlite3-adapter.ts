/**
 * Test-local copy of `examples/adapters/BetterSqlite3Adapter.ts` that imports
 * from the in-repo source tree instead of the published `gtfs-sqljs` package.
 *
 * The published example is what consumers should copy; this file exists so
 * that the end-to-end test can exercise the exact same adapter surface
 * without any build step.
 */

import BetterSqlite3 from 'better-sqlite3';
import {
  ExportNotSupportedError,
  type GtfsDatabase,
  type GtfsDatabaseAdapter,
  type GtfsStatement,
  type Row,
  type SqlValue,
} from '../../src/adapters/types';

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
      const serialize = (db as unknown as { serialize?: () => Buffer }).serialize;
      if (typeof serialize === 'function') {
        const buf = serialize.call(db);
        return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
      }
      throw new ExportNotSupportedError(
        'better-sqlite3 does not expose serialize() on this database.'
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
      const data = buf instanceof Uint8Array
        ? Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength)
        : Buffer.from(new Uint8Array(buf));
      // better-sqlite3 accepts a Buffer as the first arg to load from bytes
      // (documented form; its typings still say `string` here).
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
