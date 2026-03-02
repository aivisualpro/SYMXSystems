import * as React from "react"
import { useState, useEffect } from "react"
import {
  IconDotsVertical,
  IconLogout,
  IconUserCircle,
  IconPalette,
} from "@tabler/icons-react"

import { useRouter } from "next/navigation"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

import { Skeleton } from "@/components/ui/skeleton"
import { useThemeConfig } from "@/components/active-theme"

const THEMES = [
  { name: "Default", value: "default", color: "bg-zinc-400" },
  { name: "Blue", value: "blue", color: "bg-blue-500" },
  { name: "Green", value: "green", color: "bg-emerald-500" },
  { name: "Amber", value: "amber", color: "bg-amber-500" },
  { name: "Scaled", value: "default-scaled", color: "bg-zinc-400" },
  { name: "Blue Scaled", value: "blue-scaled", color: "bg-blue-500" },
  { name: "Mono", value: "mono-scaled", color: "bg-neutral-500" },
];

export function NavUser({
  user: initialUser,
}: {
  user: {
    name: string
    email: string
    avatar: string
    id?: string
    role?: string
  }
}) {
  const { isMobile } = useSidebar()
  const router = useRouter()
  const [isLoaded, setIsLoaded] = useState(false)
  const { activeTheme, setActiveTheme } = useThemeConfig()
  const [user, setUser] = useState({
    ...initialUser,
    id: "679e2a44ea73db1789c62981",
    role: "Administrator"
  })

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch("/api/auth/session");
        if (res.ok) {
          const { user: sessionUser } = await res.json();
          setUser({
            id: sessionUser.id,
            name: sessionUser.name,
            email: sessionUser.email,
            role: sessionUser.role,
            avatar: sessionUser.avatar
          });
        }
      } catch (e) {
        console.error("Failed to fetch session");
      } finally {
        setIsLoaded(true)
      }
    };
    fetchSession();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
    } catch (e) {
      console.error("Logout failed");
    }
  };

  if (!isLoaded) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <div className="flex items-center gap-2 p-2">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              tooltip={user.name}
            >
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-black uppercase tracking-tight">{user.name}</span>
              </div>
              <IconDotsVertical className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-black uppercase text-[12px] tracking-tight">{user.role}</span>
                  <span className="text-muted-foreground truncate text-[10px] font-medium leading-none mt-1">
                    {user.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => router.push(`/admin/users/${user.id}`)}>
                <IconUserCircle />
                Profile
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <IconPalette className="mr-2 h-4 w-4" />
                  Theme
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="min-w-[140px]">
                  {THEMES.map((theme) => (
                    <DropdownMenuItem
                      key={theme.value}
                      onClick={() => setActiveTheme(theme.value)}
                      className="gap-2"
                    >
                      <span className={`h-3 w-3 rounded-full ${theme.color} ${activeTheme === theme.value ? "ring-2 ring-offset-1 ring-offset-background ring-primary" : ""}`} />
                      <span className={activeTheme === theme.value ? "font-semibold" : ""}>{theme.name}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <IconLogout />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
