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
  IconSun,
  IconCar,
  IconUsersGroup,
  IconAlertTriangle,
  IconShield,
  IconTie,
  IconChartBar,
  IconTarget,
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
  IconSun,
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
    {
      title: "Search",
      url: "#",
      icon: IconSearch,
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
      ]
    },
    {
      name: "Scheduling",
      url: "/scheduling",
      icon: IconCalendarTime,
      subModules: [
        { name: "Schedule", url: "#" },
        { name: "Confirm Schedules", url: "#" },
        { name: "Work Hour Compliance", url: "#" },
        { name: "Capacity Planning", url: "#" },
        { name: "Availability", url: "#" },
        { name: "Schedule Check", url: "#" },
      ],
    },
    {
      name: "HR",
      url: "/hr",
      icon: IconUsersGroup,
      subModules: [
        { name: "Employees", url: "/hr/employees" }
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
let sidebarCache: {
  permissions: any[];
  isAdmin: boolean;
  dynamicModules: any[] | null;
  timestamp: number;
} | null = null;

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [permissions, setPermissions] = React.useState<any[]>([]);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [loadingPermissions, setLoadingPermissions] = React.useState(true);
  const [dynamicModules, setDynamicModules] = React.useState<any[] | null>(null);
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const router = useRouter();

  const handleSearchClick = (e?: React.MouseEvent) => {
    e?.preventDefault();
    setIsSearchOpen(true);
  };

  // Keyboard shortcut for search
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsSearchOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

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
              icon: ICON_MAP[m.icon] || IconDashboard,
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
    
    // First, filter by permissions
    const permFiltered = isAdmin ? items : items.filter(item => {
      const itemName = item.name || item.title;
      if (itemName === "Dashboard" || type === 'secondary') return true; 

      const perm = permissions.find((p: any) => p.module === itemName);
      if (perm) {
        return perm.actions?.view === true;
      }
      return true; 
    });

    // Then, filter by search query (including sub-modules)
    if (!searchQuery) return permFiltered;

    const lowerQuery = searchQuery.toLowerCase();
    
    // For search results, we might want to return a slightly different structure or just the parents
    return permFiltered.reduce((acc: any[], item) => {
      const name = (item.name || item.title || "").toLowerCase();
      const subModules = (item.subModules || []) as any[];
      const matchingSubs = subModules.filter((sm: any) => 
        (typeof sm === 'string' ? sm : sm.name).toLowerCase().includes(lowerQuery)
      );
      
      if (name.includes(lowerQuery) || matchingSubs.length > 0) {
        const bestMatch = matchingSubs.length > 0 ? matchingSubs[0] : null;
        const subName = bestMatch ? (typeof bestMatch === 'string' ? bestMatch : bestMatch.name) : null;
        const subUrl = bestMatch && typeof bestMatch === 'object' && bestMatch.url !== "#" ? bestMatch.url : null;

        acc.push({
          ...item,
          url: subUrl || item.url, // Override with sub-module URL if it's a valid route
          displayName: subName && !name.includes(lowerQuery) 
            ? `${item.name} (${subName})` 
            : item.name || item.title
        });
      }
      return acc;
    }, []);
  };

  const filteredAdmin = filterItems(adminItems, 'admin');
  // Secondary nav usually stays visible or matches its own titles
  const filteredSecondary = data.navSecondary.map(item => 
    item.title === "Search" ? { ...item, onClick: handleSearchClick } : item
  );

  // Flattened list for the search dialog
  const allSearchableItems = React.useMemo(() => {
    const items: any[] = [];
    adminItems.forEach(item => {
      // Add parent
      items.push({ name: item.name, url: item.url, icon: item.icon, type: 'Module' });
      // Add sub-modules
      if (item.subModules) {
        item.subModules.forEach((sm: any) => {
          items.push({ 
            name: typeof sm === 'string' ? sm : sm.name, 
            url: (typeof sm === 'string' ? "#" : sm.url) || "#", 
            icon: item.icon,
            parentName: item.name,
            type: 'Feature'
          });
        });
      }
    });
    return items;
  }, [adminItems]);

  const searchResults = allSearchableItems.filter(item => {
    if (!searchQuery) return false;
    const lowerQuery = searchQuery.toLowerCase();
    return item.name.toLowerCase().includes(lowerQuery) || 
           (item.parentName && item.parentName.toLowerCase().includes(lowerQuery));
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
        {filteredAdmin.length > 0 && <NavDocuments items={filteredAdmin} />}
        {filteredSecondary.length > 0 && <NavSecondary items={filteredSecondary as any} className="mt-auto" />}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>

      {/* Premium Search Dialog */}
      <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
        <DialogContent className="sm:max-w-[550px] p-0 gap-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Search Modules</DialogTitle>
          </DialogHeader>
          <div className="flex items-center px-4 pr-12 py-3 border-b bg-muted/30">
            <IconSearch className="h-5 w-5 text-muted-foreground mr-3" />
            <input
              autoFocus
              placeholder="Search modules and features..."
              className="flex-1 bg-transparent border-none outline-none text-sm h-10 placeholder:text-muted-foreground/60"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="flex items-center gap-1.5 ml-2">
               <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                  <span className="text-xs">⌘</span>K
               </kbd>
            </div>
          </div>
          
          <ScrollArea className="max-h-[400px]">
            <div className="p-2">
              {searchQuery === "" ? (
                <div className="px-4 py-8 text-center text-muted-foreground/50">
                  <IconSearch className="h-10 w-10 mx-auto mb-2 opacity-10" />
                  <p className="text-xs">Start searching for modules, settings, or dashboard cards...</p>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="px-4 py-8 text-center text-muted-foreground/50">
                   <p className="text-xs">No results found for "{searchQuery}"</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {searchResults.map((item: any, idx: number) => (
                    <button
                      key={`${item.name}-${idx}`}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-primary/10 group transition-colors text-left"
                      onClick={() => {
                        if (item.url !== "#") {
                          router.push(item.url);
                          setIsSearchOpen(false);
                          setSearchQuery("");
                        }
                      }}
                    >
                      <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                         <item.icon size={18} />
                      </div>
                      <div className="flex-1 flex flex-col min-w-0">
                        <span className="text-sm font-medium leading-none">
                          {item.name}
                        </span>
                        {item.parentName && (
                          <span className="text-[10px] text-muted-foreground mt-1 truncate">
                            in {item.parentName}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] font-medium bg-muted px-2 py-0.5 rounded uppercase tracking-wider text-muted-foreground opacity-50">
                        {item.type}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
          
          <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-t text-[10px] text-muted-foreground">
             <div className="flex gap-3">
                <span className="flex items-center gap-1"><kbd className="bg-background border rounded px-1 group-hover:bg-muted">↑↓</kbd> to navigate</span>
                <span className="flex items-center gap-1"><kbd className="bg-background border rounded px-1 group-hover:bg-muted">↵</kbd> to select</span>
             </div>
             <span>SYMX Search</span>
          </div>
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}
