var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/cache/utils.ts
var utils_exports = {};
__export(utils_exports, {
  DEFAULT_CACHE_EXPIRATION_MS: () => DEFAULT_CACHE_EXPIRATION_MS,
  filterExpiredEntries: () => filterExpiredEntries,
  getCacheStats: () => getCacheStats,
  isCacheExpired: () => isCacheExpired
});
function isCacheExpired(metadata, expirationMs = DEFAULT_CACHE_EXPIRATION_MS) {
  const now = Date.now();
  const age = now - metadata.timestamp;
  return age > expirationMs;
}
function filterExpiredEntries(entries, expirationMs = DEFAULT_CACHE_EXPIRATION_MS) {
  return entries.filter((entry) => !isCacheExpired(entry.metadata, expirationMs));
}
function getCacheStats(entries) {
  const totalSize = entries.reduce((sum, entry) => sum + entry.metadata.size, 0);
  const expiredEntries = entries.filter((entry) => isCacheExpired(entry.metadata));
  const activeEntries = entries.filter((entry) => !isCacheExpired(entry.metadata));
  return {
    totalEntries: entries.length,
    activeEntries: activeEntries.length,
    expiredEntries: expiredEntries.length,
    totalSize,
    totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
    oldestEntry: entries.length > 0 ? Math.min(...entries.map((e) => e.metadata.timestamp)) : null,
    newestEntry: entries.length > 0 ? Math.max(...entries.map((e) => e.metadata.timestamp)) : null
  };
}
var DEFAULT_CACHE_EXPIRATION_MS;
var init_utils = __esm({
  "src/cache/utils.ts"() {
    "use strict";
    DEFAULT_CACHE_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1e3;
  }
});

// src/cache/indexeddb-store.ts
var indexeddb_store_exports = {};
__export(indexeddb_store_exports, {
  IndexedDBCacheStore: () => IndexedDBCacheStore
});
var IndexedDBCacheStore;
var init_indexeddb_store = __esm({
  "src/cache/indexeddb-store.ts"() {
    "use strict";
    IndexedDBCacheStore = class {
      constructor(options = {}) {
        this.storeName = "gtfs-cache";
        this.version = 1;
        this.dbName = options.dbName || "gtfs-sqljs-cache";
      }
      /**
       * Open IndexedDB connection
       */
      async openDB() {
        return new Promise((resolve, reject) => {
          const request = indexedDB.open(this.dbName, this.version);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result);
          request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(this.storeName)) {
              const store = db.createObjectStore(this.storeName, { keyPath: "key" });
              store.createIndex("timestamp", "metadata.timestamp", { unique: false });
            }
          };
        });
      }
      /**
       * Get a cached database with metadata
       */
      async get(key) {
        const db = await this.openDB();
        return new Promise((resolve, reject) => {
          const transaction = db.transaction([this.storeName], "readonly");
          const store = transaction.objectStore(this.storeName);
          const request = store.get(key);
          request.onerror = () => {
            db.close();
            reject(request.error);
          };
          request.onsuccess = () => {
            db.close();
            const result = request.result;
            if (result) {
              resolve({
                data: result.data,
                metadata: result.metadata
              });
            } else {
              resolve(null);
            }
          };
        });
      }
      /**
       * Store a database in cache
       */
      async set(key, data, metadata) {
        const db = await this.openDB();
        return new Promise((resolve, reject) => {
          const transaction = db.transaction([this.storeName], "readwrite");
          const store = transaction.objectStore(this.storeName);
          const record = {
            key,
            data,
            metadata
          };
          const request = store.put(record);
          request.onerror = () => {
            db.close();
            reject(request.error);
          };
          request.onsuccess = () => {
            db.close();
            resolve();
          };
        });
      }
      /**
       * Check if a cache entry exists
       */
      async has(key) {
        const db = await this.openDB();
        return new Promise((resolve, reject) => {
          const transaction = db.transaction([this.storeName], "readonly");
          const store = transaction.objectStore(this.storeName);
          const request = store.getKey(key);
          request.onerror = () => {
            db.close();
            reject(request.error);
          };
          request.onsuccess = () => {
            db.close();
            resolve(request.result !== void 0);
          };
        });
      }
      /**
       * Delete a specific cache entry
       */
      async delete(key) {
        const db = await this.openDB();
        return new Promise((resolve, reject) => {
          const transaction = db.transaction([this.storeName], "readwrite");
          const store = transaction.objectStore(this.storeName);
          const request = store.delete(key);
          request.onerror = () => {
            db.close();
            reject(request.error);
          };
          request.onsuccess = () => {
            db.close();
            resolve();
          };
        });
      }
      /**
       * Clear all cache entries
       */
      async clear() {
        const db = await this.openDB();
        return new Promise((resolve, reject) => {
          const transaction = db.transaction([this.storeName], "readwrite");
          const store = transaction.objectStore(this.storeName);
          const request = store.clear();
          request.onerror = () => {
            db.close();
            reject(request.error);
          };
          request.onsuccess = () => {
            db.close();
            resolve();
          };
        });
      }
      /**
       * List all cached entries
       */
      async list() {
        const db = await this.openDB();
        return new Promise((resolve, reject) => {
          const transaction = db.transaction([this.storeName], "readonly");
          const store = transaction.objectStore(this.storeName);
          const request = store.getAllKeys();
          request.onerror = () => {
            db.close();
            reject(request.error);
          };
          request.onsuccess = async () => {
            const keys = request.result;
            const entries = [];
            const metadataPromises = keys.map(async (key) => {
              const metaRequest = store.get(key);
              return new Promise((resolveEntry, rejectEntry) => {
                metaRequest.onerror = () => rejectEntry(metaRequest.error);
                metaRequest.onsuccess = () => {
                  const record = metaRequest.result;
                  resolveEntry({
                    key,
                    metadata: record.metadata
                  });
                };
              });
            });
            try {
              const results = await Promise.all(metadataPromises);
              entries.push(...results);
            } catch (error) {
              db.close();
              reject(error);
              return;
            }
            db.close();
            resolve(entries);
          };
        });
      }
    };
  }
});

// src/cache/fs-store.ts
var fs_store_exports = {};
__export(fs_store_exports, {
  FileSystemCacheStore: () => FileSystemCacheStore
});
var FileSystemCacheStore;
var init_fs_store = __esm({
  "src/cache/fs-store.ts"() {
    "use strict";
    FileSystemCacheStore = class {
      constructor(options = {}) {
        this.cacheDir = options.dir || "";
      }
      /**
       * Get the cache directory path (lazy initialization)
       */
      async getCacheDir() {
        if (this.cacheDir) {
          return this.cacheDir;
        }
        const path = await import("path");
        const os = await import("os");
        this.cacheDir = path.join(
          process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache"),
          "gtfs-sqljs"
        );
        return this.cacheDir;
      }
      /**
       * Ensure cache directory exists
       */
      async ensureCacheDir() {
        const fs = await import("fs");
        const cacheDir = await this.getCacheDir();
        try {
          await fs.promises.mkdir(cacheDir, { recursive: true });
        } catch (error) {
          if (error.code !== "EEXIST") {
            throw error;
          }
        }
      }
      /**
       * Get file path for a cache key
       */
      async getFilePath(key) {
        const path = await import("path");
        const cacheDir = await this.getCacheDir();
        const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, "_");
        return path.join(cacheDir, `${safeKey}.db`);
      }
      /**
       * Get metadata file path for a cache key
       */
      async getMetadataPath(key) {
        const path = await import("path");
        const cacheDir = await this.getCacheDir();
        const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, "_");
        return path.join(cacheDir, `${safeKey}.meta.json`);
      }
      /**
       * Get a cached database with metadata
       */
      async get(key) {
        const fs = await import("fs");
        try {
          const filePath = await this.getFilePath(key);
          const metadataPath = await this.getMetadataPath(key);
          const [buffer, metadataContent] = await Promise.all([
            fs.promises.readFile(filePath),
            fs.promises.readFile(metadataPath, "utf-8")
          ]);
          const data = buffer.buffer.slice(
            buffer.byteOffset,
            buffer.byteOffset + buffer.byteLength
          );
          const metadata = JSON.parse(metadataContent);
          return { data, metadata };
        } catch (error) {
          if (error.code === "ENOENT") {
            return null;
          }
          throw error;
        }
      }
      /**
       * Store a database in cache
       */
      async set(key, data, metadata) {
        const fs = await import("fs");
        await this.ensureCacheDir();
        const filePath = await this.getFilePath(key);
        const metadataPath = await this.getMetadataPath(key);
        await fs.promises.writeFile(filePath, new Uint8Array(data));
        await fs.promises.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
      }
      /**
       * Check if a cache entry exists
       */
      async has(key) {
        const fs = await import("fs");
        try {
          const filePath = await this.getFilePath(key);
          await fs.promises.access(filePath);
          return true;
        } catch {
          return false;
        }
      }
      /**
       * Delete a specific cache entry
       */
      async delete(key) {
        const fs = await import("fs");
        const filePath = await this.getFilePath(key);
        const metadataPath = await this.getMetadataPath(key);
        try {
          await fs.promises.unlink(filePath);
        } catch (error) {
          if (error.code !== "ENOENT") {
            throw error;
          }
        }
        try {
          await fs.promises.unlink(metadataPath);
        } catch {
        }
      }
      /**
       * Clear all cache entries
       */
      async clear() {
        const fs = await import("fs");
        const path = await import("path");
        const cacheDir = await this.getCacheDir();
        try {
          const files = await fs.promises.readdir(cacheDir);
          await Promise.all(
            files.map(
              (file) => fs.promises.unlink(path.join(cacheDir, file)).catch(() => {
              })
            )
          );
        } catch (error) {
          if (error.code !== "ENOENT") {
            throw error;
          }
        }
      }
      /**
       * List all cached entries
       */
      async list() {
        const fs = await import("fs");
        const path = await import("path");
        const cacheDir = await this.getCacheDir();
        try {
          const files = await fs.promises.readdir(cacheDir);
          const metadataFiles = files.filter((f) => f.endsWith(".meta.json"));
          const entries = [];
          for (const metaFile of metadataFiles) {
            try {
              const metaPath = path.join(cacheDir, metaFile);
              const metaContent = await fs.promises.readFile(metaPath, "utf-8");
              const metadata = JSON.parse(metaContent);
              const key = metaFile.replace(".meta.json", "");
              entries.push({ key, metadata });
            } catch {
            }
          }
          return entries;
        } catch (error) {
          if (error.code === "ENOENT") {
            return [];
          }
          throw error;
        }
      }
    };
  }
});

// src/gtfs-sqljs.ts
import initSqlJs from "sql.js";

