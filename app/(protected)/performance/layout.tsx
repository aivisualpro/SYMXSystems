"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { MessageSquareWarning, TrendingUp } from "lucide-react";

const TABS = [
    { href: "/performance/cdf", label: "Customer feedback", icon: MessageSquareWarning, hint: "Daily queue to discuss with drivers" },
    { href: "/performance/trends", label: "Driver trends", icon: TrendingUp, hint: "How often, and improving?" },
];

export default function PerformanceLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    return (
        <div className="flex h-full flex-col gap-4 p-4">
            <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold">Performance</h1>
                <div className="inline-flex rounded-xl border border-border/50 bg-card p-1">
                    {TABS.map((t) => {
                        const active = pathname.startsWith(t.href);
                        return (
                            <Link key={t.href} href={t.href} title={t.hint}
                                className={cn("flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition", active ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground")}>
                                <t.icon className="h-4 w-4" />{t.label}
                            </Link>
                        );
                    })}
                </div>
            </div>
            <div className="min-h-0 flex-1">{children}</div>
        </div>
    );
}
