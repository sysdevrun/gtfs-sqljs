/**
 * GTFS-SQLjs Cache Example for Node.js
 *
 * This example demonstrates how to use the FileSystem cache in Node.js
 */

import { GtfsSqlJs, FileSystemCacheStore } from 'gtfs-sqljs';

// Example 1: Automatic caching (default behavior)
async function example1_AutomaticCache() {
  console.log('\n=== Example 1: Automatic Caching ===');

  try {
    const startTime = Date.now();

    // Caching is automatic by default - uses FileSystemCacheStore in Node.js
    const gtfs = await GtfsSqlJs.fromZip('./data/gtfs.zip', {
      cacheVersion: '1.0',
      onProgress: (progress) => {
        console.log(`${progress.phase}: ${progress.message} (${progress.percentComplete}%)`);
      }
    });

    const loadTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✓ GTFS data loaded in ${loadTime}s`);

    const routes = gtfs.getRoutes();
    console.log(`Found ${routes.length} routes`);

    // On subsequent runs, loading will be much faster (from cache)

  } catch (error) {
    console.error('✗ Error:', error.message);
  }
}

// Example 2: Custom cache directory
async function example2_CustomCacheDir() {
  console.log('\n=== Example 2: Custom Cache Directory ===');

  try {
    const cache = new FileSystemCacheStore({
      dir: './my-custom-cache'
    });

    const gtfs = await GtfsSqlJs.fromZip('./data/gtfs.zip', {
      cache,
      cacheVersion: '1.0'
    });

    console.log('✓ Using custom cache directory: ./my-custom-cache');

  } catch (error) {
    console.error('✗ Error:', error.message);
  }
}

// Example 3: Cache management - Show statistics
async function example3_CacheStats() {
  console.log('\n=== Example 3: Cache Statistics ===');

  try {
    const stats = await GtfsSqlJs.getCacheStats();

    console.log('\nCache Statistics:');
    console.log(`- Total entries: ${stats.totalEntries}`);
    console.log(`- Active entries: ${stats.activeEntries}`);
    console.log(`- Expired entries: ${stats.expiredEntries}`);
    console.log(`- Total size: ${stats.totalSizeMB} MB`);

    if (stats.oldestEntry) {
      const oldest = new Date(stats.oldestEntry);
      console.log(`- Oldest entry: ${oldest.toLocaleString()}`);
    }

    if (stats.newestEntry) {
      const newest = new Date(stats.newestEntry);
      console.log(`- Newest entry: ${newest.toLocaleString()}`);
    }

  } catch (error) {
    console.error('✗ Error:', error.message);
  }
}

// Example 4: List cache entries
async function example4_ListCache() {
  console.log('\n=== Example 4: List Cache Entries ===');

  try {
    const entries = await GtfsSqlJs.listCache();

    console.log(`\nFound ${entries.length} active cache entries:`);

    entries.forEach((entry, index) => {
      const age = ((Date.now() - entry.metadata.timestamp) / 1000 / 60 / 60).toFixed(1);
      const sizeMB = (entry.metadata.size / 1024 / 1024).toFixed(2);

      console.log(`\n${index + 1}. ${entry.key}`);
      console.log(`   Source: ${entry.metadata.source || 'N/A'}`);
      console.log(`   Version: ${entry.metadata.version}`);
      console.log(`   Size: ${sizeMB} MB`);
      console.log(`   Age: ${age} hours`);
      console.log(`   Skip files: ${entry.metadata.skipFiles?.join(', ') || 'none'}`);
    });

  } catch (error) {
    console.error('✗ Error:', error.message);
  }
}

// Example 5: Clean expired cache entries
async function example5_CleanExpired() {
  console.log('\n=== Example 5: Clean Expired Cache ===');

  try {
    console.log('Cleaning expired cache entries (older than 7 days)...');
    const deletedCount = await GtfsSqlJs.cleanExpiredCache();

    console.log(`✓ Deleted ${deletedCount} expired entries`);

  } catch (error) {
    console.error('✗ Error:', error.message);
  }
}

// Example 6: Custom expiration time
async function example6_CustomExpiration() {
  console.log('\n=== Example 6: Custom Cache Expiration ===');

  try {
    // Clean entries older than 3 days
    const threeDaysInMs = 3 * 24 * 60 * 60 * 1000;

    console.log('Cleaning cache entries older than 3 days...');
    const deletedCount = await GtfsSqlJs.cleanExpiredCache(undefined, threeDaysInMs);

    console.log(`✓ Deleted ${deletedCount} entries`);

  } catch (error) {
    console.error('✗ Error:', error.message);
  }
}

// Example 7: Clear all cache
async function example7_ClearCache() {
  console.log('\n=== Example 7: Clear All Cache ===');

  try {
    console.log('Clearing all cache entries...');
    await GtfsSqlJs.clearCache();

    console.log('✓ Cache cleared');

  } catch (error) {
    console.error('✗ Error:', error.message);
  }
}

// Example 8: Disable caching
async function example8_DisableCache() {
  console.log('\n=== Example 8: Disable Caching ===');

  try {
    // Explicitly disable caching by passing null
    const gtfs = await GtfsSqlJs.fromZip('./data/gtfs.zip', {
      cache: null
    });

    console.log('✓ GTFS data loaded without caching');

  } catch (error) {
    console.error('✗ Error:', error.message);
  }
}

// Example 9: Version management
async function example9_VersionManagement() {
  console.log('\n=== Example 9: Cache Version Management ===');

  try {
    // Load with version 1.0
    const gtfs1 = await GtfsSqlJs.fromZip('./data/gtfs.zip', {
      cacheVersion: '1.0'
    });

    // Load with version 2.0 - will not use cache from v1.0
    const gtfs2 = await GtfsSqlJs.fromZip('./data/gtfs.zip', {
      cacheVersion: '2.0'
    });

    console.log('✓ Different versions create separate cache entries');
    console.log('  Tip: Increment version when you update processing logic or schema');

  } catch (error) {
    console.error('✗ Error:', error.message);
  }
}

// Run all examples
async function runAllExamples() {
  await example1_AutomaticCache();
  await example3_CacheStats();
  await example4_ListCache();
  await example5_CleanExpired();

  // Uncomment to run other examples:
  // await example2_CustomCacheDir();
  // await example6_CustomExpiration();
  // await example7_ClearCache();
  // await example8_DisableCache();
  // await example9_VersionManagement();
}

// Run examples
runAllExamples().catch(console.error);