// src/schema/schema.ts
var GTFS_SCHEMA = [
  {
    name: "agency",
    columns: [
      { name: "agency_id", type: "TEXT", required: true, primaryKey: true },
      { name: "agency_name", type: "TEXT", required: true },
      { name: "agency_url", type: "TEXT", required: true },
      { name: "agency_timezone", type: "TEXT", required: true },
      { name: "agency_lang", type: "TEXT", required: false },
      { name: "agency_phone", type: "TEXT", required: false },
      { name: "agency_fare_url", type: "TEXT", required: false },
      { name: "agency_email", type: "TEXT", required: false }
    ]
  },
  {
    name: "stops",
    columns: [
      { name: "stop_id", type: "TEXT", required: true, primaryKey: true },
      { name: "stop_name", type: "TEXT", required: true },
      { name: "stop_lat", type: "REAL", required: true },
      { name: "stop_lon", type: "REAL", required: true },
      { name: "stop_code", type: "TEXT", required: false },
      { name: "stop_desc", type: "TEXT", required: false },
      { name: "zone_id", type: "TEXT", required: false },
      { name: "stop_url", type: "TEXT", required: false },
      { name: "location_type", type: "INTEGER", required: false },
      { name: "parent_station", type: "TEXT", required: false },
      { name: "stop_timezone", type: "TEXT", required: false },
      { name: "wheelchair_boarding", type: "INTEGER", required: false },
      { name: "level_id", type: "TEXT", required: false },
      { name: "platform_code", type: "TEXT", required: false }
    ],
    indexes: [
      { name: "idx_stops_stop_code", columns: ["stop_code"] },
      { name: "idx_stops_stop_name", columns: ["stop_name"] },
      { name: "idx_stops_parent_station", columns: ["parent_station"] }
    ]
  },
  {
    name: "routes",
    columns: [
      { name: "route_id", type: "TEXT", required: true, primaryKey: true },
      { name: "route_short_name", type: "TEXT", required: true },
      { name: "route_long_name", type: "TEXT", required: true },
      { name: "route_type", type: "INTEGER", required: true },
      { name: "agency_id", type: "TEXT", required: false },
      { name: "route_desc", type: "TEXT", required: false },
      { name: "route_url", type: "TEXT", required: false },
      { name: "route_color", type: "TEXT", required: false },
      { name: "route_text_color", type: "TEXT", required: false },
      { name: "route_sort_order", type: "INTEGER", required: false },
      { name: "continuous_pickup", type: "INTEGER", required: false },
      { name: "continuous_drop_off", type: "INTEGER", required: false }
    ],
    indexes: [
      { name: "idx_routes_agency_id", columns: ["agency_id"] }
    ]
  },
  {
    name: "trips",
    columns: [
      { name: "trip_id", type: "TEXT", required: true, primaryKey: true },
      { name: "route_id", type: "TEXT", required: true },
      { name: "service_id", type: "TEXT", required: true },
      { name: "trip_headsign", type: "TEXT", required: false },
      { name: "trip_short_name", type: "TEXT", required: false },
      { name: "direction_id", type: "INTEGER", required: false },
      { name: "block_id", type: "TEXT", required: false },
      { name: "shape_id", type: "TEXT", required: false },
      { name: "wheelchair_accessible", type: "INTEGER", required: false },
      { name: "bikes_allowed", type: "INTEGER", required: false }
    ],
    indexes: [
      { name: "idx_trips_route_id", columns: ["route_id"] },
      { name: "idx_trips_service_id", columns: ["service_id"] },
      { name: "idx_trips_route_service", columns: ["route_id", "service_id"] }
    ]
  },
  {
    name: "stop_times",
    columns: [
      { name: "trip_id", type: "TEXT", required: true },
      { name: "arrival_time", type: "TEXT", required: true },
      { name: "departure_time", type: "TEXT", required: true },
      { name: "stop_id", type: "TEXT", required: true },
      { name: "stop_sequence", type: "INTEGER", required: true },
      { name: "stop_headsign", type: "TEXT", required: false },
      { name: "pickup_type", type: "INTEGER", required: false },
      { name: "drop_off_type", type: "INTEGER", required: false },
      { name: "continuous_pickup", type: "INTEGER", required: false },
      { name: "continuous_drop_off", type: "INTEGER", required: false },
      { name: "shape_dist_traveled", type: "REAL", required: false },
      { name: "timepoint", type: "INTEGER", required: false }
    ],
    indexes: [
      { name: "idx_stop_times_trip_id", columns: ["trip_id"] },
      { name: "idx_stop_times_stop_id", columns: ["stop_id"] },
      { name: "idx_stop_times_trip_sequence", columns: ["trip_id", "stop_sequence"] }
    ]
  },
  {
    name: "calendar",
    columns: [
      { name: "service_id", type: "TEXT", required: true, primaryKey: true },
      { name: "monday", type: "INTEGER", required: true },
      { name: "tuesday", type: "INTEGER", required: true },
      { name: "wednesday", type: "INTEGER", required: true },
      { name: "thursday", type: "INTEGER", required: true },
      { name: "friday", type: "INTEGER", required: true },
      { name: "saturday", type: "INTEGER", required: true },
      { name: "sunday", type: "INTEGER", required: true },
      { name: "start_date", type: "TEXT", required: true },
      { name: "end_date", type: "TEXT", required: true }
    ]
  },
  {
    name: "calendar_dates",
    columns: [
      { name: "service_id", type: "TEXT", required: true },
      { name: "date", type: "TEXT", required: true },
      { name: "exception_type", type: "INTEGER", required: true }
    ],
    indexes: [
      { name: "idx_calendar_dates_service_id", columns: ["service_id"] },
      { name: "idx_calendar_dates_date", columns: ["date"] },
      { name: "idx_calendar_dates_service_date", columns: ["service_id", "date"] }
    ]
  },
  {
    name: "fare_attributes",
    columns: [
      { name: "fare_id", type: "TEXT", required: true, primaryKey: true },
      { name: "price", type: "REAL", required: true },
      { name: "currency_type", type: "TEXT", required: true },
      { name: "payment_method", type: "INTEGER", required: true },
      { name: "transfers", type: "INTEGER", required: true },
      { name: "agency_id", type: "TEXT", required: false },
      { name: "transfer_duration", type: "INTEGER", required: false }
    ]
  },
  {
    name: "fare_rules",
    columns: [
      { name: "fare_id", type: "TEXT", required: true },
      { name: "route_id", type: "TEXT", required: false },
      { name: "origin_id", type: "TEXT", required: false },
      { name: "destination_id", type: "TEXT", required: false },
      { name: "contains_id", type: "TEXT", required: false }
    ],
    indexes: [
      { name: "idx_fare_rules_fare_id", columns: ["fare_id"] },
      { name: "idx_fare_rules_route_id", columns: ["route_id"] }
    ]
  },
  {
    name: "shapes",
    columns: [
      { name: "shape_id", type: "TEXT", required: true },
      { name: "shape_pt_lat", type: "REAL", required: true },
      { name: "shape_pt_lon", type: "REAL", required: true },
      { name: "shape_pt_sequence", type: "INTEGER", required: true },
      { name: "shape_dist_traveled", type: "REAL", required: false }
    ],
    indexes: [
      { name: "idx_shapes_shape_id", columns: ["shape_id"] },
      { name: "idx_shapes_shape_sequence", columns: ["shape_id", "shape_pt_sequence"] }
    ]
  },
  {
    name: "frequencies",
    columns: [
      { name: "trip_id", type: "TEXT", required: true },
      { name: "start_time", type: "TEXT", required: true },
      { name: "end_time", type: "TEXT", required: true },
      { name: "headway_secs", type: "INTEGER", required: true },
      { name: "exact_times", type: "INTEGER", required: false }
    ],
    indexes: [
      { name: "idx_frequencies_trip_id", columns: ["trip_id"] }
    ]
  },
  {
    name: "transfers",
    columns: [
      { name: "from_stop_id", type: "TEXT", required: true },
      { name: "to_stop_id", type: "TEXT", required: true },
      { name: "transfer_type", type: "INTEGER", required: true },
      { name: "min_transfer_time", type: "INTEGER", required: false }
    ],
    indexes: [
      { name: "idx_transfers_from_stop_id", columns: ["from_stop_id"] },
      { name: "idx_transfers_to_stop_id", columns: ["to_stop_id"] }
    ]
  },
  {
    name: "pathways",
    columns: [
      { name: "pathway_id", type: "TEXT", required: true, primaryKey: true },
      { name: "from_stop_id", type: "TEXT", required: true },
      { name: "to_stop_id", type: "TEXT", required: true },
      { name: "pathway_mode", type: "INTEGER", required: true },
      { name: "is_bidirectional", type: "INTEGER", required: true },
      { name: "length", type: "REAL", required: false },
      { name: "traversal_time", type: "INTEGER", required: false },
      { name: "stair_count", type: "INTEGER", required: false },
      { name: "max_slope", type: "REAL", required: false },
      { name: "min_width", type: "REAL", required: false },
      { name: "signposted_as", type: "TEXT", required: false },
      { name: "reversed_signposted_as", type: "TEXT", required: false }
    ]
  },
  {
    name: "levels",
    columns: [
      { name: "level_id", type: "TEXT", required: true, primaryKey: true },
      { name: "level_index", type: "REAL", required: true },
      { name: "level_name", type: "TEXT", required: false }
    ]
  },
  {
    name: "feed_info",
    columns: [
      { name: "feed_publisher_name", type: "TEXT", required: true },
      { name: "feed_publisher_url", type: "TEXT", required: true },
      { name: "feed_lang", type: "TEXT", required: true },
      { name: "default_lang", type: "TEXT", required: false },
      { name: "feed_start_date", type: "TEXT", required: false },
      { name: "feed_end_date", type: "TEXT", required: false },
      { name: "feed_version", type: "TEXT", required: false },
      { name: "feed_contact_email", type: "TEXT", required: false },
      { name: "feed_contact_url", type: "TEXT", required: false }
    ]
  },
  {
    name: "attributions",
    columns: [
      { name: "attribution_id", type: "TEXT", required: true, primaryKey: true },
      { name: "organization_name", type: "TEXT", required: true },
      { name: "agency_id", type: "TEXT", required: false },
      { name: "route_id", type: "TEXT", required: false },
      { name: "trip_id", type: "TEXT", required: false },
      { name: "is_producer", type: "INTEGER", required: false },
      { name: "is_operator", type: "INTEGER", required: false },
      { name: "is_authority", type: "INTEGER", required: false },
      { name: "attribution_url", type: "TEXT", required: false },
      { name: "attribution_email", type: "TEXT", required: false },
      { name: "attribution_phone", type: "TEXT", required: false }
    ]
  }
];
function generateCreateTableSQL(schema) {
  const columns = schema.columns.map((col) => {
    const parts = [col.name, col.type];
    if (col.primaryKey) {
      parts.push("PRIMARY KEY");
    }
    if (col.required && !col.primaryKey) {
      parts.push("NOT NULL");
    }
    return parts.join(" ");
  });
  return `CREATE TABLE IF NOT EXISTS ${schema.name} (${columns.join(", ")})`;
}
function generateCreateIndexSQL(schema) {
  if (!schema.indexes) {
    return [];
  }
  return schema.indexes.map((idx) => {
    const unique = idx.unique ? "UNIQUE " : "";
    const columns = idx.columns.join(", ");
    return `CREATE ${unique}INDEX IF NOT EXISTS ${idx.name} ON ${schema.name} (${columns})`;
  });
}
function getAllCreateTableStatements() {
  const statements = [];
  for (const schema of GTFS_SCHEMA) {
    statements.push(generateCreateTableSQL(schema));
  }
  return statements;
}
function getAllCreateIndexStatements() {
  const statements = [];
  for (const schema of GTFS_SCHEMA) {
    statements.push(...generateCreateIndexSQL(schema));
  }
  return statements;
}

// src/loaders/zip-loader.ts
import JSZip from "jszip";
async function loadGTFSZip(source) {
  let zipData;
  if (typeof source === "string") {
    zipData = await fetchZip(source);
  } else {
    zipData = source;
  }
  const zip = await JSZip.loadAsync(zipData);
  const files = {};
  const filePromises = [];
  zip.forEach((relativePath, file) => {
    if (!file.dir && relativePath.endsWith(".txt")) {
      const fileName = relativePath.split("/").pop() || relativePath;
      filePromises.push(
        file.async("string").then((content) => {
          files[fileName] = content;
        })
      );
    }
  });
  await Promise.all(filePromises);
  return files;
}
async function fetchZip(source) {
  const isUrl = source.startsWith("http://") || source.startsWith("https://");
  if (isUrl) {
    if (typeof fetch !== "undefined") {
      const response = await fetch(source);
      if (!response.ok) {
        throw new Error(`Failed to fetch GTFS ZIP: ${response.status} ${response.statusText}`);
      }
      return await response.arrayBuffer();
    }
    throw new Error("fetch is not available to load URL");
  }
  const isNode = typeof process !== "undefined" && process.versions != null && process.versions.node != null;
  if (isNode) {
    try {
      const fs = await import("fs");
      const buffer = await fs.promises.readFile(source);
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    } catch (error) {
      throw new Error(`Failed to read GTFS ZIP file: ${error}`);
    }
  }
  if (typeof fetch !== "undefined") {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Failed to fetch GTFS ZIP: ${response.status} ${response.statusText}`);
    }
    return await response.arrayBuffer();
  }
  throw new Error("No method available to load ZIP file");
}

// src/loaders/csv-parser.ts
import Papa from "papaparse";
function parseCSV(text) {
  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
    transform: (value) => value.trim()
  });
  if (result.errors.length > 0) {
    console.warn("CSV parsing warnings:", result.errors);
  }
  const headers = result.meta.fields || [];
  const rows = result.data;
  return { headers, rows };
}

// src/loaders/data-loader.ts
async function loadGTFSData(db, files, skipFiles, onProgress) {
  const fileToSchema = /* @__PURE__ */ new Map();
  for (const schema of GTFS_SCHEMA) {
    fileToSchema.set(`${schema.name}.txt`, schema);
  }
  const skipSet = new Set(skipFiles?.map((f) => f.toLowerCase()) || []);
  const filePriority = [
    "agency.txt",
    "feed_info.txt",
    "attributions.txt",
    "levels.txt",
    "routes.txt",
    "calendar.txt",
    "calendar_dates.txt",
    "fare_attributes.txt",
    "fare_rules.txt",
    "stops.txt",
    "pathways.txt",
    "transfers.txt",
    "trips.txt",
    "frequencies.txt",
    "shapes.txt",
    "stop_times.txt"
    // Largest file - process last
  ];
  const sortedFiles = [];
  for (const priorityFile of filePriority) {
    if (files[priorityFile]) {
      sortedFiles.push([priorityFile, files[priorityFile]]);
    }
  }
  for (const [fileName, content] of Object.entries(files)) {
    if (!filePriority.includes(fileName)) {
      sortedFiles.push([fileName, content]);
    }
  }
  let totalRows = 0;
  const fileRowCounts = /* @__PURE__ */ new Map();
  for (const [fileName, content] of sortedFiles) {
    const schema = fileToSchema.get(fileName);
    if (schema && !skipSet.has(fileName.toLowerCase())) {
      const { rows } = parseCSV(content);
      fileRowCounts.set(fileName, rows.length);
      totalRows += rows.length;
    }
  }
  let rowsProcessed = 0;
  let filesCompleted = 0;
  for (const [fileName, content] of sortedFiles) {
    const schema = fileToSchema.get(fileName);
    if (!schema) {
      continue;
    }
    if (skipSet.has(fileName.toLowerCase())) {
      console.log(`Skipping import of ${fileName} (table ${schema.name} created but empty)`);
      filesCompleted++;
      continue;
    }
    const fileRows = fileRowCounts.get(fileName) || 0;
    onProgress?.({
      phase: "inserting_data",
      currentFile: fileName,
      filesCompleted,
      totalFiles: sortedFiles.length,
      rowsProcessed,
      totalRows,
      percentComplete: 15 + Math.floor(rowsProcessed / totalRows * 70),
      message: `Loading ${fileName} (${fileRows.toLocaleString()} rows)`
    });
    await loadTableData(db, schema, content, (processedInFile) => {
      const currentProgress = rowsProcessed + processedInFile;
      onProgress?.({
        phase: "inserting_data",
        currentFile: fileName,
        filesCompleted,
        totalFiles: sortedFiles.length,
        rowsProcessed: currentProgress,
        totalRows,
        percentComplete: 15 + Math.floor(currentProgress / totalRows * 70),
        message: `Loading ${fileName} (${processedInFile.toLocaleString()}/${fileRows.toLocaleString()} rows)`
      });
    });
    rowsProcessed += fileRows;
    filesCompleted++;
    onProgress?.({
      phase: "inserting_data",
      currentFile: null,
      filesCompleted,
      totalFiles: sortedFiles.length,
      rowsProcessed,
      totalRows,
      percentComplete: 15 + Math.floor(rowsProcessed / totalRows * 70),
      message: `Completed ${fileName}`
    });
  }
}
async function loadTableData(db, schema, csvContent, onProgress) {
  const { headers, rows } = parseCSV(csvContent);
  if (rows.length === 0) {
    return;
  }
  const columns = headers.filter((h) => schema.columns.some((c) => c.name === h));
  if (columns.length === 0) {
    return;
  }
  const BATCH_SIZE = 1e3;
  let rowsProcessed = 0;
  db.run("BEGIN TRANSACTION");
  try {
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batchRows = rows.slice(i, Math.min(i + BATCH_SIZE, rows.length));
      const placeholders = batchRows.map(() => `(${columns.map(() => "?").join(", ")})`).join(", ");
      const insertSQL = `INSERT INTO ${schema.name} (${columns.join(", ")}) VALUES ${placeholders}`;
      const allValues = [];
      for (const row of batchRows) {
        for (const col of columns) {
          const value = row[col];
          allValues.push(value === null || value === void 0 || value === "" ? null : value);
        }
      }
      const stmt = db.prepare(insertSQL);
      try {
        stmt.run(allValues);
      } catch (error) {
        console.error(`Error inserting batch into ${schema.name}:`, error);
        console.error("Batch size:", batchRows.length);
        throw error;
      } finally {
        stmt.free();
      }
      rowsProcessed += batchRows.length;
      onProgress?.(rowsProcessed);
    }
    db.run("COMMIT");
  } catch (error) {
    try {
      db.run("ROLLBACK");
    } catch (rollbackError) {
      console.error("Error rolling back transaction:", rollbackError);
    }
    throw error;
  }
}

// src/schema/gtfs-rt-schema.ts
function createRealtimeTables(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS rt_alerts (
      id TEXT PRIMARY KEY,
      active_period TEXT,           -- JSON array of TimeRange objects
      informed_entity TEXT,          -- JSON array of EntitySelector objects
      cause INTEGER,
      effect INTEGER,
      url TEXT,                      -- JSON TranslatedString
      header_text TEXT,              -- JSON TranslatedString
      description_text TEXT,         -- JSON TranslatedString
      rt_last_updated INTEGER NOT NULL
    )
  `);
  db.run("CREATE INDEX IF NOT EXISTS idx_rt_alerts_updated ON rt_alerts(rt_last_updated)");
  db.run(`
    CREATE TABLE IF NOT EXISTS rt_vehicle_positions (
      trip_id TEXT PRIMARY KEY,
      route_id TEXT,
      vehicle_id TEXT,
      vehicle_label TEXT,
      vehicle_license_plate TEXT,
      latitude REAL,
      longitude REAL,
      bearing REAL,
      odometer REAL,
      speed REAL,
      current_stop_sequence INTEGER,
      stop_id TEXT,
      current_status INTEGER,
      timestamp INTEGER,
      congestion_level INTEGER,
      occupancy_status INTEGER,
      rt_last_updated INTEGER NOT NULL
    )
  `);
  db.run("CREATE INDEX IF NOT EXISTS idx_rt_vehicle_positions_updated ON rt_vehicle_positions(rt_last_updated)");
  db.run("CREATE INDEX IF NOT EXISTS idx_rt_vehicle_positions_route ON rt_vehicle_positions(route_id)");
  db.run(`
    CREATE TABLE IF NOT EXISTS rt_trip_updates (
      trip_id TEXT PRIMARY KEY,
      route_id TEXT,
      vehicle_id TEXT,
      vehicle_label TEXT,
      vehicle_license_plate TEXT,
      timestamp INTEGER,
      delay INTEGER,
      schedule_relationship INTEGER,
      rt_last_updated INTEGER NOT NULL
    )
  `);
  db.run("CREATE INDEX IF NOT EXISTS idx_rt_trip_updates_updated ON rt_trip_updates(rt_last_updated)");
  db.run("CREATE INDEX IF NOT EXISTS idx_rt_trip_updates_route ON rt_trip_updates(route_id)");
  db.run(`
    CREATE TABLE IF NOT EXISTS rt_stop_time_updates (
      trip_id TEXT NOT NULL,
      stop_sequence INTEGER,
      stop_id TEXT,
      arrival_delay INTEGER,
      arrival_time INTEGER,
      arrival_uncertainty INTEGER,
      departure_delay INTEGER,
      departure_time INTEGER,
      departure_uncertainty INTEGER,
      schedule_relationship INTEGER,
      rt_last_updated INTEGER NOT NULL,
      PRIMARY KEY (trip_id, stop_sequence),
      FOREIGN KEY (trip_id) REFERENCES rt_trip_updates(trip_id) ON DELETE CASCADE
    )
  `);
  db.run("CREATE INDEX IF NOT EXISTS idx_rt_stop_time_updates_updated ON rt_stop_time_updates(rt_last_updated)");
  db.run("CREATE INDEX IF NOT EXISTS idx_rt_stop_time_updates_stop ON rt_stop_time_updates(stop_id)");
}
function clearRealtimeData(db) {
  db.run("DELETE FROM rt_alerts");
  db.run("DELETE FROM rt_vehicle_positions");
  db.run("DELETE FROM rt_trip_updates");
  db.run("DELETE FROM rt_stop_time_updates");
}

