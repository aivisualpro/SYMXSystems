"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  IconBell,
  IconBriefcase,

  IconBuildingWarehouse,
  IconCheckbox,
  IconClipboardList,
  IconDashboard,
  IconFileDescription,
  IconListDetails,
  IconPackage,
  IconRoute,
  IconSearch,
  IconSettings,
  IconShoppingCart,
  IconTruck,
  IconUser,
  IconUsers,
} from "@tabler/icons-react";

import { NavDocuments } from "@/components/nav-documents";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

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
    {
      title: "Search",
      url: "#",
      icon: IconSearch,
    },
  ],
  admin: [
    {
      name: "Dashboard",
      url: "/dashboard",
      icon: IconDashboard,
    },
    {
      name: "Users",
      url: "/admin/users",
      icon: IconUser,
    },
    {
      name: "Employees",
      url: "/admin/employees",
      icon: IconUsers,
    },
    {
      name: "Suppliers",
      url: "/admin/suppliers",
      icon: IconTruck,
    },
  ],
  inventory: [
    {
      name: "Warehouse",
      url: "/inventory/warehouse",
      icon: IconBuildingWarehouse,
    },
    {
      name: "Categories",
      url: "/inventory/categories",
      icon: IconListDetails,
    },
    {
      name: "Products",
      url: "/inventory/products",
      icon: IconPackage,
    },
    {
      name: "Release Requests",
      url: "/inventory/release-requests",
      icon: IconFileDescription,
    },
  ],
  management: [
    {
      name: "Purchase Orders",
      url: "/admin/purchase-orders",
      icon: IconShoppingCart,
    },
    {
      name: "Quality Control",
      url: "/admin/quality-control",
      icon: IconCheckbox,
    },
  ],
  reports: [
    {
      name: "Andres Tracker",
      url: "/admin/andres-tracker",
      icon: IconClipboardList,
    },
    {
      name: "Live Shipments",
      url: "/admin/live-shipments",
      icon: IconRoute,
    },
  ],
};

// Global cache for sidebar data to prevent refetching on navigation
let sidebarCache: {
  permissions: any[];
  isAdmin: boolean;
  shipmentCount: number;
  timestamp: number;
} | null = null;

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [reports, setReports] = React.useState(data.reports);
  const [permissions, setPermissions] = React.useState<any[]>([]);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [loadingPermissions, setLoadingPermissions] = React.useState(true);

  React.useEffect(() => {
    const fetchData = async () => {
      // Check cache first
      const now = Date.now();
      if (sidebarCache && (now - sidebarCache.timestamp) < CACHE_DURATION) {
        setPermissions(sidebarCache.permissions);
        setIsAdmin(sidebarCache.isAdmin);
        if (sidebarCache.shipmentCount > 0) {
          setReports(prev => prev.map(item => 
            item.name === "Live Shipments" 
              ? { ...item, badge: sidebarCache!.shipmentCount } 
              : item
          ));
        }
        setLoadingPermissions(false);
        return;
      }

      try {
        let shipmentCount = 0;
        let fetchedPermissions: any[] = [];
        let fetchedIsAdmin = false;

        // Fetch Live Shipments Count
        const countRes = await fetch('/api/admin/live-shipments/count');
        if (countRes.ok) {
          const { count } = await countRes.json();
          shipmentCount = count;
          if (count > 0) {
            setReports(prev => prev.map(item => 
              item.name === "Live Shipments" 
                ? { ...item, badge: count } 
                : item
            ));
          }
        }

        // Fetch User Permissions
        const permRes = await fetch('/api/user/permissions');
        if (permRes.ok) {
          const data = await permRes.json();
          fetchedPermissions = data.permissions || [];
          setPermissions(fetchedPermissions);
          
          if (data.role === 'Super Admin') {
            fetchedIsAdmin = true;
            setIsAdmin(true);
          }
        }

        // Update cache
        sidebarCache = {
          permissions: fetchedPermissions,
          isAdmin: fetchedIsAdmin,
          shipmentCount,
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

  const filterItems = (items: any[]) => {
    if (loadingPermissions) return []; // Show nothing while loading to prevent flash
    if (isAdmin) return items; // Super Admin sees all

    return items.filter(item => {
      const itemName = item.name || item.title;
      // Dashboard usually allowed for everyone, or check specific permission
      if (itemName === "Dashboard") return true; 

      const perm = permissions.find((p: any) => p.module === itemName);
      // If permission entry exists, check view action.
      if (perm) {
        return perm.actions?.view === true;
      }
      
      // Fallback: If no permission record exists for this module, what to do?
      // Legacy behavior: Visible if not restricted.
      return true; 
    });
  };

  const filteredAdmin = filterItems(data.admin);
  const filteredInventory = filterItems(data.inventory);
  const filteredManagement = filterItems(data.management);
  const filteredReports = filterItems(reports);
  const filteredSecondary = filterItems(data.navSecondary);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-0 hover:bg-transparent active:bg-transparent"
              size="lg"
              tooltip="Treetop Dashboard"
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
        {filteredAdmin.length > 0 && <NavDocuments items={filteredAdmin} label="Admin" />}
        {filteredInventory.length > 0 && <NavDocuments items={filteredInventory} label="Inventory" />}
        {filteredManagement.length > 0 && <NavDocuments items={filteredManagement} label="Management" />}
        {filteredReports.length > 0 && <NavDocuments items={filteredReports} label="Reports" />}
        {filteredSecondary.length > 0 && <NavSecondary items={filteredSecondary} className="mt-auto" />}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  );
}
