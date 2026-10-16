export const money = (n: number | null | undefined, cents = false) =>
    n === null || n === undefined ? "—" : (n < 0 ? "-" : "") + "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });

export const TYPE_LABEL: Record<string, { label: string; blurb: string; color: string }> = {
    SERVICE_PROVIDED: { label: "Weekly variable", blurb: "Routes worked + per-package pay, billed weekly", color: "bg-blue-500/15 text-blue-400" },
    VEHICLE_PAYMENT_V2: { label: "Monthly fleet", blurb: "Per-vehicle payment: prepaid month + last month's true-up", color: "bg-violet-500/15 text-violet-400" },
    VEHICLE_PAYMENT: { label: "Monthly fleet", blurb: "Per-vehicle payment", color: "bg-violet-500/15 text-violet-400" },
    INCENTIVE_PAYMENT: { label: "Incentive", blurb: "Amazon-funded bonus — must be passed on to drivers", color: "bg-emerald-500/15 text-emerald-400" },
    PROMOTION: { label: "Promotion", blurb: "Amazon-funded promotion — pass on to drivers if required", color: "bg-emerald-500/15 text-emerald-400" },
    ASSET_PAYMENT: { label: "Other / asset", blurb: "Miscellaneous payment (e.g. benefits support)", color: "bg-slate-500/15 text-slate-400" },
};
export const typeInfo = (t: string) => TYPE_LABEL[t] || { label: t || "Other", blurb: "", color: "bg-slate-500/15 text-slate-400" };

export const MY_STATUS: Record<string, { label: string; color: string; hint: string }> = {
    to_review: { label: "To review", color: "bg-slate-500/15 text-slate-300", hint: "Nobody has looked at this yet" },
    reviewing: { label: "Reviewing", color: "bg-amber-500/15 text-amber-400", hint: "You're working through the checklist" },
    ready_to_accept: { label: "Ready to accept", color: "bg-sky-500/15 text-sky-400", hint: "Checks done, nothing to dispute — accept it in Amazon" },
    disputed: { label: "Disputed", color: "bg-red-500/15 text-red-400", hint: "A dispute was filed — wait for the adjustment invoice" },
    accepted: { label: "Accepted", color: "bg-emerald-500/15 text-emerald-400", hint: "Done" },
};

export function timeLeft(h: number | null | undefined) {
    if (h === null || h === undefined) return { text: "—", cls: "text-muted-foreground" };
    if (h <= 0) return { text: "Window closed", cls: "text-muted-foreground" };
    const text = h >= 48 ? `${Math.floor(h / 24)}d ${h % 24}h left` : `${h}h left`;
    return { text, cls: h < 24 ? "text-red-400 font-semibold" : h < 72 ? "text-amber-400 font-semibold" : "text-foreground" };
}

export const fmtDay = (d: string) => (d ? new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }) : "");

export const AMAZON_INVOICE_URL = (batchId: string) => `https://logistics.amazon.com/flexpayments/simpson/flexpro/invoices/${batchId}`;

export const KIND_LABEL: Record<string, string> = {
    route_count: "Route count", rescue_unbilled: "Rescue", upd_candidate: "Late-departure pay", package_count: "Package count", pickup_count: "Pickups", rate_change: "Rate change",
};
