import connectToDatabase from './lib/db';
import SymxPO from './lib/models/SymxPO';

async function check() {
  await connectToDatabase();
  
  const allInTransitStats = await SymxPO.aggregate([
    { $unwind: "$customerPO" },
    { $unwind: "$customerPO.shipping" },
    { 
      $match: { 
        "customerPO.shipping.containerNo": { $exists: true, $ne: "" },
        "customerPO.shipping.status": "IN_TRANSIT"
      } 
    },
    { 
        $project: {
            containerNo: "$customerPO.shipping.containerNo",
            records: "$customerPO.shipping.shippingTrackingRecords"
        }
    }
  ]);

  const uniqueContainers = new Set();
  const validMapContainers = new Set();
  const invalidContainers = [];

  for (const item of allInTransitStats) {
      uniqueContainers.add(item.containerNo);
      
      const records = item.records;
      if (records && records.length > 0) {
          const lastRecord = records[records.length - 1];
          if (lastRecord.latlong) {
             const parts = lastRecord.latlong.split(',');
             if (parts.length === 2) {
                 const lat = parseFloat(parts[0].trim());
                 const lng = parseFloat(parts[1].trim());
                 if (!isNaN(lat) && !isNaN(lng)) {
                     validMapContainers.add(item.containerNo);
                     continue;
                 }
             }
          }
      }
      
      // If we get here, this specific PO entry didn't provide a valid location.
      // But we only care if NO entries for this container provide a valid location.
  }
  
  // Re-scan to find which unique containers are NEVER valid
  const missingContainers = [];
  for (const container of uniqueContainers) {
      if (!validMapContainers.has(container)) {
          missingContainers.push(container);
      }
  }

  console.log("Total Unique IN_TRANSIT Containers:", uniqueContainers.size);
  console.log("Total Valid Map Containers:", validMapContainers.size);
  console.log("Containers Missing Valid LatLong:", missingContainers);
  
  process.exit(0);
}

check();
