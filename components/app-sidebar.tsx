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
  navMain: [
    {
      title: "Dashboard",
      url: "#",
      icon: IconDashboard,
    },
  ],
  navSecondary: [
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
    {
      name: "Products",
      url: "/admin/products",
      icon: IconPackage,
    },
    {
      name: "Warehouse",
      url: "/admin/warehouse",
      icon: IconBuildingWarehouse,
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
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-0 hover:bg-transparent active:bg-transparent"
              size="lg"
            >
              <a href="#" className="flex items-center justify-center p-2">
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
        <NavMain items={data.navMain} />
        <NavDocuments items={data.admin} label="Admin" />
        <NavDocuments items={data.management} label="Management" />
        <NavDocuments items={data.reports} label="Reports" />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  );
}
