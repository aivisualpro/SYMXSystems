import { AppSidebar } from "@/components/app-sidebar";
import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

import { cookies } from "next/headers";
import connectToDatabase from "@/lib/db";
import VidaPO from "@/lib/models/VidaPO";
import ShipmentMapWrapper from "@/components/dashboard/shipment-map-wrapper";

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

  // Fetch locations for map
  const activeShipments = await VidaPO.find(
    { "customerPO.shipping.shippingTrackingRecords": { $exists: true, $not: { $size: 0 } } },
    { "customerPO.shipping": 1, "vbpoNo": 1 }
  ).lean();

  const mapLocations: any[] = [];
  activeShipments.forEach((po: any) => {
    if (po.customerPO) {
        po.customerPO.forEach((cpo: any) => {
            if (cpo.shipping) {
                cpo.shipping.forEach((ship: any) => {
                    // Only show IN_TRANSIT shipments to match sidebar count
                    if (ship.status !== "IN_TRANSIT") return;

                    // Deduplicate by container number
                    if (mapLocations.some(loc => loc.containerNo === ship.containerNo)) return;

                    const records = ship.shippingTrackingRecords;
                    if (records && records.length > 0) {
                        const lastRecord = records[records.length - 1];
                        if (lastRecord.latlong) {
                            const parts = lastRecord.latlong.split(',');
                            if (parts.length === 2) {
                                const lat = parseFloat(parts[0].trim());
                                const lng = parseFloat(parts[1].trim());
                                if (!isNaN(lat) && !isNaN(lng)) {
                                    mapLocations.push({
                                        lat,
                                        lng,
                                        title: lastRecord.last_event_location || ship.vessellTrip || "Unknown Location",
                                        containerNo: ship.containerNo,
                                        vbid: po.vbpoNo,
                                        status: ship.status,
                                        origin: lastRecord.pol_name || ship.fromPort?.name || "N/A",
                                        destination: lastRecord.pod_name || ship.toPort?.name || "N/A",
                                        eta: lastRecord.pod_predictive_eta || ship.eta || null,
                                        departure: lastRecord.pol_date || ship.etd || null,
                                        updatedAt: lastRecord.updated_at || null,
                                        vessel: lastRecord.vessel_names || ship.vesselName || null,
                                        type: lastRecord.container_size_type || ""
                                    });
                                }
                            }
                        }
                    }
                });
            }
        });
    }
  });

  // Calculate total in-transit for comparison (matching sidebar logic)
  const sidebarCountResult = await VidaPO.aggregate([
      { $unwind: "$customerPO" },
      { $unwind: "$customerPO.shipping" },
      { 
        $match: { 
          "customerPO.shipping.containerNo": { $exists: true, $ne: "" },
          "customerPO.shipping.status": "IN_TRANSIT"
        } 
      },
      { $group: { _id: "$customerPO.shipping.containerNo" } },
      { $count: "count" }
  ]);
  const totalInTransit = sidebarCountResult[0]?.count || 0;

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <ChartAreaInteractive data={chartData} />
      </div>
      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle>
              Live Shipments Map ({mapLocations.length}
              {totalInTransit !== mapLocations.length ? ` of ${totalInTransit}` : ''})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            <ShipmentMapWrapper locations={mapLocations} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
