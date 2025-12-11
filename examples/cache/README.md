# Cache Store Implementations

This directory contains optional cache store implementations for `gtfs-sqljs`. Copy the appropriate file to your project to enable caching.

## Available Implementations

### IndexedDBCacheStore (Browser)

For browser environments. Uses IndexedDB to persist processed GTFS databases.

```typescript
import { GtfsSqlJs } from 'gtfs-sqljs';
import { IndexedDBCacheStore } from './IndexedDBCacheStore';

const cache = new IndexedDBCacheStore();
const gtfs = await GtfsSqlJs.fromZip('gtfs.zip', {
  cache,
  cacheVersion: '1.0'
});
```

### FileSystemCacheStore (Node.js)

For Node.js environments only. **NOT compatible with browser or React Native.**

```typescript
import { GtfsSqlJs } from 'gtfs-sqljs';
import { FileSystemCacheStore } from './FileSystemCacheStore';

const cache = new FileSystemCacheStore({ dir: './.cache/gtfs' });
const gtfs = await GtfsSqlJs.fromZip('gtfs.zip', {
  cache,
  cacheVersion: '1.0'
});
```

## Custom Cache Implementation

You can implement your own cache store by implementing the `CacheStore` interface:

```typescript
import type { CacheStore, CacheMetadata, CacheEntry, CacheEntryWithData } from 'gtfs-sqljs';

export class MyCacheStore implements CacheStore {
  async get(key: string): Promise<CacheEntryWithData | null> { /* ... */ }
  async set(key: string, data: ArrayBuffer, metadata: CacheMetadata): Promise<void> { /* ... */ }
  async has(key: string): Promise<boolean> { /* ... */ }
  async delete(key: string): Promise<void> { /* ... */ }
  async clear(): Promise<void> { /* ... */ }
  async list?(): Promise<CacheEntry[]> { /* ... */ }
}
```

## Disabling Caching

To disable caching entirely, pass `cache: null`:

```typescript
const gtfs = await GtfsSqlJs.fromZip('gtfs.zip', {
  cache: null
});
```
