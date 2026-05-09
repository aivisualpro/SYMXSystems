import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/require-permission';
import { fetchAndParseBackup } from '@/lib/backup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/admin/backups/inspect?url=<cloudinary-secure-url>
 *
 * Downloads + decompresses a backup and returns metadata + per-collection
 * document counts. Does NOT return any document data — that's what
 * /api/admin/backups/collection is for.
 */
export async function GET(req: NextRequest) {
  try {
    await requirePermission('Admin', 'view');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Forbidden';
    return NextResponse.json({ error: message }, { status: 403 });
  }

  const url = req.nextUrl.searchParams.get('url');
  if (!url) {
    return NextResponse.json({ ok: false, error: 'Missing ?url' }, { status: 400 });
  }

  // Reject anything that isn't a Cloudinary URL — defense against SSRF.
  if (!/^https:\/\/res\.cloudinary\.com\//.test(url)) {
    return NextResponse.json({ ok: false, error: 'Invalid backup URL' }, { status: 400 });
  }

  try {
    const backup = await fetchAndParseBackup(url);

    const collections = Object.entries(backup.collections).map(
      ([name, docs]) => ({
        name,
        documentCount: Array.isArray(docs) ? docs.length : 0,
      }),
    );
    collections.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      ok: true,
      metadata: backup.metadata,
      collections,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to inspect backup';
    console.error('[backups:inspect] failed:', err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
