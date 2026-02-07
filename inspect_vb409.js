
const { connect } = require('mongoose');
const mongoose = require('mongoose');

// Define minimal schema to query
const SymxPOSchema = new mongoose.Schema({
  vbpoNo: String,
  customerPO: [{
    shipping: [{
      svbid: String,
      containerNo: String,
      status: String,
      shippingTrackingRecords: [mongoose.Schema.Types.Mixed]
    }]
  }]
}, { strict: false });

const SymxPO = mongoose.models.SymxPO || mongoose.model('SymxPO', SymxPOSchema);

async function inspect() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to DB");

    const pos = await SymxPO.find({ 
        $or: [
            { "customerPO.shipping.svbid": "VB409-1-1" },
            { "customerPO.shipping.containerNo": "HLBU9775101" }
        ]
    });
    
    console.log(`Found ${pos.length} POs`);

    pos.forEach(po => {
        console.log("PO ID:", po._id);
        po.customerPO.forEach((cpo, i) => {
            if (cpo.shipping) {
                cpo.shipping.forEach((ship, j) => {
                    if (ship.svbid === "VB409-1-1" || ship.containerNo === "HLBU9775101") {
                        console.log(`  Match at cpo[${i}].shipping[${j}]:`);
                        console.log("    SVBID:", ship.svbid);
                        console.log("    Container:", ship.containerNo);
                        console.log("    Status:", ship.status);
                        console.log("    Tracking Records:", ship.shippingTrackingRecords?.length || 0);
                    }
                });
            }
        });
    });

  } catch (e) {
    console.error(e);
  } finally {
    await mongoose.disconnect();
  }
}

inspect();
