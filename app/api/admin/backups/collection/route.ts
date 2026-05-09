import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/require-permission';
import { fetchAndParseBackup } from '@/lib/backup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 500;

/**
 * GET /api/admin/backups/collection
 *   ?url=<cloudinary-secure-url>
 *   &name=<collectionName>
 *   &page=<1-based page number, default 1>
 *   &pageSize=<default 50, max 500>
 *   &full=true   ← bypass pagination, return ALL docs (for download/copy)
 *
 * Downloads + decompresses the backup and returns just the chosen collection's
 * documents (paginated by default).
 */
export async function GET(req: NextRequest) {
  try {
    await requirePermission('Admin', 'view');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Forbidden';
    return NextResponse.json({ error: message }, { status: 403 });
  }

  const url = req.nextUrl.searchParams.get('url');
  const name = req.nextUrl.searchParams.get('name');
  const full = req.nextUrl.searchParams.get('full') === 'true';

  if (!url || !name) {
    return NextResponse.json(
      { ok: false, error: 'Missing ?url or ?name' },
      { status: 400 },
    );
  }
  if (!/^https:\/\/res\.cloudinary\.com\//.test(url)) {
    return NextResponse.json({ ok: false, error: 'Invalid backup URL' }, { status: 400 });
  }

  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') || '1', 10));
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(req.nextUrl.searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE), 10)),
  );

  try {
    const backup = await fetchAndParseBackup(url);
    const docs = backup.collections[name];

    if (!docs) {
      return NextResponse.json(
        { ok: false, error: `Collection "${name}" not found in this backup` },
        { status: 404 },
      );
    }

    const all = Array.isArray(docs) ? docs : [];
    const totalDocs = all.length;

    if (full) {
      return NextResponse.json({
        ok: true,
        collection: name,
        totalDocs,
        page: 1,
        pageSize: totalDocs,
        totalPages: 1,
        documents: all,
      });
    }

    const start = (page - 1) * pageSize;
    const slice = all.slice(start, start + pageSize);

    return NextResponse.json({
      ok: true,
      collection: name,
      totalDocs,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(totalDocs / pageSize)),
      documents: slice,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch collection';
    console.error('[backups:collection] failed:', err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