// src/loaders/gtfs-rt-loader.ts
import protobuf from "protobufjs";
var GTFS_RT_PROTO = `
syntax = "proto2";
option java_package = "com.google.transit.realtime";
package transit_realtime;

message FeedMessage {
  required FeedHeader header = 1;
  repeated FeedEntity entity = 2;
}

message FeedHeader {
  required string gtfs_realtime_version = 1;
  enum Incrementality {
    FULL_DATASET = 0;
    DIFFERENTIAL = 1;
  }
  optional Incrementality incrementality = 2 [default = FULL_DATASET];
  optional uint64 timestamp = 3;
}

message FeedEntity {
  required string id = 1;
  optional bool is_deleted = 2 [default = false];
  optional TripUpdate trip_update = 3;
  optional VehiclePosition vehicle = 4;
  optional Alert alert = 5;
}

message TripUpdate {
  required TripDescriptor trip = 1;
  optional VehicleDescriptor vehicle = 3;
  repeated StopTimeUpdate stop_time_update = 2;
  optional uint64 timestamp = 4;
  optional int32 delay = 5;

  message StopTimeEvent {
    optional int32 delay = 1;
    optional int64 time = 2;
    optional int32 uncertainty = 3;
  }

  message StopTimeUpdate {
    optional uint32 stop_sequence = 1;
    optional string stop_id = 4;
    optional StopTimeEvent arrival = 2;
    optional StopTimeEvent departure = 3;
    enum ScheduleRelationship {
      SCHEDULED = 0;
      SKIPPED = 1;
      NO_DATA = 2;
    }
    optional ScheduleRelationship schedule_relationship = 5 [default = SCHEDULED];
  }
}

message VehiclePosition {
  optional TripDescriptor trip = 1;
  optional VehicleDescriptor vehicle = 8;
  optional Position position = 2;
  optional uint32 current_stop_sequence = 3;
  optional string stop_id = 7;
  enum VehicleStopStatus {
    INCOMING_AT = 0;
    STOPPED_AT = 1;
    IN_TRANSIT_TO = 2;
  }
  optional VehicleStopStatus current_status = 4 [default = IN_TRANSIT_TO];
  optional uint64 timestamp = 5;
  enum CongestionLevel {
    UNKNOWN_CONGESTION_LEVEL = 0;
    RUNNING_SMOOTHLY = 1;
    STOP_AND_GO = 2;
    CONGESTION = 3;
    SEVERE_CONGESTION = 4;
  }
  optional CongestionLevel congestion_level = 6;
  enum OccupancyStatus {
    EMPTY = 0;
    MANY_SEATS_AVAILABLE = 1;
    FEW_SEATS_AVAILABLE = 2;
    STANDING_ROOM_ONLY = 3;
    CRUSHED_STANDING_ROOM_ONLY = 4;
    FULL = 5;
    NOT_ACCEPTING_PASSENGERS = 6;
  }
  optional OccupancyStatus occupancy_status = 9;
}

message Alert {
  repeated TimeRange active_period = 1;
  repeated EntitySelector informed_entity = 5;

  enum Cause {
    UNKNOWN_CAUSE = 1;
    OTHER_CAUSE = 2;
    TECHNICAL_PROBLEM = 3;
    STRIKE = 4;
    DEMONSTRATION = 5;
    ACCIDENT = 6;
    HOLIDAY = 7;
    WEATHER = 8;
    MAINTENANCE = 9;
    CONSTRUCTION = 10;
    POLICE_ACTIVITY = 11;
    MEDICAL_EMERGENCY = 12;
  }
  optional Cause cause = 6 [default = UNKNOWN_CAUSE];

  enum Effect {
    NO_SERVICE = 1;
    REDUCED_SERVICE = 2;
    SIGNIFICANT_DELAYS = 3;
    DETOUR = 4;
    ADDITIONAL_SERVICE = 5;
    MODIFIED_SERVICE = 6;
    OTHER_EFFECT = 7;
    UNKNOWN_EFFECT = 8;
    STOP_MOVED = 9;
    NO_EFFECT = 10;
    ACCESSIBILITY_ISSUE = 11;
  }
  optional Effect effect = 7 [default = UNKNOWN_EFFECT];
  optional TranslatedString url = 8;
  optional TranslatedString header_text = 10;
  optional TranslatedString description_text = 11;
}

message TimeRange {
  optional uint64 start = 1;
  optional uint64 end = 2;
}

message Position {
  required float latitude = 1;
  required float longitude = 2;
  optional float bearing = 3;
  optional double odometer = 4;
  optional float speed = 5;
}

message TripDescriptor {
  optional string trip_id = 1;
  optional string route_id = 5;
  optional uint32 direction_id = 6;
  optional string start_time = 2;
  optional string start_date = 3;
  enum ScheduleRelationship {
    SCHEDULED = 0;
    ADDED = 1;
    UNSCHEDULED = 2;
    CANCELED = 3;
  }
  optional ScheduleRelationship schedule_relationship = 4;
}

message VehicleDescriptor {
  optional string id = 1;
  optional string label = 2;
  optional string license_plate = 3;
}

message EntitySelector {
  optional string agency_id = 1;
  optional string route_id = 2;
  optional int32 route_type = 3;
  optional TripDescriptor trip = 4;
  optional string stop_id = 5;
}

message TranslatedString {
  message Translation {
    required string text = 1;
    optional string language = 2;
  }
  repeated Translation translation = 1;
}
`;
async function fetchProtobuf(source) {
  const isUrl = source.startsWith("http://") || source.startsWith("https://");
  if (isUrl) {
    const response2 = await fetch(source, {
      headers: {
        "Accept": "application/x-protobuf, application/octet-stream"
      }
    });
    if (!response2.ok) {
      throw new Error(`Failed to fetch GTFS-RT feed from ${source}: ${response2.status} ${response2.statusText}`);
    }
    const arrayBuffer2 = await response2.arrayBuffer();
    return new Uint8Array(arrayBuffer2);
  }
  const isNode = typeof process !== "undefined" && process.versions != null && process.versions.node != null;
  if (isNode) {
    try {
      const fs = await import("fs");
      const buffer = await fs.promises.readFile(source);
      return new Uint8Array(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
    } catch (error) {
      throw new Error(`Failed to read GTFS-RT file from ${source}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const response = await fetch(source, {
    headers: {
      "Accept": "application/x-protobuf, application/octet-stream"
    }
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch GTFS-RT feed from ${source}: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}
var gtfsRtRoot = null;
function loadGtfsRtProto() {
  if (!gtfsRtRoot) {
    gtfsRtRoot = protobuf.parse(GTFS_RT_PROTO).root;
  }
  return gtfsRtRoot;
}
function camelToSnake(str) {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}
function convertKeysToSnakeCase(obj) {
  if (obj === null || obj === void 0) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(convertKeysToSnakeCase);
  }
  if (typeof obj === "object") {
    const result = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const snakeKey = camelToSnake(key);
        result[snakeKey] = convertKeysToSnakeCase(obj[key]);
      }
    }
    return result;
  }
  return obj;
}
function parseTranslatedString(ts) {
  if (!ts || !ts.translation || ts.translation.length === 0) {
    return null;
  }
  return JSON.stringify({
    translation: ts.translation.map((t) => ({
      text: t.text,
      language: t.language || void 0
    }))
  });
}
function insertAlerts(db, alerts, timestamp) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO rt_alerts (
      id, active_period, informed_entity, cause, effect,
      url, header_text, description_text, rt_last_updated
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const alert of alerts) {
    const activePeriodSnake = convertKeysToSnakeCase(alert.activePeriod || []);
    const informedEntitySnake = convertKeysToSnakeCase(alert.informedEntity || []);
    stmt.run([
      alert.id,
      JSON.stringify(activePeriodSnake),
      JSON.stringify(informedEntitySnake),
      alert.cause || null,
      alert.effect || null,
      parseTranslatedString(alert.url),
      parseTranslatedString(alert.headerText),
      parseTranslatedString(alert.descriptionText),
      timestamp
    ]);
  }
  stmt.free();
}
function insertVehiclePositions(db, positions, timestamp) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO rt_vehicle_positions (
      trip_id, route_id, vehicle_id, vehicle_label, vehicle_license_plate,
      latitude, longitude, bearing, odometer, speed,
      current_stop_sequence, stop_id, current_status, timestamp,
      congestion_level, occupancy_status, rt_last_updated
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const vp of positions) {
    const trip = vp.trip;
    if (!trip || !trip.tripId) continue;
    stmt.run([
      trip.tripId,
      trip.routeId || null,
      vp.vehicle?.id || null,
      vp.vehicle?.label || null,
      vp.vehicle?.licensePlate || null,
      vp.position?.latitude || null,
      vp.position?.longitude || null,
      vp.position?.bearing || null,
      vp.position?.odometer || null,
      vp.position?.speed || null,
      vp.currentStopSequence || null,
      vp.stopId || null,
      vp.currentStatus || null,
      vp.timestamp || null,
      vp.congestionLevel || null,
      vp.occupancyStatus || null,
      timestamp
    ]);
  }
  stmt.free();
}
function insertTripUpdates(db, updates, timestamp) {
  const tripStmt = db.prepare(`
    INSERT OR REPLACE INTO rt_trip_updates (
      trip_id, route_id, vehicle_id, vehicle_label, vehicle_license_plate,
      timestamp, delay, schedule_relationship, rt_last_updated
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const stopTimeStmt = db.prepare(`
    INSERT OR REPLACE INTO rt_stop_time_updates (
      trip_id, stop_sequence, stop_id,
      arrival_delay, arrival_time, arrival_uncertainty,
      departure_delay, departure_time, departure_uncertainty,
      schedule_relationship, rt_last_updated
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const tu of updates) {
    const trip = tu.trip;
    if (!trip || !trip.tripId) continue;
    tripStmt.run([
      trip.tripId,
      trip.routeId || null,
      tu.vehicle?.id || null,
      tu.vehicle?.label || null,
      tu.vehicle?.licensePlate || null,
      tu.timestamp || null,
      tu.delay || null,
      trip.scheduleRelationship || null,
      timestamp
    ]);
    if (tu.stopTimeUpdate) {
      for (const stu of tu.stopTimeUpdate) {
        stopTimeStmt.run([
          trip.tripId,
          stu.stopSequence || null,
          stu.stopId || null,
          stu.arrival?.delay || null,
          stu.arrival?.time || null,
          stu.arrival?.uncertainty || null,
          stu.departure?.delay || null,
          stu.departure?.time || null,
          stu.departure?.uncertainty || null,
          stu.scheduleRelationship || null,
          timestamp
        ]);
      }
    }
  }
  tripStmt.free();
  stopTimeStmt.free();
}
async function loadRealtimeData(db, feedUrls) {
  const root = loadGtfsRtProto();
  const FeedMessage = root.lookupType("transit_realtime.FeedMessage");
  const fetchPromises = feedUrls.map(async (url) => {
    try {
      const data = await fetchProtobuf(url);
      const message = FeedMessage.decode(data);
      return FeedMessage.toObject(message, {
        longs: Number,
        enums: Number,
        bytes: String,
        defaults: false,
        arrays: true,
        objects: true,
        oneofs: true
      });
    } catch (error) {
      throw new Error(`Failed to fetch or parse GTFS-RT feed from ${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  const feeds = await Promise.all(fetchPromises);
  const now = Math.floor(Date.now() / 1e3);
  const allAlerts = [];
  const allVehiclePositions = [];
  const allTripUpdates = [];
  for (const feed of feeds) {
    if (!feed.entity) continue;
    for (const entity of feed.entity) {
      if (entity.alert) {
        allAlerts.push({ id: entity.id, ...entity.alert });
      }
      if (entity.vehicle) {
        allVehiclePositions.push(entity.vehicle);
      }
      if (entity.tripUpdate) {
        allTripUpdates.push(entity.tripUpdate);
      }
    }
  }
  if (allAlerts.length > 0) {
    insertAlerts(db, allAlerts, now);
  }
  if (allVehiclePositions.length > 0) {
    insertVehiclePositions(db, allVehiclePositions, now);
  }
  if (allTripUpdates.length > 0) {
    insertTripUpdates(db, allTripUpdates, now);
  }
}

// src/cache/checksum.ts
async function getCrypto() {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    return crypto;
  }
  if (typeof globalThis !== "undefined") {
    try {
      const { webcrypto } = await import("crypto");
      return webcrypto;
    } catch {
      throw new Error("Web Crypto API not available");
    }
  }
  throw new Error("Crypto not available in this environment");
}
async function computeChecksum(data) {
  const cryptoInstance = await getCrypto();
  const bufferSource = data instanceof Uint8Array ? data : new Uint8Array(data);
  const hashBuffer = await cryptoInstance.subtle.digest("SHA-256", bufferSource);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
}
async function computeZipChecksum(zipData) {
  return computeChecksum(zipData);
}
function generateCacheKey(checksum, libVersion, dataVersion, filesize, source, skipFiles) {
  let key = `v${libVersion}_d${dataVersion}_${filesize}_${checksum}`;
  if (source) {
    const filename = source.split("/").pop() || source;
    const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    key += `_${sanitized}`;
  }
  if (skipFiles && skipFiles.length > 0) {
    const sortedSkips = [...skipFiles].sort();
    const skipsSuffix = sortedSkips.join(",").replace(/\.txt/g, "");
    key += `_skip-${skipsSuffix}`;
  }
  return key;
}

// src/gtfs-sqljs.ts
init_utils();

// src/queries/agencies.ts
function getAgencies(db, filters = {}) {
  const { agencyId, limit } = filters;
  const conditions = [];
  const params = [];
  if (agencyId) {
    const agencyIds = Array.isArray(agencyId) ? agencyId : [agencyId];
    if (agencyIds.length > 0) {
      const placeholders = agencyIds.map(() => "?").join(", ");
      conditions.push(`agency_id IN (${placeholders})`);
      params.push(...agencyIds);
    }
  }
  let sql = "SELECT * FROM agency";
  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }
  sql += " ORDER BY agency_name";
  if (limit) {
    sql += " LIMIT ?";
    params.push(limit);
  }
  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }
  const agencies = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    agencies.push(rowToAgency(row));
  }
  stmt.free();
  return agencies;
}
function rowToAgency(row) {
  return {
    agency_id: String(row.agency_id),
    agency_name: String(row.agency_name),
    agency_url: String(row.agency_url),
    agency_timezone: String(row.agency_timezone),
    agency_lang: row.agency_lang ? String(row.agency_lang) : void 0,
    agency_phone: row.agency_phone ? String(row.agency_phone) : void 0,
    agency_fare_url: row.agency_fare_url ? String(row.agency_fare_url) : void 0,
    agency_email: row.agency_email ? String(row.agency_email) : void 0
  };
}

// src/queries/stops.ts
function getStops(db, filters = {}) {
  const { stopId, stopCode, name, tripId, limit } = filters;
  if (tripId) {
    const tripIds = Array.isArray(tripId) ? tripId : [tripId];
    if (tripIds.length === 0) return [];
    const placeholders = tripIds.map(() => "?").join(", ");
    const stmt2 = db.prepare(`
      SELECT s.* FROM stops s
      INNER JOIN stop_times st ON s.stop_id = st.stop_id
      WHERE st.trip_id IN (${placeholders})
      ORDER BY st.stop_sequence
    `);
    stmt2.bind(tripIds);
    const stops2 = [];
    while (stmt2.step()) {
      const row = stmt2.getAsObject();
      stops2.push(rowToStop(row));
    }
    stmt2.free();
    return stops2;
  }
  const conditions = [];
  const params = [];
  if (stopId) {
    const stopIds = Array.isArray(stopId) ? stopId : [stopId];
    if (stopIds.length > 0) {
      const placeholders = stopIds.map(() => "?").join(", ");
      conditions.push(`stop_id IN (${placeholders})`);
      params.push(...stopIds);
    }
  }
  if (stopCode) {
    const stopCodes = Array.isArray(stopCode) ? stopCode : [stopCode];
    if (stopCodes.length > 0) {
      const placeholders = stopCodes.map(() => "?").join(", ");
      conditions.push(`stop_code IN (${placeholders})`);
      params.push(...stopCodes);
    }
  }
  if (name) {
    conditions.push("stop_name LIKE ?");
    params.push(`%${name}%`);
  }
  let sql = "SELECT * FROM stops";
  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }
  sql += " ORDER BY stop_name";
  if (limit) {
    sql += " LIMIT ?";
    params.push(limit);
  }
  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }
  const stops = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    stops.push(rowToStop(row));
  }
  stmt.free();
  return stops;
}
function rowToStop(row) {
  return {
    stop_id: String(row.stop_id),
    stop_name: String(row.stop_name),
    stop_lat: Number(row.stop_lat),
    stop_lon: Number(row.stop_lon),
    stop_code: row.stop_code ? String(row.stop_code) : void 0,
    stop_desc: row.stop_desc ? String(row.stop_desc) : void 0,
    zone_id: row.zone_id ? String(row.zone_id) : void 0,
    stop_url: row.stop_url ? String(row.stop_url) : void 0,
    location_type: row.location_type !== null ? Number(row.location_type) : void 0,
    parent_station: row.parent_station ? String(row.parent_station) : void 0,
    stop_timezone: row.stop_timezone ? String(row.stop_timezone) : void 0,
    wheelchair_boarding: row.wheelchair_boarding !== null ? Number(row.wheelchair_boarding) : void 0,
    level_id: row.level_id ? String(row.level_id) : void 0,
    platform_code: row.platform_code ? String(row.platform_code) : void 0
  };
}

