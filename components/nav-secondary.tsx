import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { type Icon } from "@tabler/icons-react"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavSecondary({
  items,
  ...props
}: {
  items: {
    title: string
    url: string
    icon: Icon
  }[]
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  const pathname = usePathname()

  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item: any) => {
            const isActive = item.url !== "#" && pathname.startsWith(item.url);
            const content = (
              <>
                <item.icon />
                <span>{item.title}</span>
              </>
            );

            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton 
                  asChild={!item.onClick} 
                  isActive={isActive} 
                  tooltip={item.title}
                  onClick={item.onClick}
                >
                  {item.onClick ? (
                    content
                  ) : (
                    <Link href={item.url}>
                      {content}
                    </Link>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
