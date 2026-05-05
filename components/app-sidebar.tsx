"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  IconBell,
  IconBriefcase,

  IconDashboard,
  IconSearch,
  IconSettings,
  IconUser,
  IconUsers,
  IconCrown,
  IconTruckDelivery,
  IconCalendarTime,
  IconCalendarEvent,
  IconCar,
  IconUsersGroup,
  IconAlertTriangle,
  IconShield,
  IconTie,
  IconChartBar,
  IconTarget,
  IconRoute,
} from "@tabler/icons-react";

import { NavDocuments } from "@/components/nav-documents";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// ── Icon Map: resolves DB string names to actual icon components ────────
const ICON_MAP: Record<string, any> = {
  IconDashboard,
  IconCrown,
  IconTruckDelivery,
  IconCalendarTime,
  IconCalendarEvent,
  IconCar,
  IconUsersGroup,
  IconAlertTriangle,
  IconShield,
  IconTie,
  IconChartBar,
  IconTarget,
  IconBell,
  IconSettings,
  IconSearch,
  IconBriefcase,
  IconUser,
  IconUsers,
  IconRoute,
};

const data = {
  user: {
    name: "",
    email: "",
    avatar: "",
  },
  navSecondary: [
    {
      title: "Notifications",
      url: "/admin/notifications",
      icon: IconBell,
    },
    {
      title: "Settings",
      url: "/admin/settings",
      icon: IconSettings,
    },
  ],
  // Hardcoded fallback — used only when the API hasn't responded yet
  admin: [
    {
      name: "Dashboard",
      url: "/dashboard",
      icon: IconDashboard,
    },
    {
      name: "Owner",
      url: "/owner",
      icon: IconCrown,
      subModules: [
        { name: "App Users", url: "/owner/app-users" },
        { name: "Roles & Permissions", url: "/owner/roles" },
      ]
    },
    {
      name: "Dispatching",
      url: "/dispatching",
      icon: IconRoute,
      subModules: [
        { name: "Roster", url: "/dispatching/roster" },
        { name: "Opening", url: "/dispatching/opening" },
        { name: "Attendance", url: "/dispatching/attendance" },
        { name: "Repairs", url: "/dispatching/repairs" },
        { name: "Time", url: "/dispatching/time" },
        { name: "Closing", url: "/dispatching/closing" },
        { name: "Efficiency", url: "/dispatching/efficiency" },
        { name: "Routes", url: "/dispatching/routes" },
      ],
    },
    {
      name: "Scheduling",
      url: "/scheduling",
      icon: IconCalendarTime,
      subModules: [
        { name: "KPI", url: "/scheduling" },
        { name: "Messaging", url: "/scheduling/messaging" },
      ],
    },
    {
      name: "Everyday",
      url: "/everyday",
      icon: IconCalendarEvent,
      subModules: []
    },
    {
      name: "Load Out",
      url: "/load-out",
      icon: IconTruckDelivery,
      subModules: []
    },
    {
      name: "Fleet",
      url: "/fleet",
      icon: IconCar,
      subModules: [
        { name: "Overview", url: "/fleet" },
        { name: "Vehicles", url: "/fleet/vehicles" },
        { name: "Repairs", url: "/fleet/repairs" },
        { name: "Inspections", url: "/fleet/inspections" },
        { name: "Rental Agreements", url: "/fleet/rentals" },
      ]
    },
    {
      name: "HR",
      url: "/hr",
      icon: IconUsersGroup,
      subModules: [
        { name: "Employees", url: "/hr/employees" },
        { name: "Reimbursement", url: "/hr/reimbursement" },
        { name: "Incidents", url: "/hr/incidents" },
        { name: "Employee Audit", url: "/hr/audit" },
        { name: "HR Tickets", url: "/hr/tickets" },
        { name: "Timesheet", url: "/hr/timesheet" },
        { name: "Interviews", url: "/hr/interviews" },
        { name: "Onboarding", url: "/hr/onboarding" },
        { name: "Hired", url: "/hr/hired" },
        { name: "Uniforms", url: "/hr/uniforms" },
        { name: "Terminations", url: "/hr/terminations" },
      ]
    },
    {
      name: "Scorecard",
      url: "/scorecard",
      icon: IconTarget,
      subModules: []
    },
  ],
};

// Global cache for sidebar data to prevent refetching on navigation
export let sidebarCache: {
  permissions: any[];
  isAdmin: boolean;
  dynamicModules: any[] | null;
  timestamp: number;
} | null = null;

