import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaPO from "@/lib/models/VidaPO";
import VidaCustomer from "@/lib/models/VidaCustomer";
import VidaSupplier from "@/lib/models/VidaSupplier";
import VidaProduct from "@/lib/models/VidaProduct";

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    
    // Fetch all reference data in parallel
    const [pos, customers, suppliers, products] = await Promise.all([
      VidaPO.find({}),
      VidaCustomer.find({}),
      VidaSupplier.find({}),
      VidaProduct.find({})
    ]);

    // Build lookup maps
    const customerMap = new Map(customers.map(c => [c.vbId, c.name]));
    const productMap = new Map(products.map(p => [p.vbId, p.name]));
    
    // Build supplier location map
    const supplierLocationMap = new Map();
    suppliers.forEach(s => {
      if (s.location && Array.isArray(s.location)) {
        s.location.forEach(loc => {
          if (loc.vbId) {
            supplierLocationMap.set(loc.vbId, loc.locationName || s.name);
          }
        });
      }
    });

    // Flatten the records
    const flattenedRecords = [];
    
    for (const po of pos) {
      if (po.customerPO && Array.isArray(po.customerPO)) {
        for (const cpo of po.customerPO) {
          if (cpo.shipping && Array.isArray(cpo.shipping)) {
            for (const ship of cpo.shipping) {
              flattenedRecords.push({
                _id: ship._id,
                poId: po._id,
                cpoId: cpo._id,
                shipId: ship._id,
                
                // VidaPO data
                vbpoNo: po.vbpoNo,
                orderType: po.orderType,
                
                // CustomerPO data
                poNo: cpo.poNo,
                customer: cpo.customer ? (customerMap.get(cpo.customer) || cpo.customer) : "", 
                customerLocation: cpo.customerLocation,
                customerPONo: cpo.customerPONo,
                qtyOrdered: cpo.qtyOrdered,
                warehouse: cpo.warehouse,
                
                // Shipping data
                spoNo: ship.spoNo,
                svbid: ship.svbid,
                supplierLocationId: ship.supplierLocation ? (supplierLocationMap.get(ship.supplierLocation) || ship.supplierLocation) : "",
                product: ship.product ? (productMap.get(ship.product) || ship.product) : "",
                BOLNumber: ship.BOLNumber,
                carrier: ship.carrier,
                vessellTrip: ship.vessellTrip,
                updatedETA: ship.updatedETA || ship.ETA,
                estimatedDuties: ship.estimatedDuties,
                quickNote: ship.quickNote,
                portofEntryShipto: ship.portOfEntryShipTo,
                
                // Inventory fields
                itemNo: ship.itemNo,
                description: ship.description,
                lotSerial: ship.lotSerial,
                qty: ship.qty,
                type: ship.type,
                inventoryDate: ship.inventoryDate,
                
                // Customs fields
                carrierBookingRef: ship.carrierBookingRef,
                isManufacturerSecurityISF: ship.isManufacturerSecurityISF,
                ISF: ship.isVidaBuddiesISFFiling ? "Yes" : "No", // Assuming ISF corresponds to this
                trackingId: ship.updateShipmentTracking,
                status: ship.status || "",
                customsStatus: ship.isCustomsStatus ? "Cleared" : "Pending",
                documentsRequired: ship.isAllDocumentsProvidedToCustomsBroker ? "All Provided" : "Missing",
                
                // LSB fields
                container: ship.containerNo,
                vbid: ship.svbid, // svbid maps to vbid in LSB view
              });
            }
          }
        }
      }
    }
    
    return NextResponse.json(flattenedRecords);
  } catch (error) {
    console.error("Error fetching tracker data:", error);
    return NextResponse.json({ error: "Failed to fetch tracker data" }, { status: 500 });
  }
}
