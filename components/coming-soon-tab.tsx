"use client";

import { cn } from "@/lib/utils";

interface ComingSoonProps {
  title: string;
  description?: string;
  icon: React.ElementType;
  accentColor?: string;
}

export function ComingSoonTab({ title, description, icon: Icon, accentColor = "from-primary to-primary/60" }: ComingSoonProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="relative mb-6">
        <div className={cn(
          "absolute inset-0 rounded-3xl blur-2xl opacity-20 bg-gradient-to-br",
          accentColor
        )} />
        <div className="relative h-20 w-20 rounded-3xl bg-muted/50 border border-border flex items-center justify-center backdrop-blur-sm">
          <Icon className="h-10 w-10 text-muted-foreground/50" />
        </div>
      </div>
      <h2 className="text-xl font-bold tracking-tight mb-2">{title}</h2>
      <p className="text-sm text-muted-foreground max-w-md text-center leading-relaxed">
        {description || `The ${title} module is currently under development. Check back soon for updates.`}
      </p>
      <div className="mt-6 flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 border border-primary/10">
        <div className="h-2 w-2 rounded-full bg-primary/40 animate-pulse" />
        <span className="text-xs font-semibold text-primary/70 uppercase tracking-wider">Coming Soon</span>
      </div>
    </div>
  );
}
