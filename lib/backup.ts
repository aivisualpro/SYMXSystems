import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';
import connectToDatabase from './db';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface BackupResult {
  ok: true;
  date: string;
  isoTimestamp: string;
  databaseName: string;
  collectionCount: number;
  totalDocs: number;
  rawSizeBytes: number;
  compressedSizeBytes: number;
  compressedSizeMB: string;
  url: string;
  publicId: string;
  durationMs: number;
}

/**
 * Exports every collection in the connected database into a single
 * gzipped JSON blob and uploads it to Cloudinary as a "raw" resource.
 *
 * Each backup is given a unique, date-stamped public_id so a new file
 * is created daily and prior backups are NEVER overwritten.
 *
 * Final Cloudinary path looks like:
 *   mongodb-backups/2026-05-09/full-backup-1746763200000.json.gz
 */
export async function runBackup(): Promise<BackupResult> {
  const startedAt = Date.now();
  await connectToDatabase();

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('MongoDB connection is not ready');
  }

  const collections = await db.listCollections().toArray();

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10); // 2026-05-09
  const timestamp = now.getTime();

  const backup: {
    metadata: {
      database: string;
      createdAt: string;
      collectionCount: number;
      collections: string[];
    };
    collections: Record<string, unknown[]>;
  } = {
    metadata: {
      database: db.databaseName,
      createdAt: now.toISOString(),
      collectionCount: collections.length,
      collections: collections.map((c) => c.name),
    },
    collections: {},
  };

  let totalDocs = 0;
  for (const col of collections) {
    // Skip system collections — Atlas re-creates these.
    if (col.name.startsWith('system.')) continue;

    const docs = await db.collection(col.name).find({}).toArray();
    backup.collections[col.name] = docs;
    totalDocs += docs.length;
  }

  const json = JSON.stringify(backup);
  const rawSize = Buffer.byteLength(json, 'utf8');
  const compressed = await gzipAsync(Buffer.from(json));

  const publicId = `mongodb-backups/${dateStr}/full-backup-${timestamp}`;

  const upload = await new Promise<{ secure_url: string; public_id: string }>(
    (resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'raw',
          public_id: publicId,
          // Cloudinary won't try to overwrite — every public_id is unique per run.
          overwrite: false,
          use_filename: false,
          unique_filename: false,
          tags: ['mongodb-backup', `date:${dateStr}`, `db:${db.databaseName}`],
        },
        (err, res) => {
          if (err || !res) {
            reject(err || new Error('Cloudinary upload returned no result'));
            return;
          }
          resolve({ secure_url: res.secure_url, public_id: res.public_id });
        },
      );
      stream.end(compressed);
    },
  );

  return {
    ok: true,
    date: dateStr,
    isoTimestamp: now.toISOString(),
    databaseName: db.databaseName,
    collectionCount: collections.length,
    totalDocs,
    rawSizeBytes: rawSize,
    compressedSizeBytes: compressed.length,
    compressedSizeMB: (compressed.length / 1024 / 1024).toFixed(2),
    url: upload.secure_url,
    publicId: upload.public_id,
    durationMs: Date.now() - startedAt,
  };
}

// ---------------------------------------------------------------------------
// Read side: list & fetch existing backups for the admin UI.
// ---------------------------------------------------------------------------

export interface BackupListItem {
  publicId: string;
  url: string;
  date: string; // YYYY-MM-DD parsed from the path
  bytes: number;
  createdAt: string; // Cloudinary's created_at
}

interface CloudinaryListResource {
  public_id: string;
  secure_url: string;
  bytes: number;
  created_at: string;
}

/**
 * List every backup ever uploaded to Cloudinary, newest first.
 * Cloudinary's "search" API understands the tag we attach in runBackup().
 */
export async function listBackups(maxResults = 100): Promise<BackupListItem[]> {
  const result: { resources?: CloudinaryListResource[] } =
    await cloudinary.search
      .expression('tags=mongodb-backup AND resource_type:raw')
      .sort_by('created_at', 'desc')
      .max_results(maxResults)
      .execute();

  const resources = result.resources ?? [];

  return resources.map((r) => {
    // public_id format: mongodb-backups/2026-05-09/full-backup-1746763200000
    const m = r.public_id.match(/mongodb-backups\/(\d{4}-\d{2}-\d{2})\//);
    return {
      publicId: r.public_id,
      url: r.secure_url,
      date: m ? m[1] : r.created_at.slice(0, 10),
      bytes: r.bytes,
      createdAt: r.created_at,
    };
  });
}

interface ParsedBackup {
  metadata: {
    database: string;
    createdAt: string;
    collectionCount: number;
    collections: string[];
  };
  collections: Record<string, unknown[]>;
}

/**
 * Download a backup from Cloudinary (gzipped JSON), decompress it and parse.
 * Returns the full backup object so callers can pluck whatever they need.
 *
 * Caller should be aware: full backups can be tens of MB once parsed.
 */
export async function fetchAndParseBackup(url: string): Promise<ParsedBackup> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Failed to fetch backup: ${res.status} ${res.statusText}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const decompressed = await gunzipAsync(Buffer.from(arrayBuffer));
  return JSON.parse(decompressed.toString('utf-8')) as ParsedBackup;
}
