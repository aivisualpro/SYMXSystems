"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, FileText, ShieldAlert, Scale, BookOpen, Lock } from "lucide-react";

const TABS = [
    { href: "/payments", label: "Overview", icon: LayoutDashboard, exact: true, hint: "Money at a glance" },
    { href: "/payments/invoices", label: "Invoices", icon: FileText, hint: "Review, accept or dispute" },
    { href: "/payments/audit", label: "Audit", icon: ShieldAlert, hint: "Possible billing mistakes" },
    { href: "/payments/disputes", label: "Disputes", icon: Scale, hint: "What you filed and recovered" },
    { href: "/payments/guide", label: "How it works", icon: BookOpen, hint: "Rules, deadlines and your routine" },
];

export default function PaymentsShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    return (
        <div className="flex h-full flex-col gap-4 p-4">
            <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold">Payments</h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground" title="Only the Super Admin account can see this section">
                    <Lock className="h-3 w-3" /> Super Admin only
                </span>
                <div className="inline-flex rounded-xl border border-border/50 bg-card p-1">
                    {TABS.map((t) => {
                        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
                        return (
                            <Link key={t.href} href={t.href} title={t.hint}
                                className={cn("flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition", active ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground")}>
                                <t.icon className="h-4 w-4" />{t.label}
                            </Link>
                        );
                    })}
                </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </div>
    );
}
