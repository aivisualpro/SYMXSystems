"use client";

import { cn } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";

export default function DispatchingTabPlaceholder({
    label,
    description,
    icon: Icon,
    gradient,
}: {
    label: string;
    description: string;
    icon: LucideIcon;
    gradient: string;
}) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center px-4">
            {/* Animated Icon */}
            <div className="relative mb-6">
                <div
                    className={cn(
                        "absolute inset-0 rounded-3xl blur-2xl opacity-20 animate-pulse",
                        `bg-gradient-to-br ${gradient}`
                    )}
                />
                <div
                    className={cn(
                        "relative w-20 h-20 sm:w-24 sm:h-24 rounded-3xl flex items-center justify-center",
                        `bg-gradient-to-br ${gradient}`
                    )}
                >
                    <Icon className="h-10 w-10 sm:h-12 sm:w-12 text-white" />
                </div>
            </div>

            {/* Content */}
            <h2 className="text-xl sm:text-2xl font-bold mb-2">{label}</h2>
            <p className="text-sm text-muted-foreground max-w-md mb-6">
                {description}
            </p>

            {/* Status Pill */}
            <div
                className={cn(
                    "inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold",
                    "bg-muted/50 border border-border text-muted-foreground"
                )}
            >
                <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                </span>
                Coming Soon — Content will be added here
            </div>
        </div>
    );
}
