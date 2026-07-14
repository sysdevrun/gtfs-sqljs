/**
 * Tests for the pure realtime resolution engine
 */

import { describe, it, expect } from 'vitest';
import { resolveRealtime, type ResolveRealtimeOptions } from '../src/time/resolve-realtime';
import type { StopTime } from '../src/types/gtfs';
import { StopTimeScheduleRelationship, TripScheduleRelationship } from '../src/types/gtfs-rt';

// Four-stop trip on a UTC feed so epochs are trivial to compute by hand.
const DAY = Date.UTC(2026, 6, 13) / 1000;
const OPTS: ResolveRealtimeOptions = { serviceDate: '20260713', timezone: 'UTC' };

function makeStopTimes(): StopTime[] {
  return [
    { trip_id: 'T', stop_id: 'A', stop_sequence: 1, arrival_time: '08:00:00', departure_time: '08:00:00' },
    { trip_id: 'T', stop_id: 'B', stop_sequence: 2, arrival_time: '08:10:00', departure_time: '08:12:00' },
    { trip_id: 'T', stop_id: 'C', stop_sequence: 3, arrival_time: '08:20:00', departure_time: '08:20:00' },
    { trip_id: 'T', stop_id: 'D', stop_sequence: 4, arrival_time: '08:30:00', departure_time: '08:30:00' },
  ];
}

describe('resolveRealtime — schedule only', () => {
  it('computes day-seconds and epochs without realtime', () => {
    const resolved = resolveRealtime(makeStopTimes(), [], null, OPTS);

    expect(resolved).toHaveLength(4);
    expect(resolved[0].scheduled_departure_seconds).toBe(28800);
    expect(resolved[0].scheduled_departure_epoch).toBe(DAY + 28800);
    expect(resolved[1].scheduled_arrival_seconds).toBe(29400);
    expect(resolved[1].scheduled_departure_seconds).toBe(29520);
    expect(resolved.every(s => s.rt_source === 'none')).toBe(true);
    expect(resolved.every(s => !s.display_is_realtime)).toBe(true);
  });

  it('handles past-midnight stop times', () => {
    const stopTimes: StopTime[] = [
      { trip_id: 'T', stop_id: 'A', stop_sequence: 1, arrival_time: '23:50:00', departure_time: '23:50:00' },
      { trip_id: 'T', stop_id: 'B', stop_sequence: 2, arrival_time: '25:30:00', departure_time: '25:30:00' },
    ];
    const resolved = resolveRealtime(stopTimes, [], null, OPTS);
    expect(resolved[1].scheduled_arrival_seconds).toBe(91800);
    expect(resolved[1].scheduled_arrival_epoch).toBe(DAY + 91800);
  });

  it('leaves interpolated stops (no times) undefined', () => {
    const stopTimes: StopTime[] = [
      { trip_id: 'T', stop_id: 'A', stop_sequence: 1, arrival_time: '08:00:00', departure_time: '08:00:00' },
      { trip_id: 'T', stop_id: 'B', stop_sequence: 2 },
    ];
    const resolved = resolveRealtime(stopTimes, [], null, OPTS);
    expect(resolved[1].scheduled_arrival_seconds).toBeUndefined();
    expect(resolved[1].display_epoch).toBeUndefined();
  });

  it('selects departure for regular stops and arrival at the terminus', () => {
    const resolved = resolveRealtime(makeStopTimes(), [], null, OPTS);
    expect(resolved[1].display_epoch).toBe(DAY + 29520); // B: departure 08:12
    expect(resolved[3].display_epoch).toBe(DAY + 30600); // D (last): arrival 08:30
    expect(resolved[0].is_first).toBe(true);
    expect(resolved[3].is_last).toBe(true);
  });

  it("flips to arrivals in 'arrival' display mode", () => {
    const resolved = resolveRealtime(makeStopTimes(), [], null, { ...OPTS, displayMode: 'arrival' });
    expect(resolved[0].display_epoch).toBe(DAY + 28800); // A (first): departure
    expect(resolved[1].display_epoch).toBe(DAY + 29400); // B: arrival 08:10
  });
});

