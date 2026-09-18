"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ChevronDown, FileWarning } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

// Mirrors app/(protected)/writeups/_components/FormalWriteupsTab.tsx — kept
// in sync by hand since that tab owns the canonical label/color mapping.
const WARNING_LEVEL_LABELS: Record<string, string> = {
  first_warning: "First Warning",
  second_warning: "Second Warning",
  third_warning: "Third Warning",
  final_warning: "Final Warning",
  suspension_review: "Suspension Review",
};
const WARNING_LEVEL_COLORS: Record<string, string> = {
  first_warning: "bg-blue-500 text-white border-blue-600",
  second_warning: "bg-amber-500 text-white border-amber-600",
  third_warning: "bg-orange-500 text-white border-orange-600",
  final_warning: "bg-red-500 text-white border-red-600",
  suspension_review: "bg-red-800 text-white border-red-900",
};
const STATUS_LABELS: Record<string, string> = {
  draft: "Draft — needs signature",
  pending_review: "Pending Manager Review",
  escalated: "Pending Manager Review",
  signed: "Signed (pre-review)",
  refused_to_sign: "Refused to Sign (pre-review)",
  uploaded_signed_copy: "Signed — Uploaded Copy (pre-review)",
  closed: "Closed",
};

interface Writeup {
  _id: string;
  incidentDate: string;
  categoryLabel: string;
  subCategory?: string;
  warningLevel: string;
  status: string;
  description?: string;
  planForImprovement?: string;
  consequences?: string;
  managerName?: string;
  managerReview?: { decision: string; outcome?: string; notes?: string; reviewedBy?: string; reviewedAt?: string };
  escalation?: { outcome: string; notes?: string; resolvedBy?: string; resolvedAt?: string };
}

/**
 * A read-only history of an employee's formal write-ups, shown right on
 * their profile.
 *
 * The Write-Ups module's own list defaults to hiding anyone not currently
 * Active (a toggle exists to include terminated employees, but it's
 * off by default so the working list of open issues doesn't get cluttered
 * by people who no longer work here) — which meant there was no way at all
 * to see a terminated employee's write-up history without leaving their
 * profile and remembering to flip that switch. This fetches by employeeId
 * directly, so status doesn't matter here: it shows everything filed
 * against this person, always.
 */
export function EmployeeWriteups({ employeeId }: { employeeId: string }) {
  const [writeups, setWriteups] = useState<Writeup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!employeeId) return;
    let cancelled = false;
    setWriteups(null);
    setError(null);
    fetch(`/api/writeups?employeeId=${employeeId}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.error) setError(d.error);
        else setWriteups(d.writeups || []);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load write-ups.");
      });
    return () => { cancelled = true; };
  }, [employeeId]);

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-sm text-red-600 dark:text-red-400">
        <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
      </div>
    );
  }

  if (writeups === null) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    );
  }

  if (writeups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
        <FileWarning className="w-8 h-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground/60 font-medium">No write-ups on file.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {writeups.map((w) => {
        const open = openId === w._id;
        const outcome = w.managerReview?.outcome || w.escalation?.outcome;
        return (
          <div key={w._id} className="rounded-xl border border-border/50 bg-card overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenId(open ? null : w._id)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                  {w.incidentDate ? format(new Date(w.incidentDate), "MMM d, yyyy") : "—"}
                </span>
                <span className="text-sm font-medium text-foreground truncate">
                  {w.categoryLabel}{w.subCategory ? ` — ${w.subCategory}` : ""}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge className={cn("text-[10px]", WARNING_LEVEL_COLORS[w.warningLevel] || "")}>
                  {WARNING_LEVEL_LABELS[w.warningLevel] || w.warningLevel}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {STATUS_LABELS[w.status] || w.status}
                </Badge>
                <ChevronDown className={cn("w-4 h-4 text-muted-foreground/50 transition-transform", open && "rotate-180")} />
              </div>
            </button>

            {open && (
              <div className="px-4 pb-4 pt-1 space-y-3 border-t border-border/40 text-sm">
                {w.description && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 mb-1">Description</p>
                    <p className="text-foreground/90 whitespace-pre-wrap">{w.description}</p>
                  </div>
                )}
                {w.planForImprovement && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 mb-1">Plan for Improvement</p>
                    <p className="text-foreground/90 whitespace-pre-wrap">{w.planForImprovement}</p>
                  </div>
                )}
                {w.consequences && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 mb-1">Consequences</p>
                    <p className="text-foreground/90 whitespace-pre-wrap">{w.consequences}</p>
                  </div>
                )}
                {outcome && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 mb-1">Manager Decision</p>
                    <p className="text-foreground/90">
                      {outcome.replace(/_/g, " ")}
                      {(w.managerReview?.notes || w.escalation?.notes) ? ` — ${w.managerReview?.notes || w.escalation?.notes}` : ""}
                    </p>
                  </div>
                )}
                {w.managerName && (
                  <p className="text-[11px] text-muted-foreground/60">Issued by {w.managerName}</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
