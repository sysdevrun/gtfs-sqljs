# Changelog

## Upcoming release

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
