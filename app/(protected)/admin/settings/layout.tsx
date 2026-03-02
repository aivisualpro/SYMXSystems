"use client";

import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Settings, Shield, Upload } from "lucide-react";

interface SettingsLayoutProps {
  children: React.ReactNode;
}

const tabs = [
  {
    title: "General",
    href: "/admin/settings/general",
    icon: Settings,
  },
  {
    title: "Roles & Permissions",
    href: "/admin/settings/roles",
    icon: Shield,
  },
  {
    title: "Imports",
    href: "/admin/settings/imports",
    icon: Upload,
  },
];

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-border/50 px-1 pb-0">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <button
              key={tab.href}
              onClick={() => router.push(tab.href)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all relative",
                isActive
                  ? "text-primary bg-primary/5"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.title}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 pt-4 overflow-auto">
        {children}
      </div>
    </div>
  );
}
