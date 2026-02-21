"use client";

import React, { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
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
  { id: "claims", label: "Claims Dashboard", icon: IconReportAnalytics, href: "/hr/claims" },
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

  // Determine active tab from pathname
  const activeTab = (() => {
    if (pathname.match(/^\/hr\/[a-f0-9]{24}/i)) return "employees";
    if (pathname === "/hr") return "dashboard";
    const seg = pathname.replace("/hr/", "").split("/")[0];
    return seg || "dashboard";
  })();

  // Don't show tabs on detail pages
  const isDetailPage = pathname.match(/^\/hr\/[a-f0-9]{24}/i);

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto">
      {/* ── Tab Navigation ─────────────────────────────────────── */}
      {!isDetailPage && (
        <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/50 border border-border overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => router.push(tab.href)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200 ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Page Content ────────────────────────────────────────── */}
      {children}
    </div>
  );
}
