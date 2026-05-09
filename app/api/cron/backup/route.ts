import { NextRequest, NextResponse } from 'next/server';
import { runBackup } from '@/lib/backup';

// Force Node runtime (mongoose + cloudinary need Node, not Edge).
export const runtime = 'nodejs';
// Allow up to 5 minutes for big DBs (Vercel Pro/Enterprise).
export const maxDuration = 300;
// Never cache.
export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/backup
 *
 * Triggered by Vercel Cron (configured in vercel.json) at 02:00 UTC daily.
 * Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` automatically.
 *
 * Each call creates a NEW dated backup in Cloudinary — nothing is ever overwritten.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const result = await runBackup();
    console.log('[backup] success', {
      date: result.date,
      collections: result.collectionCount,
      docs: result.totalDocs,
      sizeMB: result.compressedSizeMB,
      durationMs: result.durationMs,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[backup] failed:', err);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