describe('resolveRealtime — realtime resolution', () => {
  it('applies a delay-only update and fills both events and epochs', () => {
    const resolved = resolveRealtime(
      makeStopTimes(),
      [{ stop_sequence: 2, departure: { delay: 120 } }],
      null,
      OPTS
    );
    const b = resolved[1];
    expect(b.rt_source).toBe('exact');
    expect(b.departure_delay).toBe(120);
    expect(b.arrival_delay).toBe(120); // borrowed from departure
    expect(b.rt_departure_epoch).toBe(DAY + 29520 + 120);
    expect(b.rt_arrival_epoch).toBe(DAY + 29400 + 120);
    expect(b.display_is_realtime).toBe(true);
    expect(b.display_delay).toBe(120);
  });

  it('derives the delay from an absolute-time-only update', () => {
    const absolute = DAY + 29400 + 180;
    const resolved = resolveRealtime(
      makeStopTimes(),
      [{ stop_sequence: 2, arrival: { time: absolute } }],
      null,
      OPTS
    );
    const b = resolved[1];
    expect(b.rt_arrival_epoch).toBe(absolute);
    expect(b.arrival_delay).toBe(180);
    expect(b.departure_delay).toBe(180); // borrowed from arrival
    expect(b.rt_departure_epoch).toBe(DAY + 29520 + 180);
  });

  it('prefers the absolute time when delay and time disagree', () => {
    const absolute = DAY + 29400 + 300;
    const resolved = resolveRealtime(
      makeStopTimes(),
      [{ stop_sequence: 2, arrival: { delay: 60, time: absolute } }],
      null,
      OPTS
    );
    expect(resolved[1].rt_arrival_epoch).toBe(absolute);
    expect(resolved[1].arrival_delay).toBe(300);
  });

  it('treats an explicit zero delay as on-time realtime, not absence', () => {
    const resolved = resolveRealtime(
      makeStopTimes(),
      [{ stop_sequence: 2, departure: { delay: 0 } }],
      null,
      OPTS
    );
    const b = resolved[1];
    expect(b.rt_source).toBe('exact');
    expect(b.departure_delay).toBe(0);
    expect(b.rt_departure_epoch).toBe(DAY + 29520);
    expect(b.display_is_realtime).toBe(true);
    // and it propagates as an on-time signal
    expect(resolved[2].rt_source).toBe('propagated');
    expect(resolved[2].departure_delay).toBe(0);
  });

  it('propagates the latest delay to subsequent stops until the next update', () => {
    const resolved = resolveRealtime(
      makeStopTimes(),
      [
        { stop_sequence: 2, departure: { delay: 300 } },
        { stop_sequence: 3, departure: { delay: 60 } },
      ],
      null,
      OPTS
    );
    expect(resolved[0].rt_source).toBe('none'); // before the first update
    expect(resolved[1].departure_delay).toBe(300);
    expect(resolved[2].departure_delay).toBe(60);
    expect(resolved[3].rt_source).toBe('propagated');
    expect(resolved[3].departure_delay).toBe(60); // latest update wins
  });

  it('falls back to the trip-level delay for stops without updates', () => {
    const resolved = resolveRealtime(makeStopTimes(), [], { delay: 240 }, OPTS);
    expect(resolved.every(s => s.rt_source === 'trip_delay')).toBe(true);
    expect(resolved[0].departure_delay).toBe(240);
    expect(resolved[0].rt_departure_epoch).toBe(DAY + 28800 + 240);
  });

  it('uses trip delay before the first update and propagation after it', () => {
    const resolved = resolveRealtime(
      makeStopTimes(),
      [{ stop_sequence: 3, departure: { delay: 600 } }],
      { delay: 120 },
      OPTS
    );
    expect(resolved[0].rt_source).toBe('trip_delay');
    expect(resolved[0].departure_delay).toBe(120);
    expect(resolved[2].rt_source).toBe('exact');
    expect(resolved[3].rt_source).toBe('propagated');
    expect(resolved[3].departure_delay).toBe(600);
  });

  it('matches updates by stop_id when stop_sequence is absent', () => {
    const resolved = resolveRealtime(
      makeStopTimes(),
      [{ stop_id: 'B', arrival: { delay: 90 } }],
      null,
      OPTS
    );
    expect(resolved[1].rt_source).toBe('exact');
    expect(resolved[1].arrival_delay).toBe(90);
    expect(resolved[2].rt_source).toBe('propagated');
  });

  it('flags SKIPPED stops and keeps propagation running past them', () => {
    const resolved = resolveRealtime(
      makeStopTimes(),
      [
        { stop_sequence: 1, departure: { delay: 120 } },
        { stop_sequence: 2, schedule_relationship: StopTimeScheduleRelationship.SKIPPED },
      ],
      null,
      OPTS
    );
    const b = resolved[1];
    expect(b.skipped).toBe(true);
    expect(b.display_is_realtime).toBe(false);
    expect(b.rt_departure_epoch).toBeUndefined();
    expect(resolved[2].rt_source).toBe('propagated');
    expect(resolved[2].departure_delay).toBe(120);
  });

  it('stops showing realtime after a NO_DATA update', () => {
    const resolved = resolveRealtime(
      makeStopTimes(),
      [
        { stop_sequence: 1, departure: { delay: 120 } },
        { stop_sequence: 2, schedule_relationship: StopTimeScheduleRelationship.NO_DATA },
      ],
      null,
      OPTS
    );
    expect(resolved[1].no_data).toBe(true);
    expect(resolved[1].display_is_realtime).toBe(false);
    expect(resolved[2].rt_source).toBe('none');
  });

  it('shows only the schedule for a canceled trip', () => {
    const resolved = resolveRealtime(
      makeStopTimes(),
      [{ stop_sequence: 2, departure: { delay: 120 } }],
      { delay: 120, schedule_relationship: TripScheduleRelationship.CANCELED },
      OPTS
    );
    expect(resolved.every(s => s.rt_source === 'none')).toBe(true);
    expect(resolved.every(s => !s.display_is_realtime)).toBe(true);
    expect(resolved[1].display_epoch).toBe(DAY + 29520);
  });

  it('filters stale updates when a staleness threshold is given', () => {
    const now = DAY + 30000;
    const resolved = resolveRealtime(
      makeStopTimes(),
      [{ stop_sequence: 2, departure: { delay: 120 }, rt_last_updated: now - 600 }],
      null,
      { ...OPTS, stalenessThreshold: 120, now }
    );
    expect(resolved.every(s => s.rt_source === 'none')).toBe(true);
  });

  it('carries uncertainty through from the matched event', () => {
    const resolved = resolveRealtime(
      makeStopTimes(),
      [{ stop_sequence: 2, departure: { delay: 120, uncertainty: 30 } }],
      null,
      OPTS
    );
    expect(resolved[1].uncertainty).toBe(30);
  });

  it('preserves extra properties on input stop times', () => {
    const enriched = makeStopTimes().map(st => ({ ...st, stop_name: `Stop ${st.stop_id}` }));
    const resolved = resolveRealtime(enriched, [], null, OPTS);
    expect(resolved[0].stop_name).toBe('Stop A');
  });
});
