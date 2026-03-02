"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

import { ModeSwitcher } from "./mode-switcher";
import { useHeaderActions } from "@/components/providers/header-actions-provider";

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();

  const segments = pathname.split("/").filter(Boolean);
  const showBackButton = pathname !== "/dashboard" && segments.length > 0;

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Safe consumption of context to avoid crashing if provider is missing
  let headerCtx: {
    actions: import("react").ReactNode;
    leftContent: import("react").ReactNode;
    rightContent: import("react").ReactNode;
  } = {
    actions: null,
    leftContent: null,
    rightContent: null,
  };

  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const context = useHeaderActions();
    headerCtx = {
      actions: context.actions,
      leftContent: context.leftContent,
      rightContent: context.rightContent,
    };
  } catch (e) {
    // Provider missing
  }

  const getTitle = (path: string) => {
    if (path === "/dashboard") return "Dashboard";
    if (path.includes("andres-tracker")) return "Andres Tracker";

    // Fleet sub-routes: show "Fleet – SubPage"
    if (path.startsWith("/fleet")) {
      const fleetSegments = path.replace("/fleet", "").split("/").filter(Boolean);
      const subPage = fleetSegments[0] || "Overview";
      const formatted = subPage.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      return `Fleet – ${formatted}`;
    }

    const segments = path.split("/").filter(Boolean);
    const lastSegment = segments[segments.length - 1];
    if (!lastSegment) return "Dashboard";

    // Convert hyphens/underscores to spaces and capitalize
    return lastSegment
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  const title = getTitle(pathname);

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-3 sm:px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1 flex-shrink-0" />
        <Separator
          orientation="vertical"
          className="mx-1 sm:mx-2 data-[orientation=vertical]:h-4"
        />

        {showBackButton && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-foreground flex-shrink-0"
            onClick={() => router.back()}
          >
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
        )}

        {mounted && headerCtx.leftContent ? (
          <div className="min-w-0 flex-1 truncate">
            {headerCtx.leftContent}
          </div>
        ) : (
          <h1 className="text-sm sm:text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent truncate min-w-0">
            {title}
          </h1>
        )}

        <div className="ml-auto flex items-center gap-1 sm:gap-2 flex-shrink-0">
          {mounted && (headerCtx.rightContent || headerCtx.actions)}

          <ModeSwitcher />
        </div>
      </div>
    </header>
  );
}
