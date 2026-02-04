
import connectToDatabase from "@/lib/db";
import VidaPO from "@/lib/models/VidaPO";
import { LiveShipmentsTable } from "@/components/admin/live-shipments-table";

export default async function Page() {
  await connectToDatabase();
  
  // Aggregate to find all containers in Customer POs
  const rawShipments = await VidaPO.find(
    { "customerPO.shipping.containerNo": { $exists: true, $nin: ["", "TBD", "tbd"] } },
    { "customerPO.shipping": 1, "customerPO.customer": 1, "customerPO.customerPONo": 1, "customerPO.poNo": 1, "vbpoNo": 1 }
  ).lean();

  const containers: Array<{ 
    id: string;
    containerNo: string; 
    vbid: string;
    poNo: string;
    svbid: string;
    customerName: string;
    initialData?: any;
  }> = [];

  rawShipments.forEach((po: any) => {
    if (po.customerPO) {
        po.customerPO.forEach((cpo: any) => {
            if (cpo.shipping) {
                cpo.shipping.forEach((ship: any) => {
                    if (ship.containerNo && ship.containerNo.toLowerCase() !== "tbd") {
                        containers.push({
                            id: po._id.toString(),
                            containerNo: ship.containerNo,
                            vbid: po.vbpoNo,
                            poNo: cpo.poNo || "",
                            svbid: ship.svbid || "",
                            customerName: cpo.customer || "Unknown",
                            initialData: (ship.shippingTrackingRecords && ship.shippingTrackingRecords.length > 0) 
                              ? JSON.parse(JSON.stringify(ship.shippingTrackingRecords[ship.shippingTrackingRecords.length - 1])) 
                              : null
                        });
                    }
                });
            }
        });
    }
  });

  // Unique containers
  const uniqueContainers = Array.from(new Map(containers.map(item => [item.containerNo, item])).values());

  return (
    <div className="flex flex-1 flex-col overflow-y-auto h-full">
        <LiveShipmentsTable containers={uniqueContainers} />
    </div>
  );
}
