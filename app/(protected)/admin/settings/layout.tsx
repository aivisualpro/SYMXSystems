"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Settings, Upload, Shield } from "lucide-react";

interface SettingsLayoutProps {
  children: React.ReactNode;
}

const sidebarNavItems = [
  {
    title: "General",
    href: "/admin/settings/general",
    icon: Settings,
  },
  {
    title: "Roles & Permissions",
    href: "/admin/settings/roles",
    icon: Shield,
  },
  {
    title: "Imports",
    href: "/admin/settings/imports",
    icon: Upload,
  },
];

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col space-y-8 md:flex-row md:space-x-12 md:space-y-0">
      <aside className="lg:w-1/5">
        <nav
          className={cn(
            "flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1",
          )}
        >
          {sidebarNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                buttonVariants({ variant: "ghost" }),
                pathname === item.href || pathname.startsWith(`${item.href}/`)
                  ? "bg-primary/10 text-primary hover:bg-primary/20 font-medium"
                  : "hover:bg-muted hover:text-foreground",
                "justify-start"
              )}
            >
              <item.icon className="mr-2 h-4 w-4" />
              {item.title}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex-1">{children}</div>
    </div>
  );
}