const CACHE_DURATION = 1 * 60 * 1000; // 1 minute

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [permissions, setPermissions] = React.useState<any[]>([]);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [loadingPermissions, setLoadingPermissions] = React.useState(true);
  const [dynamicModules, setDynamicModules] = React.useState<any[] | null>(null);
  const router = useRouter();

  React.useEffect(() => {
    const fetchData = async () => {
      // Check cache first
      const now = Date.now();
      if (sidebarCache && (now - sidebarCache.timestamp) < CACHE_DURATION) {
        setPermissions(sidebarCache.permissions);
        setIsAdmin(sidebarCache.isAdmin);
        if (sidebarCache.dynamicModules) setDynamicModules(sidebarCache.dynamicModules);
        setLoadingPermissions(false);
        return;
      }

      try {
        let fetchedPermissions: any[] = [];
        let fetchedIsAdmin = false;
        let fetchedModules: any[] | null = null;

        // Fetch User Permissions + Dynamic Modules in parallel
        const [permRes, modulesRes] = await Promise.all([
          fetch('/api/user/permissions'),
          fetch('/api/admin/modules'),
        ]);

        if (permRes.ok) {
          const data = await permRes.json();
          fetchedPermissions = data.permissions || [];
          setPermissions(fetchedPermissions);

          if (data.role === 'Super Admin') {
            fetchedIsAdmin = true;
            setIsAdmin(true);
          }
        }

        if (modulesRes.ok) {
          const modulesData = await modulesRes.json();
          if (modulesData.modules?.length > 0) {
            // Map DB modules to sidebar format, resolving icon strings to components
            fetchedModules = modulesData.modules.map((m: any) => ({
              name: m.name,
              url: m.url || "#",
              icon: m.name === "Everyday" ? ICON_MAP["IconCalendarEvent"] : (ICON_MAP[m.icon] || IconDashboard),
              subModules: (m.subModules || []).map((sm: any) => ({
                name: sm.name,
                url: sm.url || "#",
              })),
            }));
            setDynamicModules(fetchedModules);
          }
        }

        // Update cache
        sidebarCache = {
          permissions: fetchedPermissions,
          isAdmin: fetchedIsAdmin,
          dynamicModules: fetchedModules,
          timestamp: Date.now(),
        };
      } catch (error) {
        console.error("Failed to fetch sidebar data", error);
      } finally {
        setLoadingPermissions(false);
      }
    };

    fetchData();
  }, []);

  // Use dynamic modules from DB if available, otherwise fall back to hardcoded
  const adminItems = dynamicModules || data.admin;

  const filterItems = (items: any[], type: 'admin' | 'secondary') => {
    if (loadingPermissions) return [];

    // Filter by permissions: a module is hidden ONLY if explicitly set to view: false.
    // If a module is not in the permissions array at all, it's treated as allowed
    // (matching the roles editor UI which defaults missing modules to all-true).
    const permFiltered = isAdmin ? items : items.filter(item => {
      const itemName = item.name || item.title;

      const perm = permissions.find((p: any) => p.module === itemName);
      if (perm) {
        return perm.actions?.view !== false;
      }
      // Not in permissions array → allowed (matches roles UI default behavior)
      return true;
    });

    return permFiltered;
  };

  const filteredAdmin = filterItems(adminItems, 'admin');
  const filteredSecondary = data.navSecondary.filter(item => {
    if (isAdmin) return true;
    const perm = permissions.find((p: any) => p.module === item.title);
    if (perm) return perm.actions?.view !== false;
    return true; // not in permissions → allowed
  });



  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-0 hover:bg-transparent active:bg-transparent"
              size="lg"
              tooltip="Symx Systems Dashboard"
            >
              <Link href="/dashboard" className="flex items-center gap-3 p-2 group-data-[collapsible=icon]:justify-center overflow-hidden">
                {/* Animated Icon Wrapper */}
                <div className="relative flex-shrink-0 flex items-center justify-center">
                  <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full animate-pulse-slow" />
                  <Image
                    src="/sidebar-icon.png"
                    alt="SYMX"
                    width={40}
                    height={40}
                    className="relative object-contain w-9 h-9 transition-transform duration-700 ease-in-out hover:rotate-[360deg] hover:scale-110"
                    priority
                  />
                </div>

                {/* Text Label - Hidden in collapsed mode */}
                <div className="flex flex-col group-data-[collapsible=icon]:hidden opacity-100 group-data-[collapsible=icon]:opacity-0 transition-opacity duration-300">
                  <span className="font-bold text-base tracking-wide text-foreground leading-none">SYMX</span>
                  <span className="text-[10px] font-medium text-muted-foreground tracking-wider uppercase leading-none mt-1">Systems</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

      </SidebarHeader>
      <SidebarContent>
        {filteredAdmin.length > 0 && <NavDocuments items={filteredAdmin} />}
        {filteredSecondary.length > 0 && <NavSecondary items={filteredSecondary as any} className="mt-auto" />}
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center gap-1.5 px-3 py-1 group-data-[collapsible=icon]:hidden">
          <IconDashboard className="h-4 w-4 text-muted-foreground/60" />
          <span className="text-xs font-semibold text-muted-foreground">Version: 1.31</span>
        </div>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  );
}
