"use client";

import React, { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import { useEffect } from "react";
import {
  IconLayoutDashboard,
  IconUsers,
  IconReceipt2,
  IconReportAnalytics,
  IconFileSearch,
  IconTicket,
  IconClock,
  IconUserSearch,
  IconUserPlus,
  IconUserCheck,
  IconShirt,
  IconUserOff,
} from "@tabler/icons-react";

// ── Tabs config ───────────────────────────────────────────────────────
const tabs = [
  { id: "dashboard", label: "Dashboard", icon: IconLayoutDashboard, href: "/hr" },
  { id: "employees", label: "Employees", icon: IconUsers, href: "/hr/employees" },
  { id: "reimbursement", label: "Reimbursement", icon: IconReceipt2, href: "/hr/reimbursement" },
  { id: "incidents", label: "Incidents", icon: IconReportAnalytics, href: "/hr/incidents" },
  { id: "audit", label: "Employee Audit", icon: IconFileSearch, href: "/hr/audit" },
  { id: "tickets", label: "HR Tickets", icon: IconTicket, href: "/hr/tickets" },
  { id: "timesheet", label: "Timesheet", icon: IconClock, href: "/hr/timesheet" },
  { id: "interviews", label: "Interviews", icon: IconUserSearch, href: "/hr/interviews" },
  { id: "onboarding", label: "Onboarding", icon: IconUserPlus, href: "/hr/onboarding" },
  { id: "hired", label: "Hired", icon: IconUserCheck, href: "/hr/hired" },
  { id: "uniforms", label: "Uniforms", icon: IconShirt, href: "/hr/uniforms" },
  { id: "terminations", label: "Terminations", icon: IconUserOff, href: "/hr/terminations" },
];

// ── Layout ────────────────────────────────────────────────────────────
export default function HRLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { setLeftContent, setRightContent } = useHeaderActions();

  // Push title into header
  useEffect(() => {
    // Don't override header for employee detail pages
    if (pathname.match(/^\/hr\/[a-f0-9]{24}$/i)) return;

    setLeftContent(
      <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
        HR
      </h1>
    );

    return () => {
      setLeftContent(null);
      setRightContent(null);
    };
  }, [pathname, setLeftContent, setRightContent]);

  // Determine active tab from pathname (deferred to avoid hydration mismatch)
  const [activeTab, setActiveTab] = React.useState<string>("");
  useEffect(() => {
    if (pathname.match(/^\/hr\/[a-f0-9]{24}/i)) { setActiveTab("employees"); return; }
    if (pathname === "/hr") { setActiveTab("dashboard"); return; }
    const seg = pathname.replace("/hr/", "").split("/")[0];
    setActiveTab(seg || "dashboard");
  }, [pathname]);

  // Don't show tabs on detail pages
  const isDetailPage = pathname.match(/^\/hr\/[a-f0-9]{24}/i);

  return (
    <div className="flex flex-col h-full space-y-4 max-w-[1600px] w-full mx-auto" suppressHydrationWarning>
      {/* ── Tab Navigation ─────────────────────────────────────── */}
      {!isDetailPage && (
        <div className="shrink-0 sticky top-0 z-20 -mx-[16px] px-[16px] pt-0 pb-2 bg-background/80 backdrop-blur-md">
          <div data-tab-nav className="flex items-center gap-1 p-1 rounded-xl bg-muted/50 border border-border overflow-x-auto">
            {tabs.map((tab) => (
              <Link
                key={tab.id}
                href={tab.href}
                prefetch={true}
                className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200 select-none ${activeTab === tab.id
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
              >
                <tab.icon size={14} />
                {tab.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Page Content ────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 pb-2">
        {children}
      </div>
    </div>
  );
}
