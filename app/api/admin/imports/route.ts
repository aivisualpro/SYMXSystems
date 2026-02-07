import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import SymxSupplier from "@/lib/models/SymxSupplier";
import SymxProduct from "@/lib/models/SymxProduct";
import SymxPO from "@/lib/models/SymxPO";
import SymxWarehouse from "@/lib/models/SymxWarehouse";
import Papa from "papaparse";

export async function POST(req: Request) {
  try {
    await connectToDatabase();
    let data: any[] = [];
    let type = "";

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = await req.json();
      data = body.data;
      type = body.type;
    } else {
      const formData = await req.formData();
      const file = formData.get("file") as File;
      type = formData.get("type") as string;

      if (!file || !type) {
        return NextResponse.json(
          { error: "File and type are required" },
          { status: 400 }
        );
      }

      const buffer = await file.arrayBuffer();
      const content = new TextDecoder().decode(buffer);

      try {
        const parseResult = Papa.parse(content, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: true,
        });

        if (parseResult.errors.length > 0) {
          console.error("CSV Parse errors:", parseResult.errors);
          return NextResponse.json(
            { error: "Invalid CSV file: " + parseResult.errors[0].message },
            { status: 400 }
          );
        }
        data = parseResult.data;
      } catch (e) {
        return NextResponse.json(
          { error: "Failed to parse CSV file" },
          { status: 400 }
        );
      }
    }

    if (!data || !Array.isArray(data)) {
      return NextResponse.json(
        { error: "Invalid data format. Expected an array." },
        { status: 400 }
      );
    }


    let count = 0;

    switch (type) {
      // Customers removed

      case "suppliers":
         const suppOps = data.map((item: any) => ({
            updateOne: {
                filter: { vbId: item.vbId },
                update: { $set: item },
                upsert: true
            }
        }));
        if(suppOps.length > 0) {
            const res = await SymxSupplier.bulkWrite(suppOps);
            count = res.upsertedCount + res.modifiedCount;
        }
        break;

      case "supplier-locations":
        // data should have 'suppliervbId' and location fields
        const groupedSuppLocations: Record<string, any[]> = {};
        data.forEach((item: any) => {
          // Robust key finding for suppliervbId (matches many variations)
          const rawSid = item.suppliervbId || item.supplierVbId || item.suppliervbid || item.SupplierVbId || "";
          const sid = rawSid.toString().trim();
          if (!sid) return;

          if (!groupedSuppLocations[sid]) groupedSuppLocations[sid] = [];
          
          // Map vbid -> vbId and name -> locationName
          const rawLocationVbId = item.vbid || item.vbId || item.locationVbId || "";
          const rawLocationName = item.name || item.locationName || item.locationname || "";

          // Construct the location object
          const locationData = {
            ...item,
            vbId: rawLocationVbId.toString().trim(),
            locationName: rawLocationName.toString().trim()
          };

          // Remove the reference keys to keep DB clean
          delete (locationData as any).suppliervbId;
          delete (locationData as any).supplierVbId;
          delete (locationData as any).suppliervbid;
          delete (locationData as any).SupplierVbId;
          delete (locationData as any).vbid;
          delete (locationData as any).name;

          groupedSuppLocations[sid].push(locationData);
        });

        const suppLocationOps = Object.entries(groupedSuppLocations).map(([sid, locs]) => ({
          updateOne: {
            filter: { vbId: sid },
            update: { 
              $addToSet: { location: { $each: locs } } 
            }
          }
        }));

        if (suppLocationOps.length > 0) {
          await SymxSupplier.bulkWrite(suppLocationOps);
          count = data.length; 
        }
        break;

      case "products":
        const prodOps = data
          .map((item: any) => {
            const vid = (item.vbid || item.vbId || "").toString().trim();
            if (!vid) return null;
            
            const rawName = item.product || item.Product || item.name || item.Name || "";
            
            // Map the cleaned ID and Name back for the database
            const cleanedItem = { 
              ...item, 
              vbId: vid,
              name: rawName.toString().trim()
            };
            
            // Clean up original source fields
            delete (cleanedItem as any).vbid;
            delete (cleanedItem as any).product;
            
            return {
              updateOne: {
                filter: { vbId: vid },
                update: { $set: cleanedItem },
                upsert: true
              }
            };
          })
          .filter(Boolean);

        if (prodOps.length > 0) {
            const res = await SymxProduct.bulkWrite(prodOps as any);
            count = res.upsertedCount + res.modifiedCount;
        }
        break;

      case "purchase-orders":
        const poOps = data
          .map((item: any) => {
            const vid = (item.vbid || item.vbpoNo || item.VBID || "").toString().trim();
            if (!vid) return null;
            
            // Map the cleaned ID and other fields
            const cleanedItem = { 
              ...item, 
              vbpoNo: vid,
              date: item.date ? new Date(item.date) : new Date()
            };
            
            // Clean up original source fields
            delete (cleanedItem as any).vbid;
            delete (cleanedItem as any).VBID;
            
            return {
              updateOne: {
                filter: { vbpoNo: vid },
                update: { $set: cleanedItem },
                upsert: true
              }
            };
          })
          .filter(Boolean);

        if (poOps.length > 0) {
            const res = await SymxPO.bulkWrite(poOps as any);
            count = res.upsertedCount + res.modifiedCount;
        }
        break;
        
      case "warehouse":
           // using insertMany for simplicity if no unique key other than _id is enforced heavily or just simple create
           // But name is unique?
            const warehouseOps = data.map((item: any) => ({
             updateOne: {
                 filter: { name: item.name },
                 update: { $set: item },
                 upsert: true
             }
         }));
         if(warehouseOps.length > 0) {
             const res = await SymxWarehouse.bulkWrite(warehouseOps);
              count = res.upsertedCount + res.modifiedCount;
         }
         break;

      case "customer-pos":
        const groupedCPOs: Record<string, any[]> = {};
        data.forEach((item: any) => {
          // Parent PO reference: vbid
          const vid = (item.vbid || "").toString().trim();
          if (!vid) return;
          if (!groupedCPOs[vid]) groupedCPOs[vid] = [];
          
          // Map sub-record fields based on user-provided CSV headers
          const cleanedItem = { 
            ...item,
            poNo: (item.poNumber || "").toString().trim(),
            customer: (item.customerVbid || "").toString().trim(),
            customerLocation: (item.customerLocationVbid || "").toString().trim(),
            customerPONo: (item.customerPO || "").toString().trim(),
            qtyOrdered: Number(item.qtyOrdered) || 0,
            qtyReceived: Number(item.qtyReceived) || 0,
            UOM: (item.UOM || "").toString().trim(),
            warehouse: (item.warehouse || "").toString().trim()
          };

          // Remove parent reference and original redundant keys
          delete (cleanedItem as any).vbid;
          delete (cleanedItem as any).poNumber;
          delete (cleanedItem as any).customerVbid;
          delete (cleanedItem as any).customerLocationVbid;
          delete (cleanedItem as any).customerPO;
          
          // Parse dates with provided headers
          const rawPODate = item.custPODate || item.customerPODate;
          if (rawPODate) cleanedItem.customerPODate = new Date(rawPODate);
          
          const rawReqDate = item.requestedDeliveryDate;
          if (rawReqDate) cleanedItem.requestedDeliveryDate = new Date(rawReqDate);
          
          groupedCPOs[vid].push(cleanedItem);
        });

        const cpoOps = Object.entries(groupedCPOs).map(([vid, pos]) => ({
          updateOne: {
            filter: { vbpoNo: vid },
            update: { 
              $addToSet: { customerPO: { $each: pos } } 
            }
          }
        }));

        if (cpoOps.length > 0) {
          await SymxPO.bulkWrite(cpoOps);
          count = data.length; 
        }
        break;

      case "shippings":
        const groupedShippings: Record<string, any[]> = {};
        
        data.forEach((item: any) => {
          // Parent PO reference: vbpoNo (Master PO)
          // PRIORITIZE vbpoNo because 'vbid' in some CSVs might be the shipping record ID (e.g. VB001-1-1) rather than the parent PO (VB001)
          const vid = (item.vbpoNo || item.VBPONo || item.vbid || item.VBID || "").toString().trim();
          if (!vid) {
            console.log("Skipping shipping record: Missing Parent PO ID (vbpoNo)", item);
            return;
          }

          // Target sub-record linker: poNo (customerPO number)
          const cpoNo = (item.poNo || item.PoNo || "").toString().trim();
          if (!cpoNo) {
             console.log("Skipping shipping record: Missing Customer PO Number (poNo)", item);
             return;
          }
          
          if (!groupedShippings[vid]) groupedShippings[vid] = [];

          const parseBool = (val: any) => {
             if (typeof val === 'boolean') return val;
             if (typeof val === 'string') {
                 const lower = val.toLowerCase().trim();
                 return lower === 'true' || lower === 'yes' || lower === '1';
             }
             return !!val;
          };

          // Construct shipping object
          const shippingData = {
              svbid: item.svbid || item.sVbid || item.SVBID || "",
              supplierLocation: item.supplierLocationId || item.supplierLocation,
              supplierPO: item.supplierPO,
              supplierPoDate: item.poDate ? new Date(item.poDate) : undefined,
              carrier: item.carrier,
              carrierBookingRef: item.carrierBookingRef,
              BOLNumber: item.BOLNumber,
              containerNo: item.container,
              vessellTrip: item.vessellTrip,
              portOfLading: item.portofLading,
              portOfEntryShipTo: item.portofEntryShipto,
              dateOfLanding: item.dateOfLanding ? new Date(item.dateOfLanding) : undefined,
              ETA: item.ETA ? new Date(item.ETA) : undefined,
              product: item.product,
              drums: Number(item.drums) || 0,
              pallets: Number(item.pallets) || 0,
              gallons: Number(item.gallons) || 0,
              invValue: Number(item.invValue) || 0,
              estTrumpDuties: Number(item.estTrumpDuties) || 0,
              netWeightKG: Number(item.netWeightKG) || 0,
              grossWeightKG: Number(item.grossWeightKG) || 0,
              ticoVB: item.ticoVB,
              updatedETA: item.updatedETA ? new Date(item.updatedETA) : undefined,
              arrivalNotice: item.isArrivalNotice, // Mapping as-is (String in schema)
              isGensetRequired: parseBool(item.isGensetRequired),
              gensetInv: item.gensetInv,
              gensetEmailed: parseBool(item.gensetEmailed),
              isCollectFeesPaid: parseBool(item.IsCollectFeesPaid),
              feesAmount: Number(item.feesAmount) || 0,
              estimatedDuties: Number(item.estimatedDuties) || 0,
              isDOCreated: parseBool(item.IsDOCreated),
              status: item.status,
              updateShipmentTracking: item.updateShipmentTracking,
              quickNote: item.quickNote,
              isSupplierInvoice: parseBool(item.supplierInvoice),
              isManufacturerSecurityISF: parseBool(item.isManufacturerSecurityISF),
              isSymxSystemsISFFiling: parseBool(item["isSymxSystems ISFFiling"] || item.isSymxSystemsISFFiling),
              isPackingList: parseBool(item.isPackingList),
              isCertificateOfAnalysis: parseBool(item.isCertificateOfAnalysis),
              isCertificateOfOrigin: parseBool(item.isCertificateOfOrigin),
              IsBillOfLading: parseBool(item.isBillOfLading),
              isAllDocumentsProvidedToCustomsBroker: parseBool(item.isAllDocumentsProvidedToCustomsBroker),
              isCustomsStatus: parseBool(item.isCustomsStatus),
              IsDrayageAssigned: parseBool(item.IsDrayageAssigned),
              truckerNotifiedDate: item.isTruckerNotifiedDate ? new Date(item.isTruckerNotifiedDate) : undefined,
              isTruckerReceivedDeliveryOrder: parseBool(item.isTruckerReceivedDeliveryOrder),
              
              // Metadata we might want to keep or just rely on being in shipping
              poNoLinker: cpoNo // Temporary field to help with filtering, remove later? No, we need it for the update operation
          };

          groupedShippings[vid].push(shippingData);
        });

        const shippingOps: any[] = [];
        
        // We have to iterate and create a generic update for each shipping item because
        // we need to filter by "customerPO.poNo" which is specific to each item, 
        // unlike pushing to the root array.
        // Or we can group by (vid + poNo) to push multiple shippings to the same CPO at once.
        
        Object.entries(groupedShippings).forEach(([vid, items]) => {
             // Group items by their target customer PO number to minimize DB calls
             const itemsByCpo: Record<string, any[]> = {};
             
             items.forEach(item => {
                 const cpoLinker = item.poNoLinker;
                 if(!itemsByCpo[cpoLinker]) itemsByCpo[cpoLinker] = [];
                 
                 // Clean up the linker
                 const finalItem = { ...item };
                 delete finalItem.poNoLinker;
                 
                 itemsByCpo[cpoLinker].push(finalItem);
             });

             // Create ops
             Object.entries(itemsByCpo).forEach(([cpoNo, shippings]) => {
                 shippingOps.push({
                     updateOne: {
                         filter: { vbpoNo: vid, "customerPO.poNo": cpoNo },
                         update: {
                             $push: { "customerPO.$.shipping": { $each: shippings } }
                         }
                     }
                 });
             });
        });

        if (shippingOps.length > 0) {
            await SymxPO.bulkWrite(shippingOps);
            count = data.length;
        }
        break;
      
      default:
        return NextResponse.json(
          { error: "Invalid import type" },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true, count });
  } catch (error) {
    console.error("Import failed:", error);
    return NextResponse.json(
      { error: "Import failed" },
      { status: 500 }
    );
  }
}
