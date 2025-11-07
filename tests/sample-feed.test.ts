/**
 * Tests using the official Google GTFS sample feed
 *
 * This test file uses the real sample feed from:
 * https://developers.google.com/transit/gtfs/examples/gtfs-feed
 *
 * The tests validate specific known data from the feed.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GtfsSqlJs } from '../src/gtfs-sqljs';
import path from 'path';

describe('Sample GTFS Feed Tests - Actual Data', () => {
  let gtfs: GtfsSqlJs;

  beforeAll(async () => {
    // Load the sample GTFS feed
    const feedPath = path.join(__dirname, 'fixtures', 'sample-feed.zip');
    gtfs = await GtfsSqlJs.fromZip(feedPath);
  });

  afterAll(() => {
    gtfs?.close();
  });

  describe('Agency', () => {
    it('should have DTA (Demo Transit Authority)', () => {
      const db = gtfs.getDatabase();
      const stmt = db.prepare('SELECT * FROM agency WHERE agency_id = ?');
      stmt.bind(['DTA']);

      expect(stmt.step()).toBe(true);
      const agency = stmt.getAsObject();
      stmt.free();

      expect(agency.agency_id).toBe('DTA');
      expect(agency.agency_name).toBe('Demo Transit Authority');
      expect(agency.agency_url).toBe('http://google.com');
      expect(agency.agency_timezone).toBe('America/Los_Angeles');
    });
  });

  describe('Stops', () => {
    it('should have 9 stops', () => {
      const stops = gtfs.getStops();
      expect(stops.length).toBe(9);
    });

    it('should have BEATTY_AIRPORT with correct details', () => {
      const stop = gtfs.getStops({ stopId: 'BEATTY_AIRPORT' })[0];

      expect(stop).not.toBeNull();
      expect(stop!.stop_id).toBe('BEATTY_AIRPORT');
      expect(stop!.stop_name).toBe('Nye County Airport (Demo)');
      expect(stop!.stop_lat).toBeCloseTo(36.868446, 5);
      expect(stop!.stop_lon).toBeCloseTo(-116.784582, 5);
    });

    it('should have BULLFROG with correct details', () => {
      const stop = gtfs.getStops({ stopId: 'BULLFROG' })[0];

      expect(stop).not.toBeNull();
      expect(stop!.stop_id).toBe('BULLFROG');
      expect(stop!.stop_name).toBe('Bullfrog (Demo)');
      expect(stop!.stop_lat).toBeCloseTo(36.88108, 5);
      expect(stop!.stop_lon).toBeCloseTo(-116.81797, 5);
    });

    it('should find stops when searching for "Airport"', () => {
      const stops = gtfs.getStops({ name: 'Airport' });
      expect(stops.length).toBeGreaterThanOrEqual(1);

      const airportStop = stops.find(s => s.stop_id === 'BEATTY_AIRPORT');
      expect(airportStop).toBeDefined();
      expect(airportStop!.stop_name).toBe('Nye County Airport (Demo)');
    });

    it('should get stops for trip AB1 in correct order', () => {
      const stops = gtfs.getStops({ tripId: 'AB1' });

      expect(stops.length).toBe(2);
      expect(stops[0].stop_id).toBe('BEATTY_AIRPORT');
      expect(stops[0].stop_name).toBe('Nye County Airport (Demo)');
      expect(stops[1].stop_id).toBe('BULLFROG');
      expect(stops[1].stop_name).toBe('Bullfrog (Demo)');
    });

    it('should get stops for trip CITY1 in correct order', () => {
      const stops = gtfs.getStops({ tripId: 'CITY1' });

      expect(stops.length).toBe(5);
      expect(stops[0].stop_id).toBe('STAGECOACH');
      expect(stops[1].stop_id).toBe('NANAA');
      expect(stops[2].stop_id).toBe('NADAV');
      expect(stops[3].stop_id).toBe('DADAN');
      expect(stops[4].stop_id).toBe('EMSI');
    });
  });

  describe('Routes', () => {
    it('should have 5 routes', () => {
      const routes = gtfs.getRoutes();
      expect(routes.length).toBe(5);
    });

    it('should have route AB (Airport - Bullfrog)', () => {
      const route = gtfs.getRoutes({ routeId: 'AB' })[0];

      expect(route).not.toBeNull();
      expect(route!.route_id).toBe('AB');
      expect(route!.agency_id).toBe('DTA');
      expect(route!.route_short_name).toBe('10');
      expect(route!.route_long_name).toBe('Airport - Bullfrog');
      expect(route!.route_type).toBe(3); // Bus
    });

    it('should have route BFC (Bullfrog - Furnace Creek Resort)', () => {
      const route = gtfs.getRoutes({ routeId: 'BFC' })[0];

      expect(route).not.toBeNull();
      expect(route!.route_id).toBe('BFC');
      expect(route!.route_short_name).toBe('20');
      expect(route!.route_long_name).toBe('Bullfrog - Furnace Creek Resort');
      expect(route!.route_type).toBe(3);
    });

    it('should have route CITY (City)', () => {
      const route = gtfs.getRoutes({ routeId: 'CITY' })[0];

      expect(route).not.toBeNull();
      expect(route!.route_id).toBe('CITY');
      expect(route!.route_short_name).toBe('40');
      expect(route!.route_long_name).toBe('City');
    });

    it('should get all routes for agency DTA', () => {
      const routes = gtfs.getRoutes({ agencyId: 'DTA' });
      expect(routes.length).toBe(5);
    });
  });

  describe('Calendar', () => {
    it('should have FULLW service (full week)', () => {
      const calendar = gtfs.getCalendarByServiceId('FULLW');

      expect(calendar).not.toBeNull();
      expect(calendar!.service_id).toBe('FULLW');
      expect(calendar!.monday).toBe(1);
      expect(calendar!.tuesday).toBe(1);
      expect(calendar!.wednesday).toBe(1);
      expect(calendar!.thursday).toBe(1);
      expect(calendar!.friday).toBe(1);
      expect(calendar!.saturday).toBe(1);
      expect(calendar!.sunday).toBe(1);
      expect(calendar!.start_date).toBe('20070101');
      expect(calendar!.end_date).toBe('20101231');
    });

    it('should have WE service (weekend only)', () => {
      const calendar = gtfs.getCalendarByServiceId('WE');

      expect(calendar).not.toBeNull();
      expect(calendar!.service_id).toBe('WE');
      expect(calendar!.monday).toBe(0);
      expect(calendar!.tuesday).toBe(0);
      expect(calendar!.wednesday).toBe(0);
      expect(calendar!.thursday).toBe(0);
      expect(calendar!.friday).toBe(0);
      expect(calendar!.saturday).toBe(1);
      expect(calendar!.sunday).toBe(1);
      expect(calendar!.start_date).toBe('20070101');
      expect(calendar!.end_date).toBe('20101231');
    });

    it('should return FULLW service for Monday 2007-01-01', () => {
      // 2007-01-01 was a Monday
      const serviceIds = gtfs.getActiveServiceIds('20070101');

      expect(serviceIds).toContain('FULLW');
      expect(serviceIds).not.toContain('WE'); // Weekend service not active on Monday
    });

    it('should return both FULLW and WE services for Saturday 2007-01-06', () => {
      // 2007-01-06 was a Saturday
      const serviceIds = gtfs.getActiveServiceIds('20070106');

      expect(serviceIds).toContain('FULLW');
      expect(serviceIds).toContain('WE');
    });

    it('should return both services for Sunday 2007-01-07', () => {
      // 2007-01-07 was a Sunday
      const serviceIds = gtfs.getActiveServiceIds('20070107');

      expect(serviceIds).toContain('FULLW');
      expect(serviceIds).toContain('WE');
    });

    it('should return no services for date outside range', () => {
      const serviceIds = gtfs.getActiveServiceIds('20110101');
      expect(serviceIds.length).toBe(0);
    });
  });

  describe('Trips', () => {
    it('should have trip AB1 (to Bullfrog)', () => {
      const trip = gtfs.getTrips({ tripId: 'AB1' })[0];

      expect(trip).not.toBeNull();
      expect(trip!.trip_id).toBe('AB1');
      expect(trip!.route_id).toBe('AB');
      expect(trip!.service_id).toBe('FULLW');
      expect(trip!.trip_headsign).toBe('to Bullfrog');
      expect(trip!.direction_id).toBe(0);
      expect(trip!.block_id).toBe('1');
    });

    it('should have trip AB2 (to Airport)', () => {
      const trip = gtfs.getTrips({ tripId: 'AB2' })[0];

      expect(trip).not.toBeNull();
      expect(trip!.trip_id).toBe('AB2');
      expect(trip!.route_id).toBe('AB');
      expect(trip!.service_id).toBe('FULLW');
      expect(trip!.trip_headsign).toBe('to Airport');
      expect(trip!.direction_id).toBe(1);
      expect(trip!.block_id).toBe('2');
    });

    it('should get 2 trips for route AB', () => {
      const trips = gtfs.getTrips({ routeId: 'AB' });
      expect(trips.length).toBe(2);

      const tripIds = trips.map(t => t.trip_id).sort();
      expect(tripIds).toEqual(['AB1', 'AB2']);
    });

    it('should get trips for route AB on Monday', () => {
      const trips = gtfs.getTrips({ routeId: 'AB', date: '20070101' });
      expect(trips.length).toBe(2);
      expect(trips.every(t => t.service_id === 'FULLW')).toBe(true);
    });

    it('should get 7 trips for Monday (all FULLW trips)', () => {
      const trips = gtfs.getTrips({ date: '20070101' });
      expect(trips.length).toBe(7); // AB1, AB2, STBA, CITY1, CITY2, BFC1, BFC2
      expect(trips.every(t => t.service_id === 'FULLW')).toBe(true);
    });

    it('should get 11 trips for Saturday (FULLW + WE trips)', () => {
      const trips = gtfs.getTrips({ date: '20070106' });
      expect(trips.length).toBe(11); // 7 FULLW + 4 AAMV (WE)

      const fullwTrips = trips.filter(t => t.service_id === 'FULLW');
      const weTrips = trips.filter(t => t.service_id === 'WE');

      expect(fullwTrips.length).toBe(7);
      expect(weTrips.length).toBe(4);
    });

    it('should get trips by direction', () => {
      const tripsDir0 = gtfs.getTrips({ routeId: 'AB', date: '20070101', directionId: 0 });
      const tripsDir1 = gtfs.getTrips({ routeId: 'AB', date: '20070101', directionId: 1 });

      expect(tripsDir0.length).toBe(1);
      expect(tripsDir0[0].trip_id).toBe('AB1');
      expect(tripsDir0[0].trip_headsign).toBe('to Bullfrog');

      expect(tripsDir1.length).toBe(1);
      expect(tripsDir1[0].trip_id).toBe('AB2');
      expect(tripsDir1[0].trip_headsign).toBe('to Airport');
    });
  });

  describe('Stop Times', () => {
    it('should have correct stop times for trip AB1', () => {
      const stopTimes = gtfs.getStopTimes({ tripId: 'AB1' });

      expect(stopTimes.length).toBe(2);

      // First stop
      expect(stopTimes[0].trip_id).toBe('AB1');
      expect(stopTimes[0].stop_id).toBe('BEATTY_AIRPORT');
      expect(stopTimes[0].arrival_time).toBe('8:00:00');
      expect(stopTimes[0].departure_time).toBe('8:00:00');
      expect(stopTimes[0].stop_sequence).toBe(1);

      // Second stop
      expect(stopTimes[1].trip_id).toBe('AB1');
      expect(stopTimes[1].stop_id).toBe('BULLFROG');
      expect(stopTimes[1].arrival_time).toBe('8:10:00');
      expect(stopTimes[1].departure_time).toBe('8:15:00');
      expect(stopTimes[1].stop_sequence).toBe(2);
    });

    it('should have correct stop times for trip CITY1', () => {
      const stopTimes = gtfs.getStopTimes({ tripId: 'CITY1' });

      expect(stopTimes.length).toBe(5);

      // Verify all stops in sequence
      expect(stopTimes[0].stop_id).toBe('STAGECOACH');
      expect(stopTimes[0].arrival_time).toBe('6:00:00');

      expect(stopTimes[1].stop_id).toBe('NANAA');
      expect(stopTimes[1].arrival_time).toBe('6:05:00');
      expect(stopTimes[1].departure_time).toBe('6:07:00');

      expect(stopTimes[2].stop_id).toBe('NADAV');
      expect(stopTimes[3].stop_id).toBe('DADAN');
      expect(stopTimes[4].stop_id).toBe('EMSI');
    });

    it('should get stop times for BEATTY_AIRPORT', () => {
      const stopTimes = gtfs.getStopTimes({ stopId: 'BEATTY_AIRPORT', limit: 100 });

      // BEATTY_AIRPORT appears in: STBA, AB1, AB2, AAMV1, AAMV2, AAMV3, AAMV4 = 7 trips
      expect(stopTimes.length).toBe(7);

      // Should be ordered by arrival_time (as strings)
      // Note: SQL ORDER BY treats times as strings, so "11:00:00" < "6:20:00" alphabetically
      const times = stopTimes.map(st => st.arrival_time);
      expect(times).toContain('6:20:00'); // STBA
      expect(times).toContain('8:00:00'); // AB1 or AAMV1
      expect(times).toContain('12:15:00'); // AB2
    });

    it('should get stop times for route AB at BEATTY_AIRPORT on Monday', () => {
      const stopTimes = gtfs.getStopTimes({ stopId: 'BEATTY_AIRPORT', routeId: 'AB', date: '20070101' });

      expect(stopTimes.length).toBe(2); // AB1 and AB2

      // Check specific times
      const ab1Time = stopTimes.find(st => st.trip_id === 'AB1');
      const ab2Time = stopTimes.find(st => st.trip_id === 'AB2');

      expect(ab1Time).toBeDefined();
      expect(ab1Time!.arrival_time).toBe('8:00:00');

      expect(ab2Time).toBeDefined();
      expect(ab2Time!.arrival_time).toBe('12:15:00');
    });

    it('should filter by direction', () => {
      const stopTimes = gtfs.getStopTimes({ stopId: 'BEATTY_AIRPORT', routeId: 'AB', date: '20070101', directionId: 0 });

      expect(stopTimes.length).toBe(1);
      expect(stopTimes[0].trip_id).toBe('AB1');
      expect(stopTimes[0].arrival_time).toBe('8:00:00');
    });
  });

  describe('Complete Journey Scenarios', () => {
    it('should plan journey from Airport to Bullfrog at 8am', () => {
      // User wants to go from BEATTY_AIRPORT to BULLFROG
      const origin = gtfs.getStops({ stopId: 'BEATTY_AIRPORT' })[0];
      const destination = gtfs.getStops({ stopId: 'BULLFROG' })[0];

      expect(origin).not.toBeNull();
      expect(destination).not.toBeNull();

      // Find route AB
      const route = gtfs.getRoutes({ routeId: 'AB' })[0];
      expect(route).not.toBeNull();

      // Get trips on a Monday
      const trips = gtfs.getTrips({ routeId: 'AB', date: '20070101' });

      // Trip AB1 goes to Bullfrog (direction 0)
      const trip = trips.find(t => t.trip_headsign === 'to Bullfrog');
      expect(trip).toBeDefined();
      expect(trip!.trip_id).toBe('AB1');

      // Get stop times
      const stopTimes = gtfs.getStopTimes({ tripId: 'AB1' });
      expect(stopTimes[0].stop_id).toBe('BEATTY_AIRPORT');
      expect(stopTimes[0].departure_time).toBe('8:00:00');
      expect(stopTimes[1].stop_id).toBe('BULLFROG');
      expect(stopTimes[1].arrival_time).toBe('8:10:00');

      console.log('\nJourney Plan:');
      console.log(`From: ${origin!.stop_name}`);
      console.log(`To: ${destination!.stop_name}`);
      console.log(`Route: ${route!.route_short_name} - ${route!.route_long_name}`);
      console.log(`Depart: ${stopTimes[0].departure_time}`);
      console.log(`Arrive: ${stopTimes[1].arrival_time}`);
      console.log(`Duration: 10 minutes`);
    });

    it('should find all routes serving BULLFROG', () => {
      const stopTimes = gtfs.getStopTimes({ stopId: 'BULLFROG', limit: 100 });

      // Get unique trip IDs
      const tripIds = [...new Set(stopTimes.map(st => st.trip_id))];

      // Get routes for these trips
      const routes = new Set<string>();
      for (const tripId of tripIds) {
        const trips = gtfs.getTrips({ tripId });
        if (trips.length > 0) {
          routes.add(trips[0].route_id);
        }
      }

      // BULLFROG is served by routes AB and BFC
      expect(routes.size).toBe(2);
      expect(routes.has('AB')).toBe(true);
      expect(routes.has('BFC')).toBe(true);
    });

    it('should find city circuit route with all stops', () => {
      const route = gtfs.getRoutes({ routeId: 'CITY' })[0];
      expect(route).not.toBeNull();

      // Get both directions
      const trip1 = gtfs.getTrips({ tripId: 'CITY1' })[0];
      const trip2 = gtfs.getTrips({ tripId: 'CITY2' })[0];

      const stops1 = gtfs.getStops({ tripId: 'CITY1' });
      const stops2 = gtfs.getStops({ tripId: 'CITY2' });

      // Both trips have 5 stops
      expect(stops1.length).toBe(5);
      expect(stops2.length).toBe(5);

      // They visit the same stops in reverse order
      expect(stops1[0].stop_id).toBe('STAGECOACH');
      expect(stops2[4].stop_id).toBe('STAGECOACH');

      expect(stops1[4].stop_id).toBe('EMSI');
      expect(stops2[0].stop_id).toBe('EMSI');
    });
  });

  describe('Database Export/Import', () => {
    it('should export and re-import database with all data intact', async () => {
      // Export database
      const buffer = gtfs.export();
      expect(buffer.byteLength).toBeGreaterThan(0);

      // Create new instance from exported buffer
      const gtfs2 = await GtfsSqlJs.fromDatabase(buffer);

      // Verify specific data is intact
      const db = gtfs2.getDatabase();
      const agency = db.prepare('SELECT * FROM agency WHERE agency_id = ?');
      agency.bind(['DTA']);
      expect(agency.step()).toBe(true);
      const agencyData = agency.getAsObject();
      agency.free();
      expect(agencyData.agency_name).toBe('Demo Transit Authority');

      // Verify route
      const route = gtfs2.getRoutes({ routeId: 'AB' })[0];
      expect(route).not.toBeNull();
      expect(route!.route_long_name).toBe('Airport - Bullfrog');

      // Verify trip
      const trip = gtfs2.getTrips({ tripId: 'AB1' })[0];
      expect(trip).not.toBeNull();
      expect(trip!.trip_headsign).toBe('to Bullfrog');

      gtfs2.close();
    });
  });
});
