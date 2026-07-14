/**
 * Tests for the pure GTFS time helpers
 */

import { describe, it, expect } from 'vitest';
import { parseGtfsTime, gtfsTimeToEpoch, serviceDayStartEpoch } from '../src/time/gtfs-time';

describe('parseGtfsTime', () => {
  it('parses standard HH:MM:SS times', () => {
    expect(parseGtfsTime('00:00:00')).toBe(0);
    expect(parseGtfsTime('08:00:00')).toBe(28800);
    expect(parseGtfsTime('23:59:59')).toBe(86399);
  });

  it('parses times past midnight (hours >= 24)', () => {
    expect(parseGtfsTime('24:00:00')).toBe(86400);
    expect(parseGtfsTime('25:30:00')).toBe(91800);
    expect(parseGtfsTime('110:00:00')).toBe(396000);
  });

  it('is lenient about non-zero-padded hours and missing seconds', () => {
    expect(parseGtfsTime('8:05:00')).toBe(29100);
    expect(parseGtfsTime('08:05')).toBe(29100);
    expect(parseGtfsTime(' 08:05:00 ')).toBe(29100);
  });

  it('returns undefined for missing or malformed input', () => {
    expect(parseGtfsTime(undefined)).toBeUndefined();
    expect(parseGtfsTime(null)).toBeUndefined();
    expect(parseGtfsTime('')).toBeUndefined();
    expect(parseGtfsTime('abc')).toBeUndefined();
    expect(parseGtfsTime('08:60:00')).toBeUndefined();
    expect(parseGtfsTime('08:00:61')).toBeUndefined();
  });
});

describe('serviceDayStartEpoch', () => {
  it('is midnight local time on regular days', () => {
    // UTC
    expect(serviceDayStartEpoch('20260713', 'UTC')).toBe(Date.UTC(2026, 6, 13) / 1000);
    // Fixed positive offset, no DST (Réunion, UTC+4)
    expect(serviceDayStartEpoch('20260713', 'Indian/Reunion')).toBe(Date.UTC(2026, 6, 12, 20) / 1000);
    // Negative offset with DST active (New York in July, UTC-4)
    expect(serviceDayStartEpoch('20260713', 'America/New_York')).toBe(Date.UTC(2026, 6, 13, 4) / 1000);
  });

  it('applies the noon-minus-12h rule on DST transition days', () => {
    // 2026-03-08: US spring forward. Noon is EDT (UTC-4) => 16:00 UTC, minus 12h = 04:00 UTC.
    // A naive "local midnight" (EST, 05:00 UTC) would be off by one hour.
    expect(serviceDayStartEpoch('20260308', 'America/New_York')).toBe(Date.UTC(2026, 2, 8, 4) / 1000);
    // 2026-11-01: US fall back. Noon is EST (UTC-5) => 17:00 UTC, minus 12h = 05:00 UTC.
    expect(serviceDayStartEpoch('20261101', 'America/New_York')).toBe(Date.UTC(2026, 10, 1, 5) / 1000);
  });

  it('rejects malformed service dates', () => {
    expect(() => serviceDayStartEpoch('2026-07-13', 'UTC')).toThrow(/YYYYMMDD/);
  });
});

describe('gtfsTimeToEpoch', () => {
  it('combines service day start and day-seconds', () => {
    // 08:00:00 in New York on a regular winter day (EST, UTC-5)
    expect(gtfsTimeToEpoch(28800, '20240115', 'America/New_York')).toBe(Date.UTC(2024, 0, 15, 13) / 1000);
  });

  it('lands past-midnight times on the next calendar day', () => {
    // 25:30:00 on 2026-07-13 in Réunion (UTC+4) = 01:30 local on July 14 = 21:30 UTC July 13
    expect(gtfsTimeToEpoch(91800, '20260713', 'Indian/Reunion')).toBe(Date.UTC(2026, 6, 13, 21, 30) / 1000);
  });

  it('keeps scheduled times correct across a spring-forward transition', () => {
    // 08:00:00 on the US spring-forward day: noon-12h (04:00 UTC) + 8h = 12:00 UTC = 08:00 EDT
    expect(gtfsTimeToEpoch(28800, '20260308', 'America/New_York')).toBe(Date.UTC(2026, 2, 8, 12) / 1000);
  });
});
