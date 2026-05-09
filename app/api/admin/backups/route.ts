import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/require-permission';
import { listBackups } from '@/lib/backup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/backups
 *
 * Returns the list of MongoDB backups stored in Cloudinary, newest first.
 * Only one backup per date is shown (the latest if multiple exist for the same day).
 */
export async function GET() {
  try {
    await requirePermission('Admin', 'view');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Forbidden';
    return NextResponse.json({ error: message }, { status: 403 });
  }

  try {
    const all = await listBackups(200);

    // Keep only the newest backup per date so the date dropdown is clean.
    const seen = new Set<string>();
    const dedupedByDate = all.filter((b) => {
      if (seen.has(b.date)) return false;
      seen.add(b.date);
      return true;
    });

    return NextResponse.json({
      ok: true,
      count: dedupedByDate.length,
      backups: dedupedByDate,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list backups';
    console.error('[backups:list] failed:', err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
