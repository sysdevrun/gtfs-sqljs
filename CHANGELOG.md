# Changelog

## Upcoming release

-

## 0.4.1

- Add Claude Code skill file with API reference, usage examples, WASM setup instructions, and Web Worker guidance for LLM code agents

## 0.4.0

### Breaking changes

- **`fromZip()` no longer reads local file paths** in Node.js. Read the file yourself and use `fromZipData()` instead
- `fetchRealtimeData()` / `loadRealtimeData()` no longer read local file paths in Node.js. Use the new `loadRealtimeDataFromBuffers()` method with pre-read data instead

### New features

- Add `loadRealtimeDataFromBuffers(buffers)` method to `GtfsSqlJs` for loading GTFS-RT data from pre-loaded protobuf `Uint8Array` buffers without fetching

### Internal improvements

- Remove all Node.js `fs` imports and `isNodeEnvironment()` checks, making the published module fully platform-neutral
- Delete `src/utils/env.ts` (no remaining callers)

## 0.3.1

- Make `route_short_name` and `route_long_name` optional, matching GTFS spec (conditionally required: at least one must be present)
- Allow `transfers.transfer_type` to be empty (defaults to 0 per GTFS spec)
- Make `stop_times.arrival_time` and `stop_times.departure_time` optional for intermediate stops per GTFS spec
- Make `stops.stop_lat` and `stops.stop_lon` optional for generic nodes (`location_type=3`) and boarding areas (`location_type=4`) per GTFS spec

## 0.3.0

### Breaking changes

- **`fromZip()` now only accepts `string`** (path or URL). If you were passing `ArrayBuffer` or `Uint8Array`, use the new `fromZipData()` method instead
- **`skipFiles` behavior change**: files listed in `skipFiles` are now skipped during ZIP extraction entirely (not just excluded from DB loading), improving performance for large feeds

### New features

- Add `GtfsSqlJs.fromZipData(zipData, options?, source?)` static method for loading from pre-loaded ZIP data (`ArrayBuffer` or `Uint8Array`)
- Extract only known GTFS files from ZIP, skipping unrecognized files for faster extraction

### Internal improvements

- Simplify checksum module to use global `crypto.subtle` directly (available in both browsers and Node.js 18+, which is the minimum engine version); remove multi-branch environment detection, dynamic `import('crypto')` fallback, and empty `catch` block
- Extract shared `isNodeEnvironment()` helper into `utils/env.ts`, replacing inline `typeof process` checks in zip-loader and gtfs-rt-loader
- Narrow `loadGTFSZip()` parameter from `string | ArrayBuffer | Uint8Array` to `ArrayBuffer | Uint8Array` (string path was dead code)
- Replace `unknown[]` with proper `ProtobufTimeRange[]` and `ProtobufEntitySelector[]` types in gtfs-rt-loader
- Refactor `convertKeysToSnakeCase` to use `Object.entries()`, removing `for..in` loop with `as Record<string, unknown>` cast
- Replace `as Record<string, unknown>` widening casts on `stmt.getAsObject()` across all query files with proper `ParamsObject` type from sql.js
- Replace non-null assertions (`!`) with optional chaining (`?.`) for `Map.get()` calls in rt-trip-updates and stop-times
- Replace `this.SQL!.Database()` non-null assertion with explicit guard in gtfs-sqljs

## 0.2.2

- Fix `getStopTimes` and `getTrips` returning all results instead of none when called with a date outside the feed's validity range
- Allow `fare_attributes.transfers` to be empty (NULL), meaning unlimited transfers per GTFS spec

## 0.2.0

- Add `pickupType` and `dropOffType` filters to `getStopTimes`, with `COALESCE` handling so NULL (empty) is treated as 0 (regular) per GTFS spec
- Add `PickupDropOffType` enum for GTFS static pickup/drop-off type values
- Replace `getCalendarByServiceId(serviceId)` with `getCalendars(filters?)` for consistent filter-based API
- Fix README: replace non-existent `getStopById` with `getStops({ stopId })`

## 0.1.2

- Remove dist/ from repository (built at publish time)
- Upgrade vitest from v1 to v4
- Upgrade ESLint from v8 to v9 with flat config migration
- Upgrade @typescript-eslint from v6 to v8 (via typescript-eslint)
- Upgrade TypeScript from v5.3 to v5.9
- Upgrade protobufjs from v7 to v8
- Upgrade @types/node from v20 to v25
- Upgrade sql.js, tsup, @types/papaparse to latest within-range versions
- Fix 10 npm audit vulnerabilities (minimatch ReDoS, esbuild dev server)

## 0.1.1

- Publish as ESM-only package (`"type": "module"`)
- Remove CJS build output
- Add automated CD workflow for npm publishing on GitHub release
- Remove migration guide from README (first public release)

## 0.1.0

- Initial public release
- GTFS static data loading from ZIP files (URL or local path)
- High-performance bulk loading with progress tracking
- Flexible filter-based query API for stops, routes, trips, stop times, shapes
- GTFS Realtime support (alerts, trip updates, vehicle positions)
- GeoJSON export for shapes
- Smart caching with IndexedDB and FileSystem stores
- Database export/import support
- Full TypeScript types
