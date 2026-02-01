import { AppSidebar } from "@/components/app-sidebar";
import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { DataTable } from "@/components/data-table";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

import { cookies } from "next/headers";
import data from "./data.json";
import connectToDatabase from "@/lib/db";
import VidaPO from "@/lib/models/VidaPO";

export default async function Page() {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

  await connectToDatabase();
  const chartData = await VidaPO.aggregate([
    { $unwind: "$customerPO" },
    { $unwind: "$customerPO.shipping" },
    {
      $match: {
        "customerPO.shipping.updatedETA": { $exists: true, $ne: null }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m", date: "$customerPO.shipping.updatedETA" }
        },
        delivered: {
          $sum: {
            $cond: [{ $eq: ["$customerPO.shipping.status", "Delivered"] }, 1, 0]
          }
        },
        notDelivered: {
          $sum: {
            $cond: [{ $ne: ["$customerPO.shipping.status", "Delivered"] }, 1, 0]
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        date: "$_id",
        delivered: 1,
        notDelivered: 1
      }
    },
    { $sort: { date: 1 } }
  ]);

  return (
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
      <SidebarInset className="flex flex-col h-full overflow-hidden">
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <div className="px-4 lg:px-6">
                <ChartAreaInteractive data={chartData} />
              </div>
              <DataTable data={data} />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
