import connectToDatabase from './lib/db';
import SymxPO from './lib/models/SymxPO';

async function check() {
  await connectToDatabase();
  
  // Sidebar logic (Count of unique containers IN_TRANSIT)
  const sidebarCount = await SymxPO.aggregate([
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
  
  // Map logic pre-filter (Count of unique containers IN_TRANSIT that HAVE tracking records)
  const mapCandidates = await SymxPO.aggregate([
    { $unwind: "$customerPO" },
    { $unwind: "$customerPO.shipping" },
    { 
      $match: { 
        "customerPO.shipping.containerNo": { $exists: true, $ne: "" },
        "customerPO.shipping.status": "IN_TRANSIT",
         "customerPO.shipping.shippingTrackingRecords": { $exists: true, $not: { $size: 0 } }
      } 
    },
    { $group: { _id: "$customerPO.shipping.containerNo" } },
     { $project: { _id: 1 } }
  ]);

   // Find the difference
   const allInTransitV = await SymxPO.aggregate([
    { $unwind: "$customerPO" },
    { $unwind: "$customerPO.shipping" },
    { 
      $match: { 
        "customerPO.shipping.containerNo": { $exists: true, $ne: "" },
        "customerPO.shipping.status": "IN_TRANSIT"
      } 
    },
    { $group: { _id: "$customerPO.shipping.containerNo" } },
     { $project: { _id: 1 } }
  ]);
  
  const mapSet = new Set(mapCandidates.map(c => c._id));
  const diff = allInTransitV.filter(c => !mapSet.has(c._id));

  console.log("Sidebar Count:", sidebarCount[0]?.count || 0);
  console.log("Map Candidates Count:", mapCandidates.length);
  console.log("Difference (Missing Tracking):", diff);
  
  process.exit(0);
}

check();
