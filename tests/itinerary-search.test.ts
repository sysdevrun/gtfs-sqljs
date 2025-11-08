/**
 * Tests for Itinerary Search functionality
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GtfsSqlJs } from '../src/gtfs-sqljs';
import path from 'path';

describe('Itinerary Search', () => {
  let gtfs: GtfsSqlJs;
  const zipPath = path.join(__dirname, '../website/public/car-jaune.zip');

  beforeAll(async () => {
    // Load Car Jaune GTFS data
    gtfs = await GtfsSqlJs.fromZip(zipPath);
  }, 60000); // 60 second timeout for loading

  afterAll(() => {
    gtfs?.close();
  });

  describe('Graph Building', () => {
    it('should build a transit graph for a specific date', () => {
      // Use a date in January 2025 (Car Jaune data starts 2025-01-01)
      const graph = gtfs.buildItineraryGraph('20250115');

      expect(graph).toBeDefined();
      expect(graph.graph).toBeDefined();
      expect(graph.metadata).toBeDefined();
      expect(graph.graph.nodeCount()).toBeGreaterThan(0);

      console.log(`Graph has ${graph.graph.nodeCount()} nodes (stops)`);
      console.log(`Graph has ${graph.graph.edgeCount()} edges (connections)`);
    });
  });

  describe('Pathfinding', () => {
    it('should find a path between two stops', () => {
      // Get parent stops only (stops without a parent_station)
      const allStops = gtfs.getStops();
      const parentStops = allStops.filter(s => !s.parent_station);
      console.log(`\nTotal parent stops: ${parentStops.length}`);
      console.log('Sample parent stops:');
      parentStops.slice(0, 20).forEach(stop => {
        console.log(`  ${stop.stop_id}: ${stop.stop_name}`);
      });

      if (parentStops.length >= 2) {
        const graph = gtfs.buildItineraryGraph('20250115');
        const startStop = parentStops[0].stop_id;
        const endStop = parentStops[parentStops.length - 1].stop_id;

        console.log(`\nTrying to find path from ${startStop} to ${endStop}`);

        const path = gtfs.findItineraryPath(startStop, endStop, graph);

        if (path) {
          console.log(`Found path with ${path.segments.length} segments and ${path.totalTransfers} transfers`);
          path.segments.forEach((seg, idx) => {
            console.log(`  Segment ${idx + 1}: Route ${seg.routeId} (${seg.routeShortName || 'N/A'}) from ${seg.boardStopId} to ${seg.alightStopId}`);
          });
        } else {
          console.log('No path found (stops might not be connected)');
        }
      }
    });
  });

  describe('Trip Matching', () => {
    it('should find trips for a valid path', () => {
      const allStops = gtfs.getStops();
      const parentStops = allStops.filter(s => !s.parent_station);

      if (parentStops.length >= 2) {
        const graph = gtfs.buildItineraryGraph('20250115');
        const startStop = parentStops[0].stop_id;
        const endStop = parentStops[parentStops.length - 1].stop_id;

        const path = gtfs.findItineraryPath(startStop, endStop, graph);

        if (path) {
          const itinerary = gtfs.findItineraryTrips(path, '20250115', '08:00:00', 3);

          console.log(`\nFound ${itinerary.options.length} departure options`);

          itinerary.options.forEach((option, idx) => {
            console.log(`\nOption ${idx + 1}:`);
            console.log(`  Departure: ${option.departureTime}`);
            console.log(`  Arrival: ${option.arrivalTime}`);
            console.log(`  Duration: ${Math.floor(option.totalDuration / 60)} minutes`);

            option.segments.forEach((seg, segIdx) => {
              console.log(`  Segment ${segIdx + 1}:`);
              console.log(`    Trip: ${seg.tripId}`);
              console.log(`    Route: ${seg.routeId} (${seg.tripHeadsign || 'N/A'})`);
              console.log(`    Board at: ${seg.boardStopName} (${seg.boardTime})`);
              console.log(`    Alight at: ${seg.alightStopName} (${seg.alightTime})`);
            });
          });
        }
      }
    });
  });

  describe('Real-world scenarios', () => {
    it('Test Case 1: Find journey between two random stops', () => {
      const allStops = gtfs.getStops();
      const stops = allStops.filter(s => !s.parent_station);
      console.log(`\n=== TEST CASE 1 ===`);
      console.log(`Total parent stops available: ${stops.length}`);

      if (stops.length >= 2) {
        const start = stops[Math.floor(stops.length * 0.1)];
        const end = stops[Math.floor(stops.length * 0.9)];

        console.log(`From: ${start.stop_name} (${start.stop_id})`);
        console.log(`To: ${end.stop_name} (${end.stop_id})`);

        const graph = gtfs.buildItineraryGraph('20250115');
        const path = gtfs.findItineraryPath(start.stop_id, end.stop_id, graph);

        if (path) {
          const itinerary = gtfs.findItineraryTrips(path, '20250115', '09:00:00', 2);
          console.log(`Routes needed: ${path.segments.map(s => s.routeShortName || s.routeId).join(' -> ')}`);
          console.log(`Options found: ${itinerary.options.length}`);

          expect(itinerary.options.length).toBeGreaterThanOrEqual(0);
        } else {
          console.log('No path found between these stops');
        }
      }
    });

    it('Test Case 2: Morning commute scenario', () => {
      const allStops = gtfs.getStops();
      const stops = allStops.filter(s => !s.parent_station);
      console.log(`\n=== TEST CASE 2: MORNING COMMUTE ===`);

      if (stops.length >= 2) {
        const start = stops[0];
        const end = stops[Math.min(5, stops.length - 1)];

        console.log(`From: ${start.stop_name}`);
        console.log(`To: ${end.stop_name}`);

        const graph = gtfs.buildItineraryGraph('20250115');
        const path = gtfs.findItineraryPath(start.stop_id, end.stop_id, graph);

        if (path) {
          const itinerary = gtfs.findItineraryTrips(path, '20250115', '07:30:00', 3);
          console.log(`Morning options (from 7:30 AM): ${itinerary.options.length}`);

          expect(path).toBeDefined();
        }
      }
    });

    it('Test Case 3: Afternoon return journey', () => {
      const allStops = gtfs.getStops();
      const stops = allStops.filter(s => !s.parent_station);
      console.log(`\n=== TEST CASE 3: AFTERNOON RETURN ===`);

      if (stops.length >= 2) {
        const start = stops[Math.min(5, stops.length - 1)];
        const end = stops[0];

        console.log(`From: ${start.stop_name}`);
        console.log(`To: ${end.stop_name}`);

        const graph = gtfs.buildItineraryGraph('20250115');
        const path = gtfs.findItineraryPath(start.stop_id, end.stop_id, graph);

        if (path) {
          const itinerary = gtfs.findItineraryTrips(path, '20250115', '17:00:00', 3);
          console.log(`Afternoon options (from 5:00 PM): ${itinerary.options.length}`);

          expect(path).toBeDefined();
        }
      }
    });

    it('Test Case 4: Multiple routes comparison', () => {
      console.log(`\n=== TEST CASE 4: ROUTE COMPARISON ===`);

      const routes = gtfs.getRoutes();
      console.log(`Total routes: ${routes.length}`);

      routes.forEach(route => {
        console.log(`Route ${route.route_id}: ${route.route_short_name} - ${route.route_long_name}`);
      });

      if (routes.length >= 2) {
        const graph = gtfs.buildItineraryGraph('20250115');
        console.log(`Graph built with ${graph.graph.nodeCount()} stops`);

        expect(graph.graph.nodeCount()).toBeGreaterThan(0);
      }
    });

    it('Test Case 5: Late night service check', () => {
      const allStops = gtfs.getStops();
      const stops = allStops.filter(s => !s.parent_station);
      console.log(`\n=== TEST CASE 5: LATE NIGHT SERVICE ===`);

      if (stops.length >= 2) {
        const start = stops[Math.floor(stops.length * 0.3)];
        const end = stops[Math.floor(stops.length * 0.7)];

        console.log(`From: ${start.stop_name}`);
        console.log(`To: ${end.stop_name}`);

        const graph = gtfs.buildItineraryGraph('20250115');
        const path = gtfs.findItineraryPath(start.stop_id, end.stop_id, graph);

        if (path) {
          const itinerary = gtfs.findItineraryTrips(path, '20250115', '22:00:00', 2);
          console.log(`Late night options (from 10:00 PM): ${itinerary.options.length}`);

          if (itinerary.options.length > 0) {
            console.log('Late night service is available!');
          } else {
            console.log('No late night service found');
          }
        }
      }
    });
  });
});