// src/queries/routes.ts
function getRoutes(db, filters = {}) {
  const { routeId, agencyId, limit } = filters;
  const conditions = [];
  const params = [];
  if (routeId) {
    const routeIds = Array.isArray(routeId) ? routeId : [routeId];
    if (routeIds.length > 0) {
      const placeholders = routeIds.map(() => "?").join(", ");
      conditions.push(`route_id IN (${placeholders})`);
      params.push(...routeIds);
    }
  }
  if (agencyId) {
    const agencyIds = Array.isArray(agencyId) ? agencyId : [agencyId];
    if (agencyIds.length > 0) {
      const placeholders = agencyIds.map(() => "?").join(", ");
      conditions.push(`agency_id IN (${placeholders})`);
      params.push(...agencyIds);
    }
  }
  let sql = "SELECT * FROM routes";
  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }
  sql += " ORDER BY route_short_name, route_long_name";
  if (limit) {
    sql += " LIMIT ?";
    params.push(limit);
  }
  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }
  const routes = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    routes.push(rowToRoute(row));
  }
  stmt.free();
  return routes;
}
function rowToRoute(row) {
  return {
    route_id: String(row.route_id),
    route_short_name: String(row.route_short_name),
    route_long_name: String(row.route_long_name),
    route_type: Number(row.route_type),
    agency_id: row.agency_id ? String(row.agency_id) : void 0,
    route_desc: row.route_desc ? String(row.route_desc) : void 0,
    route_url: row.route_url ? String(row.route_url) : void 0,
    route_color: row.route_color ? String(row.route_color) : void 0,
    route_text_color: row.route_text_color ? String(row.route_text_color) : void 0,
    route_sort_order: row.route_sort_order !== null ? Number(row.route_sort_order) : void 0,
    continuous_pickup: row.continuous_pickup !== null ? Number(row.continuous_pickup) : void 0,
    continuous_drop_off: row.continuous_drop_off !== null ? Number(row.continuous_drop_off) : void 0
  };
}

// src/queries/calendar.ts
function getActiveServiceIds(db, date) {
  const serviceIds = /* @__PURE__ */ new Set();
  const year = parseInt(date.substring(0, 4));
  const month = parseInt(date.substring(4, 6));
  const day = parseInt(date.substring(6, 8));
  const dateObj = new Date(year, month - 1, day);
  const dayOfWeek = dateObj.getDay();
  const dayFields = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const dayField = dayFields[dayOfWeek];
  const calendarStmt = db.prepare(
    `SELECT service_id FROM calendar
     WHERE ${dayField} = 1
     AND start_date <= ?
     AND end_date >= ?`
  );
  calendarStmt.bind([date, date]);
  while (calendarStmt.step()) {
    const row = calendarStmt.getAsObject();
    serviceIds.add(row.service_id);
  }
  calendarStmt.free();
  const exceptionsStmt = db.prepare("SELECT service_id, exception_type FROM calendar_dates WHERE date = ?");
  exceptionsStmt.bind([date]);
  while (exceptionsStmt.step()) {
    const row = exceptionsStmt.getAsObject();
    if (row.exception_type === 1) {
      serviceIds.add(row.service_id);
    } else if (row.exception_type === 2) {
      serviceIds.delete(row.service_id);
    }
  }
  exceptionsStmt.free();
  return Array.from(serviceIds);
}
function getCalendarByServiceId(db, serviceId) {
  const stmt = db.prepare("SELECT * FROM calendar WHERE service_id = ?");
  stmt.bind([serviceId]);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return rowToCalendar(row);
  }
  stmt.free();
  return null;
}
function getCalendarDates(db, serviceId) {
  const stmt = db.prepare("SELECT * FROM calendar_dates WHERE service_id = ? ORDER BY date");
  stmt.bind([serviceId]);
  const dates = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    dates.push(rowToCalendarDate(row));
  }
  stmt.free();
  return dates;
}
function getCalendarDatesForDate(db, date) {
  const stmt = db.prepare("SELECT * FROM calendar_dates WHERE date = ?");
  stmt.bind([date]);
  const dates = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    dates.push(rowToCalendarDate(row));
  }
  stmt.free();
  return dates;
}
function rowToCalendar(row) {
  return {
    service_id: String(row.service_id),
    monday: Number(row.monday),
    tuesday: Number(row.tuesday),
    wednesday: Number(row.wednesday),
    thursday: Number(row.thursday),
    friday: Number(row.friday),
    saturday: Number(row.saturday),
    sunday: Number(row.sunday),
    start_date: String(row.start_date),
    end_date: String(row.end_date)
  };
}
function rowToCalendarDate(row) {
  return {
    service_id: String(row.service_id),
    date: String(row.date),
    exception_type: Number(row.exception_type)
  };
}

