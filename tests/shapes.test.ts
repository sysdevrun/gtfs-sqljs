/**
 * Tests for getShapes and getShapesToGeojson methods
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import initSqlJs from 'sql.js';
import { GtfsSqlJs } from '../src/gtfs-sqljs';
import { createTestDatabase } from './helpers/test-database';

describe('Shape methods', () => {
  let gtfs: GtfsSqlJs;
  let SQL: any;

  beforeAll(async () => {
    SQL = await initSqlJs();
    const dbBuffer = await createTestDatabase(SQL);
    gtfs = await GtfsSqlJs.fromDatabase(dbBuffer, { SQL });
  });

  afterAll(() => {
    gtfs?.close();
  });

  describe('getShapes', () => {
    it('should get all shapes', () => {
      const shapes = gtfs.getShapes();
      expect(shapes.length).toBe(7); // 5 points for SHAPE1 + 2 points for SHAPE2
    });

    it('should get shapes by shape ID', () => {
      const shapes = gtfs.getShapes({ shapeId: 'SHAPE1' });
      expect(shapes.length).toBe(5);
      expect(shapes.every(s => s.shape_id === 'SHAPE1')).toBe(true);
    });

    it('should get shapes by multiple shape IDs', () => {
      const shapes = gtfs.getShapes({ shapeId: ['SHAPE1', 'SHAPE2'] });
      expect(shapes.length).toBe(7);
    });

    it('should return shapes ordered by shape_id and shape_pt_sequence', () => {
      const shapes = gtfs.getShapes({ shapeId: 'SHAPE1' });
      expect(shapes.length).toBe(5);

      for (let i = 0; i < shapes.length; i++) {
        expect(shapes[i].shape_pt_sequence).toBe(i + 1);
      }
    });

    it('should get shapes by route ID', () => {
      const shapes = gtfs.getShapes({ routeId: 'ROUTE1' });
      expect(shapes.length).toBe(5); // SHAPE1 has 5 points, used by ROUTE1
      expect(shapes.every(s => s.shape_id === 'SHAPE1')).toBe(true);
    });

    it('should get shapes by trip ID', () => {
      const shapes = gtfs.getShapes({ tripId: 'TRIP4' });
      expect(shapes.length).toBe(2); // SHAPE2 has 2 points, used by TRIP4
      expect(shapes.every(s => s.shape_id === 'SHAPE2')).toBe(true);
    });

    it('should get shapes by multiple trip IDs', () => {
      const shapes = gtfs.getShapes({ tripId: ['TRIP1', 'TRIP4'] });
      expect(shapes.length).toBe(7); // SHAPE1 (5) + SHAPE2 (2)
    });

    it('should include shape_dist_traveled when present', () => {
      const shapes = gtfs.getShapes({ shapeId: 'SHAPE1' });
      expect(shapes[0].shape_dist_traveled).toBe(0.0);
      expect(shapes[1].shape_dist_traveled).toBe(100.5);
      expect(shapes[4].shape_dist_traveled).toBe(400.0);
    });

    it('should have undefined shape_dist_traveled when not present', () => {
      const shapes = gtfs.getShapes({ shapeId: 'SHAPE2' });
      expect(shapes[0].shape_dist_traveled).toBeUndefined();
      expect(shapes[1].shape_dist_traveled).toBeUndefined();
    });

    it('should return empty array for non-existent shape ID', () => {
      const shapes = gtfs.getShapes({ shapeId: 'NONEXISTENT' });
      expect(shapes.length).toBe(0);
    });

    it('should respect limit parameter', () => {
      const shapes = gtfs.getShapes({ limit: 3 });
      expect(shapes.length).toBe(3);
    });

    it('should have correct coordinate values', () => {
      const shapes = gtfs.getShapes({ shapeId: 'SHAPE1' });
      expect(shapes[0].shape_pt_lat).toBeCloseTo(40.7128, 4);
      expect(shapes[0].shape_pt_lon).toBeCloseTo(-74.0060, 4);
    });
  });

  describe('getShapesToGeojson', () => {
    it('should return a valid GeoJSON FeatureCollection', () => {
      const geojson = gtfs.getShapesToGeojson();

      expect(geojson.type).toBe('FeatureCollection');
      expect(Array.isArray(geojson.features)).toBe(true);
      expect(geojson.features.length).toBe(2); // 2 unique shapes
    });

    it('should create LineString features for each shape', () => {
      const geojson = gtfs.getShapesToGeojson();

      for (const feature of geojson.features) {
        expect(feature.type).toBe('Feature');
        expect(feature.geometry.type).toBe('LineString');
        expect(Array.isArray(feature.geometry.coordinates)).toBe(true);
      }
    });

    it('should have coordinates in [lon, lat] order per GeoJSON spec', () => {
      const geojson = gtfs.getShapesToGeojson({ shapeId: 'SHAPE1' });
      const feature = geojson.features[0];

      // First coordinate should be [lon, lat]
      expect(feature.geometry.coordinates[0][0]).toBeCloseTo(-74.0060, 4); // lon
      expect(feature.geometry.coordinates[0][1]).toBeCloseTo(40.7128, 4);  // lat
    });

    it('should include shape_id in properties', () => {
      const geojson = gtfs.getShapesToGeojson({ shapeId: 'SHAPE1' });

      expect(geojson.features.length).toBe(1);
      expect(geojson.features[0].properties.shape_id).toBe('SHAPE1');
    });

    it('should include route properties from first matching route', () => {
      const geojson = gtfs.getShapesToGeojson({ shapeId: 'SHAPE1' });
      const props = geojson.features[0].properties;

      expect(props.route_id).toBe('ROUTE1');
      expect(props.route_short_name).toBe('1');
      expect(props.route_long_name).toBe('Main Line');
      expect(props.route_type).toBe(3);
    });

    it('should filter by route ID', () => {
      const geojson = gtfs.getShapesToGeojson({ routeId: 'ROUTE2' });

      expect(geojson.features.length).toBe(1);
      expect(geojson.features[0].properties.shape_id).toBe('SHAPE2');
      expect(geojson.features[0].geometry.coordinates.length).toBe(2);
    });

    it('should filter by trip ID', () => {
      const geojson = gtfs.getShapesToGeojson({ tripId: 'TRIP4' });

      expect(geojson.features.length).toBe(1);
      expect(geojson.features[0].properties.shape_id).toBe('SHAPE2');
    });

    it('should apply default precision of 6 decimals', () => {
      const geojson = gtfs.getShapesToGeojson({ shapeId: 'SHAPE1' });
      const coord = geojson.features[0].geometry.coordinates[0];

      // Check that coordinates have at most 6 decimal places
      const lonStr = coord[0].toString();
      const latStr = coord[1].toString();

      const lonDecimals = lonStr.includes('.') ? lonStr.split('.')[1].length : 0;
      const latDecimals = latStr.includes('.') ? latStr.split('.')[1].length : 0;

      expect(lonDecimals).toBeLessThanOrEqual(6);
      expect(latDecimals).toBeLessThanOrEqual(6);
    });

    it('should apply custom precision', () => {
      const geojson = gtfs.getShapesToGeojson({ shapeId: 'SHAPE1' }, 2);
      const coord = geojson.features[0].geometry.coordinates[0];

      // With precision 2, -74.0060 should become -74.01 and 40.7128 should become 40.71
      expect(coord[0]).toBeCloseTo(-74.01, 2);
      expect(coord[1]).toBeCloseTo(40.71, 2);
    });

    it('should return empty FeatureCollection for non-existent filter', () => {
      const geojson = gtfs.getShapesToGeojson({ shapeId: 'NONEXISTENT' });

      expect(geojson.type).toBe('FeatureCollection');
      expect(geojson.features.length).toBe(0);
    });

    it('should preserve coordinate order (sorted by shape_pt_sequence)', () => {
      const geojson = gtfs.getShapesToGeojson({ shapeId: 'SHAPE1' });
      const coords = geojson.features[0].geometry.coordinates;

      // First point should be at sequence 1
      expect(coords[0][0]).toBeCloseTo(-74.0060, 4);
      expect(coords[0][1]).toBeCloseTo(40.7128, 4);

      // Last point should be at sequence 5
      expect(coords[4][0]).toBeCloseTo(-74.0080, 4);
      expect(coords[4][1]).toBeCloseTo(40.7148, 4);
    });

    it('should handle multiple shapes in one request', () => {
      const geojson = gtfs.getShapesToGeojson();

      expect(geojson.features.length).toBe(2);

      const shapeIds = geojson.features.map(f => f.properties.shape_id).sort();
      expect(shapeIds).toEqual(['SHAPE1', 'SHAPE2']);
    });

    it('should have correct coordinate count for each shape', () => {
      const geojson = gtfs.getShapesToGeojson();

      const shape1 = geojson.features.find(f => f.properties.shape_id === 'SHAPE1');
      const shape2 = geojson.features.find(f => f.properties.shape_id === 'SHAPE2');

      expect(shape1?.geometry.coordinates.length).toBe(5);
      expect(shape2?.geometry.coordinates.length).toBe(2);
    });
  });
});
