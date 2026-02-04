"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconDots,
  IconFolder,
  IconShare3,
  IconTrash,
  type Icon,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuBadge,
  useSidebar,
} from "@/components/ui/sidebar";

export function NavDocuments({
  items,
  label,
}: {
  items: {
    name: string;
    url: string;
    icon: Icon;
    badge?: number | string;
  }[];
  label: string;
}) {
  const { isMobile } = useSidebar();
  const pathname = usePathname();

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.name}>
            <SidebarMenuButton 
              asChild 
              isActive={pathname.startsWith(item.url)}
              tooltip={item.name}
            >
              <Link href={item.url}>
                <item.icon />
                <span>{item.name}</span>
              </Link>
            </SidebarMenuButton>
            {item.badge !== undefined && (
              <SidebarMenuBadge 
                className={cn(
                  "rounded-full px-1.5 min-w-5 h-5 flex items-center justify-center",
                  pathname.startsWith(item.url) 
                    ? "bg-white text-primary font-bold" 
                    : "bg-muted text-muted-foreground"
                )}
              >
                {item.badge}
              </SidebarMenuBadge>
            )}
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