// src/queries/rt-vehicle-positions.ts
function parseVehiclePosition(row) {
  const vp = {
    trip_id: String(row.trip_id),
    route_id: row.route_id ? String(row.route_id) : void 0,
    rt_last_updated: Number(row.rt_last_updated)
  };
  if (row.vehicle_id || row.vehicle_label || row.vehicle_license_plate) {
    vp.vehicle = {
      id: row.vehicle_id ? String(row.vehicle_id) : void 0,
      label: row.vehicle_label ? String(row.vehicle_label) : void 0,
      license_plate: row.vehicle_license_plate ? String(row.vehicle_license_plate) : void 0
    };
  }
  if (row.latitude !== null && row.longitude !== null) {
    vp.position = {
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      bearing: row.bearing !== null ? Number(row.bearing) : void 0,
      odometer: row.odometer !== null ? Number(row.odometer) : void 0,
      speed: row.speed !== null ? Number(row.speed) : void 0
    };
  }
  if (row.current_stop_sequence !== null) {
    vp.current_stop_sequence = Number(row.current_stop_sequence);
  }
  if (row.stop_id) {
    vp.stop_id = String(row.stop_id);
  }
  if (row.current_status !== null) {
    vp.current_status = Number(row.current_status);
  }
  if (row.timestamp !== null) {
    vp.timestamp = Number(row.timestamp);
  }
  if (row.congestion_level !== null) {
    vp.congestion_level = Number(row.congestion_level);
  }
  if (row.occupancy_status !== null) {
    vp.occupancy_status = Number(row.occupancy_status);
  }
  return vp;
}
function getVehiclePositions(db, filters = {}, stalenessThreshold = 120) {
  const { tripId, routeId, vehicleId, limit } = filters;
  const conditions = [];
  const params = [];
  if (tripId) {
    conditions.push("trip_id = ?");
    params.push(tripId);
  }
  if (routeId) {
    conditions.push("route_id = ?");
    params.push(routeId);
  }
  if (vehicleId) {
    conditions.push("vehicle_id = ?");
    params.push(vehicleId);
  }
  const now = Math.floor(Date.now() / 1e3);
  const staleThreshold = now - stalenessThreshold;
  conditions.push("rt_last_updated >= ?");
  params.push(staleThreshold);
  let sql = "SELECT * FROM rt_vehicle_positions";
  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }
  sql += " ORDER BY rt_last_updated DESC";
  if (limit) {
    sql += " LIMIT ?";
    params.push(limit);
  }
  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }
  const positions = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    positions.push(parseVehiclePosition(row));
  }
  stmt.free();
  return positions;
}
function getAllVehiclePositions(db) {
  const sql = "SELECT * FROM rt_vehicle_positions ORDER BY rt_last_updated DESC";
  const stmt = db.prepare(sql);
  const positions = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    positions.push(parseVehiclePosition(row));
  }
  stmt.free();
  return positions;
}

// src/queries/trips.ts
function mergeRealtimeData(trips, db, stalenessThreshold) {
  const now = Math.floor(Date.now() / 1e3);
  const staleThreshold = now - stalenessThreshold;
  const tripIds = trips.map((t) => t.trip_id);
  if (tripIds.length === 0) return trips;
  const placeholders = tripIds.map(() => "?").join(", ");
  const vpStmt = db.prepare(`
    SELECT * FROM rt_vehicle_positions
    WHERE trip_id IN (${placeholders})
      AND rt_last_updated >= ?
  `);
  vpStmt.bind([...tripIds, staleThreshold]);
  const vpMap = /* @__PURE__ */ new Map();
  while (vpStmt.step()) {
    const row = vpStmt.getAsObject();
    const vp = parseVehiclePosition(row);
    vpMap.set(vp.trip_id, vp);
  }
  vpStmt.free();
  const tuStmt = db.prepare(`
    SELECT * FROM rt_trip_updates
    WHERE trip_id IN (${placeholders})
      AND rt_last_updated >= ?
  `);
  tuStmt.bind([...tripIds, staleThreshold]);
  const tuMap = /* @__PURE__ */ new Map();
  while (tuStmt.step()) {
    const row = tuStmt.getAsObject();
    const tripId = String(row.trip_id);
    tuMap.set(tripId, {
      delay: row.delay !== null ? Number(row.delay) : void 0,
      schedule_relationship: row.schedule_relationship !== null ? Number(row.schedule_relationship) : void 0
    });
  }
  tuStmt.free();
  return trips.map((trip) => {
    const vp = vpMap.get(trip.trip_id);
    const tu = tuMap.get(trip.trip_id);
    if (!vp && !tu) {
      return { ...trip, realtime: { vehicle_position: null, trip_update: null } };
    }
    return {
      ...trip,
      realtime: {
        vehicle_position: vp || null,
        trip_update: tu || null
      }
    };
  });
}
function getTrips(db, filters = {}, stalenessThreshold = 120) {
  const { tripId, routeId, serviceIds, directionId, agencyId, includeRealtime, limit } = filters;
  const needsRoutesJoin = agencyId !== void 0;
  const conditions = [];
  const params = [];
  if (tripId) {
    const tripIds = Array.isArray(tripId) ? tripId : [tripId];
    if (tripIds.length > 0) {
      const placeholders = tripIds.map(() => "?").join(", ");
      conditions.push(needsRoutesJoin ? `t.trip_id IN (${placeholders})` : `trip_id IN (${placeholders})`);
      params.push(...tripIds);
    }
  }
  if (routeId) {
    const routeIds = Array.isArray(routeId) ? routeId : [routeId];
    if (routeIds.length > 0) {
      const placeholders = routeIds.map(() => "?").join(", ");
      conditions.push(needsRoutesJoin ? `t.route_id IN (${placeholders})` : `route_id IN (${placeholders})`);
      params.push(...routeIds);
    }
  }
  if (serviceIds) {
    const serviceIdArray = Array.isArray(serviceIds) ? serviceIds : [serviceIds];
    if (serviceIdArray.length > 0) {
      const placeholders = serviceIdArray.map(() => "?").join(", ");
      conditions.push(needsRoutesJoin ? `t.service_id IN (${placeholders})` : `service_id IN (${placeholders})`);
      params.push(...serviceIdArray);
    }
  }
  if (directionId !== void 0) {
    const directionIds = Array.isArray(directionId) ? directionId : [directionId];
    if (directionIds.length > 0) {
      const placeholders = directionIds.map(() => "?").join(", ");
      conditions.push(needsRoutesJoin ? `t.direction_id IN (${placeholders})` : `direction_id IN (${placeholders})`);
      params.push(...directionIds);
    }
  }
  if (agencyId) {
    const agencyIds = Array.isArray(agencyId) ? agencyId : [agencyId];
    if (agencyIds.length > 0) {
      const placeholders = agencyIds.map(() => "?").join(", ");
      conditions.push(`r.agency_id IN (${placeholders})`);
      params.push(...agencyIds);
    }
  }
  let sql = needsRoutesJoin ? "SELECT t.* FROM trips t INNER JOIN routes r ON t.route_id = r.route_id" : "SELECT * FROM trips";
  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }
  if (limit) {
    sql += " LIMIT ?";
    params.push(limit);
  }
  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }
  const trips = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    trips.push(rowToTrip(row));
  }
  stmt.free();
  if (includeRealtime) {
    return mergeRealtimeData(trips, db, stalenessThreshold);
  }
  return trips;
}
function rowToTrip(row) {
  return {
    trip_id: String(row.trip_id),
    route_id: String(row.route_id),
    service_id: String(row.service_id),
    trip_headsign: row.trip_headsign ? String(row.trip_headsign) : void 0,
    trip_short_name: row.trip_short_name ? String(row.trip_short_name) : void 0,
    direction_id: row.direction_id !== null ? Number(row.direction_id) : void 0,
    block_id: row.block_id ? String(row.block_id) : void 0,
    shape_id: row.shape_id ? String(row.shape_id) : void 0,
    wheelchair_accessible: row.wheelchair_accessible !== null ? Number(row.wheelchair_accessible) : void 0,
    bikes_allowed: row.bikes_allowed !== null ? Number(row.bikes_allowed) : void 0
  };
}

// src/queries/stop-times.ts
function mergeRealtimeData2(stopTimes, db, stalenessThreshold) {
  const now = Math.floor(Date.now() / 1e3);
  const staleThreshold = now - stalenessThreshold;
  const tripIds = Array.from(new Set(stopTimes.map((st) => st.trip_id)));
  if (tripIds.length === 0) return stopTimes;
  const placeholders = tripIds.map(() => "?").join(", ");
  const stmt = db.prepare(`
    SELECT trip_id, stop_sequence, stop_id,
           arrival_delay, arrival_time, departure_delay, departure_time, schedule_relationship
    FROM rt_stop_time_updates
    WHERE trip_id IN (${placeholders})
      AND rt_last_updated >= ?
  `);
  stmt.bind([...tripIds, staleThreshold]);
  const rtMap = /* @__PURE__ */ new Map();
  while (stmt.step()) {
    const row = stmt.getAsObject();
    const key = `${row.trip_id}_${row.stop_sequence}`;
    rtMap.set(key, {
      arrival_delay: row.arrival_delay !== null ? Number(row.arrival_delay) : void 0,
      arrival_time: row.arrival_time !== null ? Number(row.arrival_time) : void 0,
      departure_delay: row.departure_delay !== null ? Number(row.departure_delay) : void 0,
      departure_time: row.departure_time !== null ? Number(row.departure_time) : void 0,
      schedule_relationship: row.schedule_relationship !== null ? Number(row.schedule_relationship) : void 0
    });
  }
  stmt.free();
  return stopTimes.map((st) => {
    const key = `${st.trip_id}_${st.stop_sequence}`;
    const rtData = rtMap.get(key);
    if (rtData) {
      return { ...st, realtime: rtData };
    }
    return st;
  });
}
function getStopTimes(db, filters = {}, stalenessThreshold = 120) {
  const { tripId, stopId, routeId, serviceIds, directionId, agencyId, includeRealtime, limit } = filters;
  const needsTripsJoin = routeId || serviceIds || directionId !== void 0 || agencyId !== void 0;
  const needsRoutesJoin = agencyId !== void 0;
  const conditions = [];
  const params = [];
  if (tripId) {
    const tripIds = Array.isArray(tripId) ? tripId : [tripId];
    if (tripIds.length > 0) {
      const placeholders = tripIds.map(() => "?").join(", ");
      conditions.push(needsTripsJoin ? `st.trip_id IN (${placeholders})` : `trip_id IN (${placeholders})`);
      params.push(...tripIds);
    }
  }
  if (stopId) {
    const stopIds = Array.isArray(stopId) ? stopId : [stopId];
    if (stopIds.length > 0) {
      const placeholders = stopIds.map(() => "?").join(", ");
      conditions.push(needsTripsJoin ? `st.stop_id IN (${placeholders})` : `stop_id IN (${placeholders})`);
      params.push(...stopIds);
    }
  }
  if (routeId) {
    const routeIds = Array.isArray(routeId) ? routeId : [routeId];
    if (routeIds.length > 0) {
      const placeholders = routeIds.map(() => "?").join(", ");
      conditions.push(`t.route_id IN (${placeholders})`);
      params.push(...routeIds);
    }
  }
  if (serviceIds) {
    const serviceIdArray = Array.isArray(serviceIds) ? serviceIds : [serviceIds];
    if (serviceIdArray.length > 0) {
      const placeholders = serviceIdArray.map(() => "?").join(", ");
      conditions.push(`t.service_id IN (${placeholders})`);
      params.push(...serviceIdArray);
    }
  }
  if (directionId !== void 0) {
    const directionIds = Array.isArray(directionId) ? directionId : [directionId];
    if (directionIds.length > 0) {
      const placeholders = directionIds.map(() => "?").join(", ");
      conditions.push(`t.direction_id IN (${placeholders})`);
      params.push(...directionIds);
    }
  }
  if (agencyId) {
    const agencyIds = Array.isArray(agencyId) ? agencyId : [agencyId];
    if (agencyIds.length > 0) {
      const placeholders = agencyIds.map(() => "?").join(", ");
      conditions.push(`r.agency_id IN (${placeholders})`);
      params.push(...agencyIds);
    }
  }
  let sql;
  if (needsRoutesJoin) {
    sql = "SELECT st.* FROM stop_times st INNER JOIN trips t ON st.trip_id = t.trip_id INNER JOIN routes r ON t.route_id = r.route_id";
  } else if (needsTripsJoin) {
    sql = "SELECT st.* FROM stop_times st INNER JOIN trips t ON st.trip_id = t.trip_id";
  } else {
    sql = "SELECT * FROM stop_times";
  }
  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }
  sql += tripId ? " ORDER BY stop_sequence" : " ORDER BY arrival_time";
  if (limit) {
    sql += " LIMIT ?";
    params.push(limit);
  }
  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }
  const stopTimes = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    stopTimes.push(rowToStopTime(row));
  }
  stmt.free();
  if (includeRealtime) {
    return mergeRealtimeData2(stopTimes, db, stalenessThreshold);
  }
  return stopTimes;
}
function buildOrderedStopList(db, tripIds) {
  if (tripIds.length === 0) {
    return [];
  }
  const placeholders = tripIds.map(() => "?").join(", ");
  const stmt = db.prepare(`
    SELECT trip_id, stop_id, stop_sequence
    FROM stop_times
    WHERE trip_id IN (${placeholders})
    ORDER BY trip_id, stop_sequence
  `);
  stmt.bind(tripIds);
  const tripStopSequences = /* @__PURE__ */ new Map();
  while (stmt.step()) {
    const row = stmt.getAsObject();
    const tripId = String(row.trip_id);
    const stopId = String(row.stop_id);
    const stopSequence = Number(row.stop_sequence);
    if (!tripStopSequences.has(tripId)) {
      tripStopSequences.set(tripId, []);
    }
    tripStopSequences.get(tripId).push({ stop_id: stopId, stop_sequence: stopSequence });
  }
  stmt.free();
  const orderedStopIds = [];
  const stopIdSet = /* @__PURE__ */ new Set();
  for (const [, stopSequence] of tripStopSequences) {
    for (let i = 0; i < stopSequence.length; i++) {
      const currentStop = stopSequence[i];
      if (stopIdSet.has(currentStop.stop_id)) {
        continue;
      }
      const insertIndex = findInsertionPosition(
        orderedStopIds,
        currentStop.stop_id,
        stopSequence,
        i
      );
      orderedStopIds.splice(insertIndex, 0, currentStop.stop_id);
      stopIdSet.add(currentStop.stop_id);
    }
  }
  if (orderedStopIds.length === 0) {
    return [];
  }
  const stops = getStops(db, { stopId: orderedStopIds });
  const stopMap = /* @__PURE__ */ new Map();
  stops.forEach((stop) => stopMap.set(stop.stop_id, stop));
  return orderedStopIds.map((stopId) => stopMap.get(stopId)).filter((stop) => stop !== void 0);
}
function findInsertionPosition(orderedStopIds, newStopId, tripStops, currentIndex) {
  if (orderedStopIds.length === 0) {
    return 0;
  }
  let beforeIndex = -1;
  for (let i = currentIndex - 1; i >= 0; i--) {
    const idx = orderedStopIds.indexOf(tripStops[i].stop_id);
    if (idx !== -1) {
      beforeIndex = idx;
      break;
    }
  }
  let afterIndex = orderedStopIds.length;
  for (let i = currentIndex + 1; i < tripStops.length; i++) {
    const idx = orderedStopIds.indexOf(tripStops[i].stop_id);
    if (idx !== -1) {
      afterIndex = idx;
      break;
    }
  }
  const insertPosition = beforeIndex + 1;
  if (insertPosition <= afterIndex) {
    return insertPosition;
  }
  return beforeIndex + 1;
}
function rowToStopTime(row) {
  return {
    trip_id: String(row.trip_id),
    arrival_time: String(row.arrival_time),
    departure_time: String(row.departure_time),
    stop_id: String(row.stop_id),
    stop_sequence: Number(row.stop_sequence),
    stop_headsign: row.stop_headsign ? String(row.stop_headsign) : void 0,
    pickup_type: row.pickup_type !== null ? Number(row.pickup_type) : void 0,
    drop_off_type: row.drop_off_type !== null ? Number(row.drop_off_type) : void 0,
    continuous_pickup: row.continuous_pickup !== null ? Number(row.continuous_pickup) : void 0,
    continuous_drop_off: row.continuous_drop_off !== null ? Number(row.continuous_drop_off) : void 0,
    shape_dist_traveled: row.shape_dist_traveled !== null ? Number(row.shape_dist_traveled) : void 0,
    timepoint: row.timepoint !== null ? Number(row.timepoint) : void 0
  };
}

