import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import { gzip } from 'zlib';
import { promisify } from 'util';
import connectToDatabase from './db';

const gzipAsync = promisify(gzip);

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
