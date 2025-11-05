/**
 * Tests for Schema Generation
 */

import { describe, it, expect } from 'vitest';
import {
  generateCreateTableSQL,
  generateCreateIndexSQL,
  getAllCreateStatements,
  GTFS_SCHEMA,
} from '../src/schema/schema';

describe('Schema', () => {
  describe('generateCreateTableSQL', () => {
    it('should generate CREATE TABLE statement with primary key', () => {
      const schema = {
        name: 'test_table',
        columns: [
          { name: 'id', type: 'TEXT' as const, required: true, primaryKey: true },
          { name: 'name', type: 'TEXT' as const, required: true },
          { name: 'value', type: 'INTEGER' as const, required: false },
        ],
      };

      const sql = generateCreateTableSQL(schema);

      expect(sql).toContain('CREATE TABLE IF NOT EXISTS test_table');
      expect(sql).toContain('id TEXT PRIMARY KEY');
      expect(sql).toContain('name TEXT NOT NULL');
      expect(sql).toContain('value INTEGER');
      expect(sql).not.toContain('value INTEGER NOT NULL');
    });

    it('should handle REAL type', () => {
      const schema = {
        name: 'test_table',
        columns: [
          { name: 'id', type: 'TEXT' as const, required: true, primaryKey: true },
          { name: 'latitude', type: 'REAL' as const, required: true },
        ],
      };

      const sql = generateCreateTableSQL(schema);

      expect(sql).toContain('latitude REAL NOT NULL');
    });
  });

  describe('generateCreateIndexSQL', () => {
    it('should generate CREATE INDEX statements', () => {
      const schema = {
        name: 'test_table',
        columns: [{ name: 'id', type: 'TEXT' as const, required: true, primaryKey: true }],
        indexes: [
          { name: 'idx_test_name', columns: ['name'] },
          { name: 'idx_test_composite', columns: ['field1', 'field2'] },
        ],
      };

      const statements = generateCreateIndexSQL(schema);

      expect(statements).toHaveLength(2);
      expect(statements[0]).toContain('CREATE INDEX IF NOT EXISTS idx_test_name ON test_table (name)');
      expect(statements[1]).toContain('CREATE INDEX IF NOT EXISTS idx_test_composite ON test_table (field1, field2)');
    });

    it('should generate UNIQUE index when specified', () => {
      const schema = {
        name: 'test_table',
        columns: [{ name: 'id', type: 'TEXT' as const, required: true, primaryKey: true }],
        indexes: [{ name: 'idx_test_unique', columns: ['code'], unique: true }],
      };

      const statements = generateCreateIndexSQL(schema);

      expect(statements[0]).toContain('CREATE UNIQUE INDEX');
    });

    it('should return empty array when no indexes', () => {
      const schema = {
        name: 'test_table',
        columns: [{ name: 'id', type: 'TEXT' as const, required: true, primaryKey: true }],
      };

      const statements = generateCreateIndexSQL(schema);

      expect(statements).toEqual([]);
    });
  });

  describe('getAllCreateStatements', () => {
    it('should generate all GTFS table creation statements', () => {
      const statements = getAllCreateStatements();

      expect(statements.length).toBeGreaterThan(0);

      // Check that key tables are included
      expect(statements.some((s) => s.includes('CREATE TABLE IF NOT EXISTS stops'))).toBe(true);
      expect(statements.some((s) => s.includes('CREATE TABLE IF NOT EXISTS routes'))).toBe(true);
      expect(statements.some((s) => s.includes('CREATE TABLE IF NOT EXISTS trips'))).toBe(true);
      expect(statements.some((s) => s.includes('CREATE TABLE IF NOT EXISTS stop_times'))).toBe(true);
      expect(statements.some((s) => s.includes('CREATE TABLE IF NOT EXISTS calendar'))).toBe(true);
    });

    it('should include index creation statements', () => {
      const statements = getAllCreateStatements();

      // Check that indexes are included
      expect(statements.some((s) => s.includes('CREATE INDEX'))).toBe(true);
    });
  });

  describe('GTFS_SCHEMA', () => {
    it('should have required GTFS tables', () => {
      const tableNames = GTFS_SCHEMA.map((s) => s.name);

      expect(tableNames).toContain('agency');
      expect(tableNames).toContain('stops');
      expect(tableNames).toContain('routes');
      expect(tableNames).toContain('trips');
      expect(tableNames).toContain('stop_times');
      expect(tableNames).toContain('calendar');
      expect(tableNames).toContain('calendar_dates');
    });

    it('should have correct required fields for stops', () => {
      const stopsSchema = GTFS_SCHEMA.find((s) => s.name === 'stops');

      expect(stopsSchema).toBeDefined();

      const requiredColumns = stopsSchema!.columns.filter((c) => c.required).map((c) => c.name);
      const optionalColumns = stopsSchema!.columns.filter((c) => !c.required).map((c) => c.name);

      // Required fields
      expect(requiredColumns).toContain('stop_id');
      expect(requiredColumns).toContain('stop_name');
      expect(requiredColumns).toContain('stop_lat');
      expect(requiredColumns).toContain('stop_lon');

      // Optional fields
      expect(optionalColumns).toContain('stop_code');
      expect(optionalColumns).toContain('stop_desc');
    });

    it('should have correct required fields for routes', () => {
      const routesSchema = GTFS_SCHEMA.find((s) => s.name === 'routes');

      expect(routesSchema).toBeDefined();

      const requiredColumns = routesSchema!.columns.filter((c) => c.required).map((c) => c.name);

      // Required fields
      expect(requiredColumns).toContain('route_id');
      expect(requiredColumns).toContain('route_short_name');
      expect(requiredColumns).toContain('route_long_name');
      expect(requiredColumns).toContain('route_type');
    });
  });
});
