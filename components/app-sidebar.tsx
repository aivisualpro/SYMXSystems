"use client";

import * as React from "react";
import Image from "next/image";
import {
  IconCamera,
  IconChartBar,
  IconDashboard,
  IconDatabase,
  IconFileAi,
  IconFileDescription,
  IconFileWord,
  IconFolder,
  IconHelp,
  IconInnerShadowTop,
  IconListDetails,
  IconReport,
  IconSearch,
  IconSettings,
  IconUsers,
  IconUser,
  IconBuildingStore,
  IconTruck,
  IconPackage,
  IconBuildingWarehouse,
  IconShoppingCart,
  IconClipboardList,
  IconCheckbox,
  IconRoute,
  IconBell,
} from "@tabler/icons-react";

import { NavDocuments } from "@/components/nav-documents";
import { NavMain } from "@/components/nav-main";
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
    name: "shadcn",
    email: "m@example.com",
    avatar: "/icon.png",
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
      name: "Customers",
      url: "/admin/customers",
      icon: IconBuildingStore,
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

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [reports, setReports] = React.useState(data.reports);

  React.useEffect(() => {
    const fetchCount = async () => {
      try {
        const res = await fetch('/api/admin/live-shipments/count');
        if (res.ok) {
          const { count } = await res.json();
          if (count > 0) {
            setReports(prev => prev.map(item => 
              item.name === "Live Shipments" 
                ? { ...item, badge: count } 
                : item
            ));
          }
        }
      } catch (error) {
        console.error("Failed to fetch notification count", error);
      }
    };
    
    fetchCount();
  }, []);

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
              <a href="/admin/customers" className="flex items-center justify-center p-2 group-data-[collapsible=icon]:p-0">
                <Image
                  src="/sidebar-logo.png"
                  alt="Company Logo"
                  width={150}
                  height={50}
                  className="object-contain w-auto h-8 group-data-[collapsible=icon]:hidden"
                  priority
                />
                 <Image
                  src="/sidebar-logo.png"
                  alt="Company Logo"
                  width={40}
                  height={40}
                  className="object-contain w-8 h-8 hidden group-data-[collapsible=icon]:block"
                  priority
                />
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavDocuments items={data.admin} label="Admin" />
        <NavDocuments items={data.inventory} label="Inventory" />
        <NavDocuments items={data.management} label="Management" />
        <NavDocuments items={reports} label="Reports" />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  );
}
