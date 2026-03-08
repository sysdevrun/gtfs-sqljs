/**
 * Tests for selective ZIP extraction
 */

import { describe, it, expect } from 'vitest';
import { loadGTFSZip, GTFS_FILE_MAPPING } from '../src/loaders/zip-loader';
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

const feedPath = path.join(__dirname, 'fixtures', 'sample-feed.zip');

describe('loadGTFSZip', () => {
  it('should only extract files defined in GTFS_FILE_MAPPING', async () => {
    const zipData = await fs.promises.readFile(feedPath);
    const files = await loadGTFSZip(zipData);

    for (const fileName of Object.keys(files)) {
      expect(fileName in GTFS_FILE_MAPPING).toBe(true);
    }
  });

  it('should not extract unknown .txt files from ZIP', async () => {
    // Create a ZIP with a known GTFS file and an unknown file
    const zip = new JSZip();
    zip.file('agency.txt', 'agency_id,agency_name\nDTA,Demo');
    zip.file('custom_data.txt', 'this,should,be,ignored');
    zip.file('notes.txt', 'random notes');

    const zipData = await zip.generateAsync({ type: 'uint8array' });
    const files = await loadGTFSZip(zipData);

    expect(files['agency.txt']).toBeDefined();
    expect(files['custom_data.txt']).toBeUndefined();
    expect(files['notes.txt']).toBeUndefined();
    expect(Object.keys(files)).toEqual(['agency.txt']);
  });

  it('should skip files listed in skipFiles', async () => {
    const zipData = await fs.promises.readFile(feedPath);
    const files = await loadGTFSZip(zipData, ['shapes.txt', 'frequencies.txt']);

    expect(files['shapes.txt']).toBeUndefined();
    expect(files['frequencies.txt']).toBeUndefined();
    // Other files should still be present
    expect(files['agency.txt']).toBeDefined();
    expect(files['stops.txt']).toBeDefined();
    expect(files['routes.txt']).toBeDefined();
  });

  it('should extract all known GTFS files when no skipFiles specified', async () => {
    const zipData = await fs.promises.readFile(feedPath);
    const files = await loadGTFSZip(zipData);

    // The sample feed has these files
    expect(files['agency.txt']).toBeDefined();
    expect(files['calendar.txt']).toBeDefined();
    expect(files['routes.txt']).toBeDefined();
    expect(files['stops.txt']).toBeDefined();
    expect(files['stop_times.txt']).toBeDefined();
    expect(files['trips.txt']).toBeDefined();
    expect(files['shapes.txt']).toBeDefined();
  });

  it('should handle files in subdirectories within the ZIP', async () => {
    const zip = new JSZip();
    zip.file('feed/agency.txt', 'agency_id,agency_name\nDTA,Demo');
    zip.file('feed/unknown.txt', 'should be ignored');

    const zipData = await zip.generateAsync({ type: 'uint8array' });
    const files = await loadGTFSZip(zipData);

    expect(files['agency.txt']).toBeDefined();
    expect(files['unknown.txt']).toBeUndefined();
  });

  it('should not extract non-.txt files', async () => {
    const zip = new JSZip();
    zip.file('agency.txt', 'agency_id,agency_name\nDTA,Demo');
    zip.file('readme.md', '# GTFS Feed');
    zip.file('data.json', '{}');

    const zipData = await zip.generateAsync({ type: 'uint8array' });
    const files = await loadGTFSZip(zipData);

    expect(Object.keys(files)).toEqual(['agency.txt']);
  });
});
