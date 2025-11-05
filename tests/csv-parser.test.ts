/**
 * Tests for CSV Parser
 */

import { describe, it, expect } from 'vitest';
import { parseCSV, convertRowTypes } from '../src/loaders/csv-parser';

describe('CSV Parser', () => {
  describe('parseCSV', () => {
    it('should parse simple CSV', () => {
      const csv = `name,age,city
John,30,NYC
Jane,25,LA`;

      const result = parseCSV(csv);

      expect(result.headers).toEqual(['name', 'age', 'city']);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]).toEqual({ name: 'John', age: '30', city: 'NYC' });
      expect(result.rows[1]).toEqual({ name: 'Jane', age: '25', city: 'LA' });
    });

    it('should handle quoted values', () => {
      const csv = `name,description
"John Doe","A person with a comma, in description"
"Jane Smith","Another ""quoted"" value"`;

      const result = parseCSV(csv);

      expect(result.rows[0].description).toBe('A person with a comma, in description');
      expect(result.rows[1].description).toBe('Another "quoted" value');
    });

    it('should handle empty fields', () => {
      const csv = `id,name,code
1,Stop A,
2,,CODE2
3,Stop C,CODE3`;

      const result = parseCSV(csv);

      expect(result.rows[0].code).toBe('');
      expect(result.rows[1].name).toBe('');
    });

    it('should handle CRLF line endings', () => {
      const csv = "id,name\r\n1,First\r\n2,Second";

      const result = parseCSV(csv);

      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]).toEqual({ id: '1', name: 'First' });
    });

    it('should filter out empty lines', () => {
      const csv = `id,name
1,First

2,Second
`;

      const result = parseCSV(csv);

      expect(result.rows).toHaveLength(2);
    });

    it('should return empty result for empty input', () => {
      const result = parseCSV('');

      expect(result.headers).toEqual([]);
      expect(result.rows).toEqual([]);
    });
  });

  describe('convertRowTypes', () => {
    it('should convert INTEGER types', () => {
      const row = { id: '123', count: '456' };
      const types = { id: 'INTEGER' as const, count: 'INTEGER' as const };

      const result = convertRowTypes(row, types);

      expect(result.id).toBe(123);
      expect(result.count).toBe(456);
    });

    it('should convert REAL types', () => {
      const row = { lat: '40.7128', lon: '-74.0060' };
      const types = { lat: 'REAL' as const, lon: 'REAL' as const };

      const result = convertRowTypes(row, types);

      expect(result.lat).toBe(40.7128);
      expect(result.lon).toBe(-74.006);
    });

    it('should keep TEXT types as strings', () => {
      const row = { name: 'Test', code: 'ABC123' };
      const types = { name: 'TEXT' as const, code: 'TEXT' as const };

      const result = convertRowTypes(row, types);

      expect(result.name).toBe('Test');
      expect(result.code).toBe('ABC123');
    });

    it('should convert empty strings to null', () => {
      const row = { name: 'Test', code: '' };
      const types = { name: 'TEXT' as const, code: 'TEXT' as const };

      const result = convertRowTypes(row, types);

      expect(result.name).toBe('Test');
      expect(result.code).toBeNull();
    });

    it('should handle invalid numbers', () => {
      const row = { count: 'invalid', value: 'NaN' };
      const types = { count: 'INTEGER' as const, value: 'REAL' as const };

      const result = convertRowTypes(row, types);

      expect(result.count).toBeNull();
      expect(result.value).toBeNull();
    });
  });
});