// src/queries/rt-alerts.ts
function parseAlert(row) {
  return {
    id: String(row.id),
    active_period: row.active_period ? JSON.parse(String(row.active_period)) : [],
    informed_entity: row.informed_entity ? JSON.parse(String(row.informed_entity)) : [],
    cause: row.cause ? Number(row.cause) : void 0,
    effect: row.effect ? Number(row.effect) : void 0,
    url: row.url ? JSON.parse(String(row.url)) : void 0,
    header_text: row.header_text ? JSON.parse(String(row.header_text)) : void 0,
    description_text: row.description_text ? JSON.parse(String(row.description_text)) : void 0,
    rt_last_updated: Number(row.rt_last_updated)
  };
}
function isAlertActive(alert, now) {
  if (!alert.active_period || alert.active_period.length === 0) {
    return true;
  }
  for (const period of alert.active_period) {
    const start = period.start || 0;
    const end = period.end || Number.MAX_SAFE_INTEGER;
    if (now >= start && now <= end) {
      return true;
    }
  }
  return false;
}
function alertAffectsEntity(alert, filters) {
  if (!alert.informed_entity || alert.informed_entity.length === 0) {
    return true;
  }
  for (const entity of alert.informed_entity) {
    if (filters.routeId && entity.route_id === filters.routeId) {
      return true;
    }
    if (filters.stopId && entity.stop_id === filters.stopId) {
      return true;
    }
    if (filters.tripId && entity.trip?.trip_id === filters.tripId) {
      return true;
    }
  }
  return false;
}
function getAlerts(db, filters = {}, stalenessThreshold = 120) {
  const {
    alertId,
    activeOnly,
    routeId,
    stopId,
    tripId,
    cause,
    effect,
    limit
  } = filters;
  const conditions = [];
  const params = [];
  if (alertId) {
    conditions.push("id = ?");
    params.push(alertId);
  }
  if (cause !== void 0) {
    conditions.push("cause = ?");
    params.push(cause);
  }
  if (effect !== void 0) {
    conditions.push("effect = ?");
    params.push(effect);
  }
  const now = Math.floor(Date.now() / 1e3);
  const staleThreshold = now - stalenessThreshold;
  conditions.push("rt_last_updated >= ?");
  params.push(staleThreshold);
  let sql = "SELECT * FROM rt_alerts";
  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }
  sql += " ORDER BY rt_last_updated DESC";
  if (limit) {
    sql += " LIMIT ?";
    params.push(limit);
  }
  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }
  const alerts = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    const alert = parseAlert(row);
    if (activeOnly && !isAlertActive(alert, now)) {
      continue;
    }
    if (routeId || stopId || tripId) {
      if (!alertAffectsEntity(alert, filters)) {
        continue;
      }
    }
    alerts.push(alert);
  }
  stmt.free();
  return alerts;
}
function getAllAlerts(db) {
  const sql = "SELECT * FROM rt_alerts ORDER BY rt_last_updated DESC";
  const stmt = db.prepare(sql);
  const alerts = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    alerts.push(parseAlert(row));
  }
  stmt.free();
  return alerts;
}

// src/queries/rt-trip-updates.ts
function parseTripUpdate(row) {
  const tu = {
    trip_id: String(row.trip_id),
    route_id: row.route_id ? String(row.route_id) : void 0,
    stop_time_update: [],
    // Will be populated separately
    timestamp: row.timestamp !== null ? Number(row.timestamp) : void 0,
    delay: row.delay !== null ? Number(row.delay) : void 0,
    schedule_relationship: row.schedule_relationship !== null ? Number(row.schedule_relationship) : void 0,
    rt_last_updated: Number(row.rt_last_updated)
  };
  if (row.vehicle_id || row.vehicle_label || row.vehicle_license_plate) {
    tu.vehicle = {
      id: row.vehicle_id ? String(row.vehicle_id) : void 0,
      label: row.vehicle_label ? String(row.vehicle_label) : void 0,
      license_plate: row.vehicle_license_plate ? String(row.vehicle_license_plate) : void 0
    };
  }
  return tu;
}
function getTripUpdates(db, filters = {}, stalenessThreshold = 120) {
  const { tripId, routeId, vehicleId, limit } = filters;
  const conditions = [];
  const params = [];
  if (tripId) {
    conditions.push("trip_id = ?");
    params.push(tripId);
  }
  if (routeId) {
    conditions.push("route_id = ?");
    params.push(routeId);
  }
  if (vehicleId) {
    conditions.push("vehicle_id = ?");
    params.push(vehicleId);
  }
  const now = Math.floor(Date.now() / 1e3);
  const staleThreshold = now - stalenessThreshold;
  conditions.push("rt_last_updated >= ?");
  params.push(staleThreshold);
  let sql = "SELECT * FROM rt_trip_updates";
  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }
  sql += " ORDER BY rt_last_updated DESC";
  if (limit) {
    sql += " LIMIT ?";
    params.push(limit);
  }
  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }
  const tripUpdates = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    tripUpdates.push(parseTripUpdate(row));
  }
  stmt.free();
  return tripUpdates;
}
function getAllTripUpdates(db) {
  const sql = "SELECT * FROM rt_trip_updates ORDER BY rt_last_updated DESC";
  const stmt = db.prepare(sql);
  const tripUpdates = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    tripUpdates.push(parseTripUpdate(row));
  }
  stmt.free();
  return tripUpdates;
}

// src/queries/rt-stop-time-updates.ts
function parseStopTimeUpdate(row) {
  const stu = {
    stop_sequence: row.stop_sequence !== null ? Number(row.stop_sequence) : void 0,
    stop_id: row.stop_id ? String(row.stop_id) : void 0,
    schedule_relationship: row.schedule_relationship !== null ? Number(row.schedule_relationship) : void 0
  };
  if (row.arrival_delay !== null || row.arrival_time !== null || row.arrival_uncertainty !== null) {
    stu.arrival = {
      delay: row.arrival_delay !== null ? Number(row.arrival_delay) : void 0,
      time: row.arrival_time !== null ? Number(row.arrival_time) : void 0,
      uncertainty: row.arrival_uncertainty !== null ? Number(row.arrival_uncertainty) : void 0
    };
  }
  if (row.departure_delay !== null || row.departure_time !== null || row.departure_uncertainty !== null) {
    stu.departure = {
      delay: row.departure_delay !== null ? Number(row.departure_delay) : void 0,
      time: row.departure_time !== null ? Number(row.departure_time) : void 0,
      uncertainty: row.departure_uncertainty !== null ? Number(row.departure_uncertainty) : void 0
    };
  }
  return stu;
}
function parseStopTimeUpdateWithMetadata(row) {
  const stu = parseStopTimeUpdate(row);
  stu.trip_id = String(row.trip_id);
  stu.rt_last_updated = Number(row.rt_last_updated);
  return stu;
}
function getStopTimeUpdates(db, filters = {}, stalenessThreshold = 120) {
  const { tripId, stopId, stopSequence, limit } = filters;
  const conditions = [];
  const params = [];
  if (tripId) {
    const tripIds = Array.isArray(tripId) ? tripId : [tripId];
    if (tripIds.length > 0) {
      const placeholders = tripIds.map(() => "?").join(", ");
      conditions.push(`trip_id IN (${placeholders})`);
      params.push(...tripIds);
    }
  }
  if (stopId) {
    const stopIds = Array.isArray(stopId) ? stopId : [stopId];
    if (stopIds.length > 0) {
      const placeholders = stopIds.map(() => "?").join(", ");
      conditions.push(`stop_id IN (${placeholders})`);
      params.push(...stopIds);
    }
  }
  if (stopSequence !== void 0) {
    const stopSequences = Array.isArray(stopSequence) ? stopSequence : [stopSequence];
    if (stopSequences.length > 0) {
      const placeholders = stopSequences.map(() => "?").join(", ");
      conditions.push(`stop_sequence IN (${placeholders})`);
      params.push(...stopSequences);
    }
  }
  const now = Math.floor(Date.now() / 1e3);
  const staleThreshold = now - stalenessThreshold;
  conditions.push("rt_last_updated >= ?");
  params.push(staleThreshold);
  let sql = "SELECT * FROM rt_stop_time_updates";
  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }
  sql += " ORDER BY trip_id, stop_sequence";
  if (limit) {
    sql += " LIMIT ?";
    params.push(limit);
  }
  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }
  const stopTimeUpdates = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    stopTimeUpdates.push(parseStopTimeUpdate(row));
  }
  stmt.free();
  return stopTimeUpdates;
}
function getAllStopTimeUpdates(db) {
  const sql = "SELECT * FROM rt_stop_time_updates ORDER BY trip_id, stop_sequence";
  const stmt = db.prepare(sql);
  const stopTimeUpdates = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    stopTimeUpdates.push(parseStopTimeUpdateWithMetadata(row));
  }
  stmt.free();
  return stopTimeUpdates;
}

