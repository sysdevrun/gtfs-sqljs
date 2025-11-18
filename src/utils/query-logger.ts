import type { Database, Statement, BindParams } from 'sql.js';

/**
 * Information about a SQL query execution
 */
export interface QueryLogEntry {
  sql: string;
  params?: BindParams;
  executionTimeMs: number;
  rowsAffected?: number;
  timestamp: number;
}

/**
 * Wraps a sql.js Database to log all SQL queries to the console
 * @param db - The sql.js Database instance to wrap
 * @returns A proxied Database that logs all queries
 */
export function wrapDatabaseWithLogger(db: Database): Database {
  const logQuery = (entry: QueryLogEntry): void => {
    const hasParams = entry.params != null &&
      ((Array.isArray(entry.params) && entry.params.length > 0) ||
       (!Array.isArray(entry.params) && Object.keys(entry.params).length > 0));
    const paramsStr = hasParams
      ? ` | params: ${JSON.stringify(entry.params)}`
      : '';
    const rowsStr = entry.rowsAffected !== undefined
      ? ` | ${entry.rowsAffected} rows`
      : '';
    const sql = entry.sql.replace(/\s+/g, ' ').trim();
    console.log(`[GTFS-SQL] ${sql}${paramsStr} | ${entry.executionTimeMs.toFixed(2)}ms${rowsStr}`);
  };

  // Wrap the Statement object to log when run() or step() is called
  const wrapStatement = (stmt: Statement, sql: string, params?: BindParams): Statement => {
    const originalRun = stmt.run.bind(stmt);
    const originalStep = stmt.step.bind(stmt);
    const originalBind = stmt.bind.bind(stmt);

    let boundParams: BindParams | undefined = params;
    let stepCount = 0;
    let hasStartedStepping = false;

    // Wrap bind() to capture parameters
    stmt.bind = function(values?: BindParams): boolean {
      boundParams = values;
      return originalBind(values);
    };

    // Wrap run() to log execution
    stmt.run = function(values?: BindParams): void {
      const runParams = values !== undefined ? values : boundParams;
      const start = Date.now();
      originalRun(values);
      const executionTime = Date.now() - start;

      logQuery({
        sql,
        params: runParams,
        executionTimeMs: executionTime,
        rowsAffected: stmt.getAsObject() ? 1 : undefined,
        timestamp: start,
      });
    };

    // Wrap step() to log when iteration completes
    stmt.step = function(): boolean {
      if (!hasStartedStepping) {
        hasStartedStepping = true;
        stepCount = 0;
      }

      const start = Date.now();
      const hasRow = originalStep();
      const executionTime = Date.now() - start;

      if (hasRow) {
        stepCount++;
      } else {
        // Finished stepping through all rows, log the query
        logQuery({
          sql,
          params: boundParams,
          executionTimeMs: executionTime,
          rowsAffected: stepCount,
          timestamp: start,
        });
      }

      return hasRow;
    };

    return stmt;
  };

  // Create a proxy to intercept database methods
  return new Proxy(db, {
    get(target, prop, receiver) {
      const original = Reflect.get(target, prop, receiver);

      // Intercept run() method
      if (prop === 'run') {
        return function(sql: string): void {
          const start = Date.now();
          const result = original.call(target, sql);
          const executionTime = Date.now() - start;

          logQuery({
            sql,
            executionTimeMs: executionTime,
            timestamp: start,
          });

          return result;
        };
      }

      // Intercept exec() method
      if (prop === 'exec') {
        return function(sql: string): unknown[] {
          const start = Date.now();
          const result = original.call(target, sql);
          const executionTime = Date.now() - start;

          logQuery({
            sql,
            executionTimeMs: executionTime,
            rowsAffected: Array.isArray(result) ? result.length : undefined,
            timestamp: start,
          });

          return result;
        };
      }

      // Intercept prepare() method to wrap the returned Statement
      if (prop === 'prepare') {
        return function(sql: string, params?: BindParams): Statement {
          const stmt = original.call(target, sql, params);
          return wrapStatement(stmt, sql, params);
        };
      }

      // Return original property for everything else
      return original;
    },
  });
}
