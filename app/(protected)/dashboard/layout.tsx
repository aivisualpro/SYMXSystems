import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/auth/require-permission";

// The Dashboard (revenue, KPIs, profitability) is Super Admin ONLY. It is not
// governed by the role permissions matrix, so no role can be granted it by
// accident. Everyone else is sent to their profile — checked on the server so
// it also holds on first load, bookmarks and the installed app's start page.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!isSuperAdmin(session)) redirect("/profile");
  return <>{children}</>;
}
