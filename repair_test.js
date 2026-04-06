const mongoose = require('mongoose');
const db = require('./lib/db');
require('dotenv').config({ path: '.env.local' });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const VehicleRepair = require('./lib/models/VehicleRepair').default;
  
  try {
    const repair = await VehicleRepair.create({
      description: "Test",
      currentStatus: "Not Started",
      estimatedDate: "",
      repairDuration: 0,
      vin: "123",
      vehicleName: "Ford"
    });
    console.log("Success:", repair);
  } catch (e) {
    console.error("Error creating repair:", e.message);
  }
  process.exit();
}

run();