// src/gtfs-sqljs.ts
var LIB_VERSION = "0.1.0";
var GtfsSqlJs = class _GtfsSqlJs {
  /**
   * Private constructor - use static factory methods instead
   */
  constructor() {
    this.db = null;
    this.SQL = null;
    this.realtimeFeedUrls = [];
    this.stalenessThreshold = 120;
  }
  /**
   * Create GtfsSqlJs instance from GTFS ZIP file
   */
  static async fromZip(zipPath, options = {}) {
    const instance = new _GtfsSqlJs();
    await instance.initFromZip(zipPath, options);
    return instance;
  }
  /**
   * Create GtfsSqlJs instance from existing SQLite database
   */
  static async fromDatabase(database, options = {}) {
    const instance = new _GtfsSqlJs();
    await instance.initFromDatabase(database, options);
    return instance;
  }
  /**
   * Initialize from ZIP file
   */
  async initFromZip(zipPath, options) {
    const onProgress = options.onProgress;
    const {
      cache: userCache,
      cacheVersion = "1.0",
      cacheExpirationMs = DEFAULT_CACHE_EXPIRATION_MS,
      skipFiles
    } = options;
    this.SQL = options.SQL || await initSqlJs(options.locateFile ? { locateFile: options.locateFile } : {});
    let cache = null;
    if (userCache === null) {
      cache = null;
    } else if (userCache) {
      cache = userCache;
    } else {
      try {
        if (typeof indexedDB !== "undefined") {
          const { IndexedDBCacheStore: IndexedDBCacheStore2 } = await Promise.resolve().then(() => (init_indexeddb_store(), indexeddb_store_exports));
          cache = new IndexedDBCacheStore2();
        } else if (typeof process !== "undefined" && process.versions?.node) {
          const { FileSystemCacheStore: FileSystemCacheStore2 } = await Promise.resolve().then(() => (init_fs_store(), fs_store_exports));
          cache = new FileSystemCacheStore2();
        }
      } catch (error) {
        console.warn("Failed to initialize default cache store:", error);
        cache = null;
      }
    }
    if (cache) {
      onProgress?.({
        phase: "checking_cache",
        currentFile: null,
        filesCompleted: 0,
        totalFiles: 0,
        rowsProcessed: 0,
        totalRows: 0,
        percentComplete: 0,
        message: "Checking cache..."
      });
      let zipData2;
      if (typeof zipPath === "string") {
        onProgress?.({
          phase: "downloading",
          currentFile: null,
          filesCompleted: 0,
          totalFiles: 0,
          rowsProcessed: 0,
          totalRows: 0,
          percentComplete: 2,
          message: "Downloading GTFS ZIP file"
        });
        zipData2 = await fetchZip(zipPath);
      } else {
        zipData2 = zipPath;
      }
      const filesize = zipData2.byteLength;
      const checksum = await computeZipChecksum(zipData2);
      const cacheKey = generateCacheKey(
        checksum,
        LIB_VERSION,
        cacheVersion,
        filesize,
        typeof zipPath === "string" ? zipPath : void 0,
        skipFiles
      );
      const cacheEntry = await cache.get(cacheKey);
      if (cacheEntry) {
        const expired = isCacheExpired(cacheEntry.metadata, cacheExpirationMs);
        if (expired) {
          onProgress?.({
            phase: "checking_cache",
            currentFile: null,
            filesCompleted: 0,
            totalFiles: 0,
            rowsProcessed: 0,
            totalRows: 0,
            percentComplete: 2,
            message: "Cache expired, reprocessing..."
          });
          await cache.delete(cacheKey);
        } else {
          onProgress?.({
            phase: "loading_from_cache",
            currentFile: null,
            filesCompleted: 0,
            totalFiles: 0,
            rowsProcessed: 0,
            totalRows: 0,
            percentComplete: 50,
            message: "Loading from cache..."
          });
          this.db = new this.SQL.Database(new Uint8Array(cacheEntry.data));
          if (options.realtimeFeedUrls) {
            this.realtimeFeedUrls = options.realtimeFeedUrls;
          }
          if (options.stalenessThreshold !== void 0) {
            this.stalenessThreshold = options.stalenessThreshold;
          }
          onProgress?.({
            phase: "complete",
            currentFile: null,
            filesCompleted: 0,
            totalFiles: 0,
            rowsProcessed: 0,
            totalRows: 0,
            percentComplete: 100,
            message: "GTFS data loaded from cache"
          });
          return;
        }
      }
      onProgress?.({
        phase: "extracting",
        currentFile: null,
        filesCompleted: 0,
        totalFiles: 0,
        rowsProcessed: 0,
        totalRows: 0,
        percentComplete: 5,
        message: "Extracting GTFS ZIP file"
      });
      await this.loadFromZipData(zipData2, options, onProgress);
      onProgress?.({
        phase: "saving_cache",
        currentFile: null,
        filesCompleted: 0,
        totalFiles: 0,
        rowsProcessed: 0,
        totalRows: 0,
        percentComplete: 98,
        message: "Saving to cache..."
      });
      const dbBuffer = this.export();
      await cache.set(cacheKey, dbBuffer, {
        checksum,
        version: cacheVersion,
        timestamp: Date.now(),
        source: typeof zipPath === "string" ? zipPath : void 0,
        size: dbBuffer.byteLength,
        skipFiles
      });
      onProgress?.({
        phase: "complete",
        currentFile: null,
        filesCompleted: 0,
        totalFiles: 0,
        rowsProcessed: 0,
        totalRows: 0,
        percentComplete: 100,
        message: "GTFS data loaded successfully"
      });
      return;
    }
    onProgress?.({
      phase: "downloading",
      currentFile: null,
      filesCompleted: 0,
      totalFiles: 0,
      rowsProcessed: 0,
      totalRows: 0,
      percentComplete: 0,
      message: "Downloading GTFS ZIP file"
    });
    let zipData;
    if (typeof zipPath === "string") {
      zipData = await fetchZip(zipPath);
    } else {
      zipData = zipPath;
    }
    await this.loadFromZipData(zipData, options, onProgress);
    onProgress?.({
      phase: "complete",
      currentFile: null,
      filesCompleted: 0,
      totalFiles: 0,
      rowsProcessed: 0,
      totalRows: 0,
      percentComplete: 100,
      message: "GTFS data loaded successfully"
    });
  }
  /**
   * Helper method to load GTFS data from zip data (ArrayBuffer)
   * Used by both cache-enabled and cache-disabled paths
   */
  async loadFromZipData(zipData, options, onProgress) {
    this.db = new this.SQL.Database();
    onProgress?.({
      phase: "creating_schema",
      currentFile: null,
      filesCompleted: 0,
      totalFiles: 0,
      rowsProcessed: 0,
      totalRows: 0,
      percentComplete: 10,
      message: "Optimizing database for bulk import"
    });
    this.db.run("PRAGMA synchronous = OFF");
    this.db.run("PRAGMA journal_mode = MEMORY");
    this.db.run("PRAGMA temp_store = MEMORY");
    this.db.run("PRAGMA cache_size = -64000");
    this.db.run("PRAGMA locking_mode = EXCLUSIVE");
    onProgress?.({
      phase: "creating_schema",
      currentFile: null,
      filesCompleted: 0,
      totalFiles: 0,
      rowsProcessed: 0,
      totalRows: 0,
      percentComplete: 15,
      message: "Creating database tables"
    });
    const createTableStatements = getAllCreateTableStatements();
    for (const statement of createTableStatements) {
      this.db.run(statement);
    }
    createRealtimeTables(this.db);
    onProgress?.({
      phase: "extracting",
      currentFile: null,
      filesCompleted: 0,
      totalFiles: 0,
      rowsProcessed: 0,
      totalRows: 0,
      percentComplete: 20,
      message: "Extracting GTFS ZIP file"
    });
    const files = await loadGTFSZip(zipData);
    onProgress?.({
      phase: "inserting_data",
      currentFile: null,
      filesCompleted: 0,
      totalFiles: Object.keys(files).length,
      rowsProcessed: 0,
      totalRows: 0,
      percentComplete: 25,
      message: "Starting data import"
    });
    await loadGTFSData(this.db, files, options.skipFiles, onProgress);
    onProgress?.({
      phase: "creating_indexes",
      currentFile: null,
      filesCompleted: Object.keys(files).length,
      totalFiles: Object.keys(files).length,
      rowsProcessed: 0,
      totalRows: 0,
      percentComplete: 85,
      message: "Creating database indexes"
    });
    const createIndexStatements = getAllCreateIndexStatements();
    let indexCount = 0;
    for (const statement of createIndexStatements) {
      this.db.run(statement);
      indexCount++;
      const indexProgress = 85 + Math.floor(indexCount / createIndexStatements.length * 10);
      onProgress?.({
        phase: "creating_indexes",
        currentFile: null,
        filesCompleted: Object.keys(files).length,
        totalFiles: Object.keys(files).length,
        rowsProcessed: 0,
        totalRows: 0,
        percentComplete: indexProgress,
        message: `Creating indexes (${indexCount}/${createIndexStatements.length})`
      });
    }
    onProgress?.({
      phase: "analyzing",
      currentFile: null,
      filesCompleted: Object.keys(files).length,
      totalFiles: Object.keys(files).length,
      rowsProcessed: 0,
      totalRows: 0,
      percentComplete: 95,
      message: "Optimizing query performance"
    });
    this.db.run("ANALYZE");
    this.db.run("PRAGMA synchronous = FULL");
    this.db.run("PRAGMA locking_mode = NORMAL");
    if (options.realtimeFeedUrls) {
      this.realtimeFeedUrls = options.realtimeFeedUrls;
    }
    if (options.stalenessThreshold !== void 0) {
      this.stalenessThreshold = options.stalenessThreshold;
    }
    if (this.realtimeFeedUrls.length > 0) {
      try {
        await loadRealtimeData(this.db, this.realtimeFeedUrls);
      } catch (error) {
        console.warn("Failed to fetch initial realtime data:", error);
      }
    }
  }
  /**
   * Initialize from existing database
   */
  async initFromDatabase(database, options) {
    this.SQL = options.SQL || await initSqlJs(options.locateFile ? { locateFile: options.locateFile } : {});
    this.db = new this.SQL.Database(new Uint8Array(database));
    createRealtimeTables(this.db);
    if (options.realtimeFeedUrls) {
      this.realtimeFeedUrls = options.realtimeFeedUrls;
    }
    if (options.stalenessThreshold !== void 0) {
      this.stalenessThreshold = options.stalenessThreshold;
    }
  }
  /**
   * Export database to ArrayBuffer
   */
  export() {
    if (!this.db) {
      throw new Error("Database not initialized");
    }
    const data = this.db.export();
    const buffer = new ArrayBuffer(data.length);
    new Uint8Array(buffer).set(data);
    return buffer;
  }
  /**
   * Close the database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
  /**
   * Get direct access to the database (for advanced queries)
   */
  getDatabase() {
    if (!this.db) {
      throw new Error("Database not initialized");
    }
    return this.db;
  }
  // ==================== Agency Methods ====================
  /**
   * Get agencies with optional filters
   * Pass agencyId filter to get a specific agency
   */
  getAgencies(filters) {
    if (!this.db) throw new Error("Database not initialized");
    return getAgencies(this.db, filters);
  }
  // ==================== Stop Methods ====================
  /**
   * Get stops with optional filters
   * Pass stopId filter to get a specific stop
   */
  getStops(filters) {
    if (!this.db) throw new Error("Database not initialized");
    return getStops(this.db, filters);
  }
  // ==================== Route Methods ====================
  /**
   * Get routes with optional filters
   * Pass routeId filter to get a specific route
   */
  getRoutes(filters) {
    if (!this.db) throw new Error("Database not initialized");
    return getRoutes(this.db, filters);
  }
  // ==================== Calendar Methods ====================
  /**
   * Get active service IDs for a given date (YYYYMMDD format)
   */
  getActiveServiceIds(date) {
    if (!this.db) throw new Error("Database not initialized");
    return getActiveServiceIds(this.db, date);
  }
  /**
   * Get calendar entry by service_id
   */
  getCalendarByServiceId(serviceId) {
    if (!this.db) throw new Error("Database not initialized");
    return getCalendarByServiceId(this.db, serviceId);
  }
  /**
   * Get calendar date exceptions for a service
   */
  getCalendarDates(serviceId) {
    if (!this.db) throw new Error("Database not initialized");
    return getCalendarDates(this.db, serviceId);
  }
  /**
   * Get calendar date exceptions for a specific date
   */
  getCalendarDatesForDate(date) {
    if (!this.db) throw new Error("Database not initialized");
    return getCalendarDatesForDate(this.db, date);
  }
  // ==================== Trip Methods ====================
  /**
   * Get trips with optional filters
   * Pass tripId filter to get a specific trip
   *
   * @param filters - Optional filters
   * @param filters.tripId - Filter by trip ID (single value or array)
   * @param filters.routeId - Filter by route ID (single value or array)
   * @param filters.date - Filter by date (YYYYMMDD format) - will get active services for that date
   * @param filters.directionId - Filter by direction ID (single value or array)
   * @param filters.agencyId - Filter by agency ID (single value or array)
   * @param filters.limit - Limit number of results
   *
   * @example
   * // Get all trips for a route on a specific date
   * const trips = gtfs.getTrips({ routeId: 'ROUTE_1', date: '20240115' });
   *
   * @example
   * // Get all trips for a route going in one direction
   * const trips = gtfs.getTrips({ routeId: 'ROUTE_1', directionId: 0 });
   *
   * @example
   * // Get a specific trip
   * const trips = gtfs.getTrips({ tripId: 'TRIP_123' });
   */
  getTrips(filters) {
    if (!this.db) throw new Error("Database not initialized");
    const { date, ...restFilters } = filters || {};
    const finalFilters = { ...restFilters };
    if (date) {
      const serviceIds = getActiveServiceIds(this.db, date);
      finalFilters.serviceIds = serviceIds;
    }
    return getTrips(this.db, finalFilters, this.stalenessThreshold);
  }
  // ==================== Stop Time Methods ====================
  /**
   * Get stop times with optional filters
   *
   * @param filters - Optional filters
   * @param filters.tripId - Filter by trip ID (single value or array)
   * @param filters.stopId - Filter by stop ID (single value or array)
   * @param filters.routeId - Filter by route ID (single value or array)
   * @param filters.date - Filter by date (YYYYMMDD format) - will get active services for that date
   * @param filters.directionId - Filter by direction ID (single value or array)
   * @param filters.agencyId - Filter by agency ID (single value or array)
   * @param filters.includeRealtime - Include realtime data (delay and time fields)
   * @param filters.limit - Limit number of results
   *
   * @example
   * // Get stop times for a specific trip
   * const stopTimes = gtfs.getStopTimes({ tripId: 'TRIP_123' });
   *
   * @example
   * // Get stop times at a stop for a specific route on a date
   * const stopTimes = gtfs.getStopTimes({
   *   stopId: 'STOP_123',
   *   routeId: 'ROUTE_1',
   *   date: '20240115'
   * });
   *
   * @example
   * // Get stop times with realtime data
   * const stopTimes = gtfs.getStopTimes({
   *   tripId: 'TRIP_123',
   *   includeRealtime: true
   * });
   */
  getStopTimes(filters) {
    if (!this.db) throw new Error("Database not initialized");
    const { date, ...restFilters } = filters || {};
    const finalFilters = { ...restFilters };
    if (date) {
      const serviceIds = getActiveServiceIds(this.db, date);
      finalFilters.serviceIds = serviceIds;
    }
    return getStopTimes(this.db, finalFilters, this.stalenessThreshold);
  }
  /**
   * Build an ordered list of stops from multiple trips
   *
   * This is useful when you need to display a timetable for a route where different trips
   * may stop at different sets of stops (e.g., express vs local service, or trips with
   * different start/end points).
   *
   * The method intelligently merges stop sequences from all provided trips to create
   * a comprehensive ordered list of all unique stops.
   *
   * @param tripIds - Array of trip IDs to analyze
   * @returns Ordered array of Stop objects representing all unique stops
   *
   * @example
   * // Get all trips for a route going in one direction
   * const trips = gtfs.getTrips({ routeId: 'ROUTE_1', directionId: 0 });
   * const tripIds = trips.map(t => t.trip_id);
   *
   * // Build ordered stop list for all these trips
   * const stops = gtfs.buildOrderedStopList(tripIds);
   *
   * // Now you can display a timetable with all possible stops
   * stops.forEach(stop => {
   *   console.log(stop.stop_name);
   * });
   */
  buildOrderedStopList(tripIds) {
    if (!this.db) throw new Error("Database not initialized");
    return buildOrderedStopList(this.db, tripIds);
  }
  // ==================== Realtime Methods ====================
  /**
   * Set GTFS-RT feed URLs
   */
  setRealtimeFeedUrls(urls) {
    this.realtimeFeedUrls = urls;
  }
  /**
   * Get currently configured GTFS-RT feed URLs
   */
  getRealtimeFeedUrls() {
    return [...this.realtimeFeedUrls];
  }
  /**
   * Set staleness threshold in seconds
   */
  setStalenessThreshold(seconds) {
    this.stalenessThreshold = seconds;
  }
  /**
   * Get current staleness threshold
   */
  getStalenessThreshold() {
    return this.stalenessThreshold;
  }
  /**
   * Fetch and load GTFS Realtime data from configured feed URLs or provided URLs
   * @param urls - Optional array of feed URLs. If not provided, uses configured feed URLs
   */
  async fetchRealtimeData(urls) {
    if (!this.db) throw new Error("Database not initialized");
    const feedUrls = urls || this.realtimeFeedUrls;
    if (feedUrls.length === 0) {
      throw new Error("No realtime feed URLs configured. Use setRealtimeFeedUrls() or pass urls parameter.");
    }
    await loadRealtimeData(this.db, feedUrls);
  }
  /**
   * Clear all realtime data from the database
   */
  clearRealtimeData() {
    if (!this.db) throw new Error("Database not initialized");
    clearRealtimeData(this.db);
  }
  /**
   * Get alerts with optional filters
   * Pass alertId filter to get a specific alert
   */
  getAlerts(filters) {
    if (!this.db) throw new Error("Database not initialized");
    return getAlerts(this.db, filters, this.stalenessThreshold);
  }
  /**
   * Get vehicle positions with optional filters
   * Pass tripId filter to get vehicle position for a specific trip
   */
  getVehiclePositions(filters) {
    if (!this.db) throw new Error("Database not initialized");
    return getVehiclePositions(this.db, filters, this.stalenessThreshold);
  }
  /**
   * Get trip updates with optional filters
   * Pass tripId filter to get trip update for a specific trip
   */
  getTripUpdates(filters) {
    if (!this.db) throw new Error("Database not initialized");
    return getTripUpdates(this.db, filters, this.stalenessThreshold);
  }
  /**
   * Get stop time updates with optional filters
   * Pass tripId filter to get stop time updates for a specific trip
   */
  getStopTimeUpdates(filters) {
    if (!this.db) throw new Error("Database not initialized");
    return getStopTimeUpdates(this.db, filters, this.stalenessThreshold);
  }
  // ==================== Debug Export Methods ====================
  // These methods export all realtime data without staleness filtering
  // for debugging purposes
  /**
   * Export all alerts without staleness filtering (for debugging)
   */
  debugExportAllAlerts() {
    if (!this.db) throw new Error("Database not initialized");
    return getAllAlerts(this.db);
  }
  /**
   * Export all vehicle positions without staleness filtering (for debugging)
   */
  debugExportAllVehiclePositions() {
    if (!this.db) throw new Error("Database not initialized");
    return getAllVehiclePositions(this.db);
  }
  /**
   * Export all trip updates without staleness filtering (for debugging)
   */
  debugExportAllTripUpdates() {
    if (!this.db) throw new Error("Database not initialized");
    return getAllTripUpdates(this.db);
  }
  /**
   * Export all stop time updates without staleness filtering (for debugging)
   * Returns extended type with trip_id and rt_last_updated for debugging purposes
   */
  debugExportAllStopTimeUpdates() {
    if (!this.db) throw new Error("Database not initialized");
    return getAllStopTimeUpdates(this.db);
  }
  // ==================== Cache Management Methods ====================
  /**
   * Get cache statistics
   * @param cacheStore - Cache store to query (optional, auto-detects if not provided)
   * @returns Cache statistics including size, entry count, and age information
   */
  static async getCacheStats(cacheStore) {
    const { getCacheStats: getCacheStats2 } = await Promise.resolve().then(() => (init_utils(), utils_exports));
    const cache = cacheStore || await this.getDefaultCacheStore();
    if (!cache) {
      throw new Error("No cache store available");
    }
    const entries = await cache.list?.() || [];
    return getCacheStats2(entries);
  }
  /**
   * Clean expired cache entries
   * @param cacheStore - Cache store to clean (optional, auto-detects if not provided)
   * @param expirationMs - Expiration time in milliseconds (default: 7 days)
   * @returns Number of entries deleted
   */
  static async cleanExpiredCache(cacheStore, expirationMs = DEFAULT_CACHE_EXPIRATION_MS) {
    const { filterExpiredEntries: filterExpiredEntries2 } = await Promise.resolve().then(() => (init_utils(), utils_exports));
    const cache = cacheStore || await this.getDefaultCacheStore();
    if (!cache || !cache.list) {
      throw new Error("No cache store available or cache store does not support listing");
    }
    const allEntries = await cache.list();
    const expiredEntries = allEntries.filter(
      (entry) => !filterExpiredEntries2([entry], expirationMs).length
    );
    await Promise.all(expiredEntries.map((entry) => cache.delete(entry.key)));
    return expiredEntries.length;
  }
  /**
   * Clear all cache entries
   * @param cacheStore - Cache store to clear (optional, auto-detects if not provided)
   */
  static async clearCache(cacheStore) {
    const cache = cacheStore || await this.getDefaultCacheStore();
    if (!cache) {
      throw new Error("No cache store available");
    }
    await cache.clear();
  }
  /**
   * List all cache entries
   * @param cacheStore - Cache store to query (optional, auto-detects if not provided)
   * @param includeExpired - Include expired entries (default: false)
   * @returns Array of cache entries with metadata
   */
  static async listCache(cacheStore, includeExpired = false) {
    const { filterExpiredEntries: filterExpiredEntries2 } = await Promise.resolve().then(() => (init_utils(), utils_exports));
    const cache = cacheStore || await this.getDefaultCacheStore();
    if (!cache || !cache.list) {
      throw new Error("No cache store available or cache store does not support listing");
    }
    const entries = await cache.list();
    if (includeExpired) {
      return entries;
    }
    return filterExpiredEntries2(entries);
  }
  /**
   * Get the default cache store for the current environment
   * @returns Default cache store or null if unavailable
   */
  static async getDefaultCacheStore() {
    try {
      if (typeof indexedDB !== "undefined") {
        const { IndexedDBCacheStore: IndexedDBCacheStore2 } = await Promise.resolve().then(() => (init_indexeddb_store(), indexeddb_store_exports));
        return new IndexedDBCacheStore2();
      } else if (typeof process !== "undefined" && process.versions?.node) {
        const { FileSystemCacheStore: FileSystemCacheStore2 } = await Promise.resolve().then(() => (init_fs_store(), fs_store_exports));
        return new FileSystemCacheStore2();
      }
    } catch (error) {
      console.warn("Failed to initialize default cache store:", error);
    }
    return null;
  }
};

