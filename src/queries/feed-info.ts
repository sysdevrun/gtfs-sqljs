/**
 * Feed Info Query Methods
 */

import type { GtfsDatabase, Row } from '../adapters/types';
import type { FeedInfo } from '../types/gtfs';

/**
 * Get feed_info rows
 * - The GTFS spec allows multiple rows (e.g. translations), so an array is returned
 */
export async function getFeedInfo(db: GtfsDatabase): Promise<FeedInfo[]> {
  const stmt = await db.prepare('SELECT * FROM feed_info');

  const feedInfos: FeedInfo[] = [];
  while (await stmt.step()) {
    const row = await stmt.getAsObject();
    feedInfos.push(rowToFeedInfo(row));
  }

  await stmt.free();
  return feedInfos;
}

/**
 * Convert database row to FeedInfo object
 */
function rowToFeedInfo(row: Row): FeedInfo {
  return {
    feed_publisher_name: String(row.feed_publisher_name),
    feed_publisher_url: String(row.feed_publisher_url),
    feed_lang: String(row.feed_lang),
    default_lang: row.default_lang ? String(row.default_lang) : undefined,
    feed_start_date: row.feed_start_date ? String(row.feed_start_date) : undefined,
    feed_end_date: row.feed_end_date ? String(row.feed_end_date) : undefined,
    feed_version: row.feed_version ? String(row.feed_version) : undefined,
    feed_contact_email: row.feed_contact_email ? String(row.feed_contact_email) : undefined,
    feed_contact_url: row.feed_contact_url ? String(row.feed_contact_url) : undefined,
  };
}
