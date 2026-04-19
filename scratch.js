const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb+srv://symx-admin:bNWe7iX9O9k9H2n0@cluster0.a1kio9k.mongodb.net/symx-systems?retryWrites=true&w=majority");
  
  const RouteTypeSchema = new mongoose.Schema({
      name: String, color: String, startTime: String, icon: String
  }, { collection: 'SYMXRouteTypes' });
  const RouteType = mongoose.model('RouteType', RouteTypeSchema);
  
  const types = await RouteType.find().lean();
  console.log(JSON.stringify(types, null, 2));
  
  mongoose.disconnect();
}
run().catch(console.error);
