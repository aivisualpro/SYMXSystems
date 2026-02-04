import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { HeaderActionsProvider } from "@/components/providers/header-actions-provider";
import { cookies } from "next/headers";
import { getSession, logout } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import VidaUser from "@/lib/models/VidaUser";
import { redirect } from "next/navigation";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  
  // Extra security: Verify status in database on every page load
  if (session && session.id) {
    try {
      await connectToDatabase();
      const userId = String(session.id);
      if (userId.match(/^[0-9a-fA-F]{24}$/)) {
        const user = await VidaUser.findById(userId).select('isActive');
        if (!user || !user.isActive) {
          await logout();
          redirect("/login");
        }
      }
    } catch (error) {
       console.error("Layout Auth Check Error:", error);
    }
  }

  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

  return (
    <HeaderActionsProvider>
      <SidebarProvider
        defaultOpen={defaultOpen}
        className="h-screen overflow-hidden"
        style={
          {
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <AppSidebar variant="inset" />
        <SidebarInset className="flex flex-col h-full overflow-hidden bg-white shadow-none border-none m-0">
          <SiteHeader />
          <div className="flex-1 overflow-auto p-[16px]">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </HeaderActionsProvider>
  );
}
