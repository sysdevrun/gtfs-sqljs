#!/usr/bin/env npx tsx
/**
 * Test script to ingest GTFS feeds from the Mobility Database.
 *
 * Usage:
 *   npx tsx tests/test-mobility-database-feeds.ts                  # all feeds from CSV
 *   npx tsx tests/test-mobility-database-feeds.ts 123              # feed by Mobility DB id
 *   npx tsx tests/test-mobility-database-feeds.ts https://...zip   # feed by URL
 *   npx tsx tests/test-mobility-database-feeds.ts ./local.zip      # feed from local file
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GtfsSqlJs } from '../src/index.js';
import { createSqlJsAdapter } from '../src/adapters/sql-js/index.js';

// ── ANSI colors ──────────────────────────────────────────────────────────────

const bold  = (s: string) => `\x1b[1m${s}\x1b[0m`;
const red   = (s: string) => `\x1b[31m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const cyan  = (s: string) => `\x1b[36m${s}\x1b[0m`;
const dim   = (s: string) => `\x1b[2m${s}\x1b[0m`;

// ── CSV feed list ────────────────────────────────────────────────────────────

const FEEDS_CSV_URL = 'https://files.mobilitydatabase.org/feeds_v2.csv';

interface FeedRow {
  id: string;
  data_type: string;
  'location.country_code': string;
  provider: string;
  name: string;
  'urls.direct_download': string;
  'urls.latest': string;
  status: string;
}

async function fetchFeedsCsv(): Promise<FeedRow[]> {
  console.log(cyan('Fetching Mobility Database feed list…'));
  const res = await fetch(FEEDS_CSV_URL);
  if (!res.ok) throw new Error(`Failed to fetch feeds CSV: ${res.status}`);
  const text = await res.text();
  return parseCsv(text);
}

function parseCsv(text: string): FeedRow[] {
  const lines = text.split('\n');
  const header = parseQuotedCsvLine(lines[0]);
  const rows: FeedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseQuotedCsvLine(line);
    const row: Record<string, string> = {};
    for (let j = 0; j < header.length; j++) {
      row[header[j]] = values[j] ?? '';
    }
    rows.push(row as unknown as FeedRow);
  }
  return rows;
}

function parseQuotedCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

// ── Ingest a single feed ─────────────────────────────────────────────────────

interface IngestResult {
  id: string;
  url: string;
  success: boolean;
  routeCount?: number;
  agencyNames?: string[];
  error?: string;
}

async function ingestFeed(url: string, label: string): Promise<IngestResult> {
  const result: IngestResult = { id: label, url, success: false };
  let gtfs: GtfsSqlJs | undefined;
  try {
    gtfs = await GtfsSqlJs.fromZip(url, {
      adapter: await createSqlJsAdapter(),
      skipFiles: ['shapes.txt'],
      onProgress: (info) => {
        process.stdout.write(`\r  ${dim(info.message)} ${dim(`(${info.percentComplete}%)`)}`);
      },
    });
    process.stdout.write('\r\x1b[K'); // clear progress line

    const routes = await gtfs.getRoutes();
    const agencies = await gtfs.getAgencies();
    result.routeCount = routes.length;
    result.agencyNames = agencies.map((a) => a.agency_name);
    result.success = true;
  } catch (err) {
    process.stdout.write('\r\x1b[K');
    result.error = err instanceof Error ? err.message : String(err);
  } finally {
    await gtfs?.close();
  }
  return result;
}

function printResult(r: IngestResult) {
  if (r.success) {
    console.log(green('  ✓ OK'));
    console.log(`    Routes: ${bold(String(r.routeCount))}`);
    console.log(`    Agencies: ${bold(r.agencyNames!.join(', '))}`);
  } else {
    console.log(red(`  ✗ ERROR: ${r.error}`));
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function runAll() {
  const feeds = await fetchFeedsCsv();
  const gtfsFeeds = feeds.filter(
    (f) => f.data_type === 'gtfs' && f.status === 'active' && (f['urls.direct_download'] || f['urls.latest']),
  );
  console.log(cyan(`Found ${bold(String(gtfsFeeds.length))} active GTFS feeds\n`));

  let ok = 0;
  let fail = 0;

  for (let i = 0; i < gtfsFeeds.length; i++) {
    const f = gtfsFeeds[i];
    const url = f['urls.direct_download'] || f['urls.latest'];
    const label = f.id;
    console.log(
      bold(`[${i + 1}/${gtfsFeeds.length}]`) +
        ` ${cyan(label)} ${dim(f.provider)}` +
        (f['location.country_code'] ? ` ${dim(`(${f['location.country_code']})`)}` : ''),
    );
    console.log(`  URL: ${dim(url)}`);

    const result = await ingestFeed(url, label);
    printResult(result);
    if (result.success) ok++;
    else fail++;
    console.log();
  }

  console.log(bold('── Summary ──'));
  console.log(green(`  Passed: ${ok}`));
  if (fail > 0) console.log(red(`  Failed: ${fail}`));
  console.log(`  Total:  ${ok + fail}`);

  if (fail > 0) process.exit(1);
}

async function runSingle(input: string) {
  let url: string;
  let label: string;

  if (input.startsWith('http://') || input.startsWith('https://')) {
    url = input;
    label = 'url';
    console.log(bold('URL feed'));
  } else if (input.endsWith('.zip') || input.includes('/') || input.includes('\\')) {
    // Local file
    const absPath = resolve(input);
    try {
      readFileSync(absPath, { flag: 'r' });
    } catch {
      console.error(red(`File not found: ${absPath}`));
      process.exit(1);
    }
    url = absPath;
    label = absPath;
    console.log(bold('Local file:'), dim(absPath));
  } else {
    // Mobility Database feed id – look it up in the CSV
    const feeds = await fetchFeedsCsv();
    const match = feeds.find((f) => f.id === input);
    if (!match) {
      console.error(red(`Feed id "${input}" not found in Mobility Database`));
      process.exit(1);
    }
    url = match['urls.direct_download'] || match['urls.latest'];
    label = input;
    console.log(
      bold(label) +
        ` ${dim(match.provider)}` +
        (match['location.country_code'] ? ` ${dim(`(${match['location.country_code']})`)}` : ''),
    );
  }

  console.log(`  URL: ${dim(url)}`);
  const result = await ingestFeed(url, label);
  printResult(result);

  if (!result.success) process.exit(1);
}

// ── Entry point ──────────────────────────────────────────────────────────────

const arg = process.argv[2];
if (arg) {
  runSingle(arg).catch((err) => {
    console.error(red(err instanceof Error ? err.message : String(err)));
    process.exit(1);
  });
} else {
  runAll().catch((err) => {
    console.error(red(err instanceof Error ? err.message : String(err)));
    process.exit(1);
  });
}
