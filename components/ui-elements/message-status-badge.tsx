import React from "react";
import { CheckCircle2, AlertCircle, Clock, Loader2, RefreshCw, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const STATUS_CONFIG: Record<string, {
  icon: typeof CheckCircle2;
  color: string;
  bg: string;
  label: string;
  pulse?: boolean;
}> = {
  pending: {
    icon: Loader2,
    color: "text-blue-400",
    bg: "bg-blue-400/10 border border-blue-400/20",
    label: "Pending",
    pulse: true,
  },
  sent: {
    icon: Send,
    color: "text-blue-400",
    bg: "bg-blue-400/10 border border-blue-400/20",
    label: "Sent",
  },
  delivered: {
    icon: CheckCircle2,
    color: "text-blue-400",
    bg: "bg-blue-400/10 border border-blue-400/20",
    label: "Delivered",
  },
  failed: {
    icon: AlertCircle,
    color: "text-red-400",
    bg: "bg-red-400/10 border border-red-400/20",
    label: "Failed",
  },
  confirmed: {
    icon: CheckCircle2,
    color: "text-emerald-400",
    bg: "bg-emerald-400/10 border border-emerald-400/20",
    label: "Confirmed",
  },
  change_requested: {
    icon: RefreshCw,
    color: "text-amber-400",
    bg: "bg-amber-400/10 border border-amber-400/20",
    label: "Change Requested",
  },
  skipped: {
    icon: AlertCircle,
    color: "text-amber-400",
    bg: "bg-amber-400/10 border border-amber-400/20",
    label: "Skipped",
  },
  replied: {
    icon: CheckCircle2,
    color: "text-purple-400",
    bg: "bg-purple-400/10 border border-purple-400/20",
    label: "Reply Received",
  },
  received: {
    icon: CheckCircle2,
    color: "text-emerald-400",
    bg: "bg-emerald-400/10 border border-emerald-400/20",
    label: "Received",
  },
};

export function MessageStatusBadge({
  status,
  createdAt,
  changeRemarks,
  isLiveUpdate,
  iconOnly,
  history,
  timezone,
}: {
  status: string;
  createdAt?: string;
  changeRemarks?: string;
  isLiveUpdate?: boolean;
  iconOnly?: boolean;
  history?: Array<{ status: string; changeRemarks?: string; updatedAt?: string; createdBy?: string; messageType?: string }>;
  timezone?: string;
}) {
  const config = STATUS_CONFIG[status];
  if (!config) return null;

  const Icon = config.icon;
  const tz = timezone || "America/Los_Angeles";
  const timeAgo = createdAt
    ? new Date(createdAt).toLocaleString("en-US", {
      timeZone: tz,
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
    : "";

  // Celebration animation classes for live-updated "confirmed"
  const isConfirmCelebration = isLiveUpdate && status === "confirmed";
  const isChangeCelebration = isLiveUpdate && status === "change_requested";

  // Format message type for display
  const formatMessageType = (type?: string) => {
    if (!type) return "";
    return type.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "inline-flex items-center justify-center rounded-full ring-1 shrink-0 transition-all duration-500",
            iconOnly ? "w-6 h-6" : "gap-1 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
            config.bg,
            config.color,
            config.pulse && "animate-pulse",
            isConfirmCelebration && "ring-2 ring-emerald-400/60 shadow-[0_0_12px_rgba(16,185,129,0.4)] scale-110",
            isChangeCelebration && "ring-2 ring-amber-400/60 shadow-[0_0_12px_rgba(245,158,11,0.4)] scale-110"
          )}
          style={isLiveUpdate ? { animation: "statusPopIn 0.5s cubic-bezier(0.34,1.56,0.64,1)" } : undefined}
        >
          <Icon className={cn(iconOnly ? "h-3.5 w-3.5" : "h-3 w-3", config.pulse && "animate-spin")} />
          {!iconOnly && config.label}
          {!iconOnly && isConfirmCelebration && <span className="ml-0.5">✓</span>}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs max-w-[300px] p-2 space-y-0.5">
        {/* Show history entries (newest first), or just the current status */}
        {history && history.length > 0 ? (
          [...history].reverse().map((h, i) => {
            const hConfig = STATUS_CONFIG[h.status];
            if (!hConfig) return null;
            const HIcon = hConfig.icon;
            const hTime = h.updatedAt
              ? new Date(h.updatedAt).toLocaleString("en-US", {
                  timeZone: tz,
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })
              : "";
            return (
              <div key={i} className="flex items-center gap-1.5">
                <HIcon className={cn("h-3 w-3 shrink-0", hConfig.color)} />
                <span className="font-medium text-white">{hConfig.label}</span>
                {hTime && <span className="text-white/70">— {hTime}</span>}
              </div>
            );
          })
        ) : (
          <div className="flex items-center gap-1.5">
            <Icon className={cn("h-3 w-3 shrink-0", config.color)} />
            <span className="font-medium text-white">{config.label}</span>
            {timeAgo && <span className="text-white/70">— {timeAgo}</span>}
          </div>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

/** Pulsing LIVE indicator for real-time monitoring */
export function LiveIndicator() {
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
      <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">Live</span>
    </div>
  );
}
