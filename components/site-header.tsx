"use client";

import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeSelector } from "./theme-selector";
import { ModeSwitcher } from "./mode-switcher";
import { useHeaderActions } from "@/components/providers/header-actions-provider";

export function SiteHeader() {
  const pathname = usePathname();
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
    const segments = path.split("/").filter(Boolean);
    const lastSegment = segments[segments.length - 1];
    if (!lastSegment) return "Dashboard";
    
    // Capitalize first letter and handle special cases if needed
    return lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1);
  };

  const title = getTitle(pathname);

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        {headerCtx.leftContent ? (
          headerCtx.leftContent
        ) : (
          <h1 className="text-base font-medium">{title}</h1>
        )}
        <div className="ml-auto flex items-center gap-2">
          {headerCtx.rightContent || headerCtx.actions}
          <ThemeSelector />
          <ModeSwitcher />
        </div>
      </div>
    </header>
  );
}