// src/types/gtfs-rt.ts
var ScheduleRelationship = /* @__PURE__ */ ((ScheduleRelationship2) => {
  ScheduleRelationship2[ScheduleRelationship2["SCHEDULED"] = 0] = "SCHEDULED";
  ScheduleRelationship2[ScheduleRelationship2["ADDED"] = 1] = "ADDED";
  ScheduleRelationship2[ScheduleRelationship2["UNSCHEDULED"] = 2] = "UNSCHEDULED";
  ScheduleRelationship2[ScheduleRelationship2["CANCELED"] = 3] = "CANCELED";
  ScheduleRelationship2[ScheduleRelationship2["SKIPPED"] = 4] = "SKIPPED";
  ScheduleRelationship2[ScheduleRelationship2["NO_DATA"] = 5] = "NO_DATA";
  return ScheduleRelationship2;
})(ScheduleRelationship || {});
var VehicleStopStatus = /* @__PURE__ */ ((VehicleStopStatus2) => {
  VehicleStopStatus2[VehicleStopStatus2["INCOMING_AT"] = 0] = "INCOMING_AT";
  VehicleStopStatus2[VehicleStopStatus2["STOPPED_AT"] = 1] = "STOPPED_AT";
  VehicleStopStatus2[VehicleStopStatus2["IN_TRANSIT_TO"] = 2] = "IN_TRANSIT_TO";
  return VehicleStopStatus2;
})(VehicleStopStatus || {});
var CongestionLevel = /* @__PURE__ */ ((CongestionLevel2) => {
  CongestionLevel2[CongestionLevel2["UNKNOWN_CONGESTION_LEVEL"] = 0] = "UNKNOWN_CONGESTION_LEVEL";
  CongestionLevel2[CongestionLevel2["RUNNING_SMOOTHLY"] = 1] = "RUNNING_SMOOTHLY";
  CongestionLevel2[CongestionLevel2["STOP_AND_GO"] = 2] = "STOP_AND_GO";
  CongestionLevel2[CongestionLevel2["CONGESTION"] = 3] = "CONGESTION";
  CongestionLevel2[CongestionLevel2["SEVERE_CONGESTION"] = 4] = "SEVERE_CONGESTION";
  return CongestionLevel2;
})(CongestionLevel || {});
var OccupancyStatus = /* @__PURE__ */ ((OccupancyStatus2) => {
  OccupancyStatus2[OccupancyStatus2["EMPTY"] = 0] = "EMPTY";
  OccupancyStatus2[OccupancyStatus2["MANY_SEATS_AVAILABLE"] = 1] = "MANY_SEATS_AVAILABLE";
  OccupancyStatus2[OccupancyStatus2["FEW_SEATS_AVAILABLE"] = 2] = "FEW_SEATS_AVAILABLE";
  OccupancyStatus2[OccupancyStatus2["STANDING_ROOM_ONLY"] = 3] = "STANDING_ROOM_ONLY";
  OccupancyStatus2[OccupancyStatus2["CRUSHED_STANDING_ROOM_ONLY"] = 4] = "CRUSHED_STANDING_ROOM_ONLY";
  OccupancyStatus2[OccupancyStatus2["FULL"] = 5] = "FULL";
  OccupancyStatus2[OccupancyStatus2["NOT_ACCEPTING_PASSENGERS"] = 6] = "NOT_ACCEPTING_PASSENGERS";
  return OccupancyStatus2;
})(OccupancyStatus || {});
var AlertCause = /* @__PURE__ */ ((AlertCause2) => {
  AlertCause2[AlertCause2["UNKNOWN_CAUSE"] = 1] = "UNKNOWN_CAUSE";
  AlertCause2[AlertCause2["OTHER_CAUSE"] = 2] = "OTHER_CAUSE";
  AlertCause2[AlertCause2["TECHNICAL_PROBLEM"] = 3] = "TECHNICAL_PROBLEM";
  AlertCause2[AlertCause2["STRIKE"] = 4] = "STRIKE";
  AlertCause2[AlertCause2["DEMONSTRATION"] = 5] = "DEMONSTRATION";
  AlertCause2[AlertCause2["ACCIDENT"] = 6] = "ACCIDENT";
  AlertCause2[AlertCause2["HOLIDAY"] = 7] = "HOLIDAY";
  AlertCause2[AlertCause2["WEATHER"] = 8] = "WEATHER";
  AlertCause2[AlertCause2["MAINTENANCE"] = 9] = "MAINTENANCE";
  AlertCause2[AlertCause2["CONSTRUCTION"] = 10] = "CONSTRUCTION";
  AlertCause2[AlertCause2["POLICE_ACTIVITY"] = 11] = "POLICE_ACTIVITY";
  AlertCause2[AlertCause2["MEDICAL_EMERGENCY"] = 12] = "MEDICAL_EMERGENCY";
  return AlertCause2;
})(AlertCause || {});
var AlertEffect = /* @__PURE__ */ ((AlertEffect2) => {
  AlertEffect2[AlertEffect2["NO_SERVICE"] = 1] = "NO_SERVICE";
  AlertEffect2[AlertEffect2["REDUCED_SERVICE"] = 2] = "REDUCED_SERVICE";
  AlertEffect2[AlertEffect2["SIGNIFICANT_DELAYS"] = 3] = "SIGNIFICANT_DELAYS";
  AlertEffect2[AlertEffect2["DETOUR"] = 4] = "DETOUR";
  AlertEffect2[AlertEffect2["ADDITIONAL_SERVICE"] = 5] = "ADDITIONAL_SERVICE";
  AlertEffect2[AlertEffect2["MODIFIED_SERVICE"] = 6] = "MODIFIED_SERVICE";
  AlertEffect2[AlertEffect2["OTHER_EFFECT"] = 7] = "OTHER_EFFECT";
  AlertEffect2[AlertEffect2["UNKNOWN_EFFECT"] = 8] = "UNKNOWN_EFFECT";
  AlertEffect2[AlertEffect2["STOP_MOVED"] = 9] = "STOP_MOVED";
  AlertEffect2[AlertEffect2["NO_EFFECT"] = 10] = "NO_EFFECT";
  AlertEffect2[AlertEffect2["ACCESSIBILITY_ISSUE"] = 11] = "ACCESSIBILITY_ISSUE";
  return AlertEffect2;
})(AlertEffect || {});

// src/index.ts
init_indexeddb_store();
init_fs_store();
init_utils();
export {
  AlertCause,
  AlertEffect,
  CongestionLevel,
  DEFAULT_CACHE_EXPIRATION_MS,
  FileSystemCacheStore,
  GTFS_SCHEMA,
  GtfsSqlJs,
  IndexedDBCacheStore,
  OccupancyStatus,
  ScheduleRelationship,
  VehicleStopStatus,
  computeChecksum,
  computeZipChecksum,
  filterExpiredEntries,
  generateCacheKey,
  getCacheStats,
  isCacheExpired
};
/**
 * gtfs-sqljs - Load GTFS data into sql.js SQLite database
 * @author Théophile Helleboid/SysDevRun
 * @license MIT
 */
//# sourceMappingURL=index.mjs.map