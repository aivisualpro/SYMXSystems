const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://adeeljabbar:3C9S7lXN2dE8D6x2@cluster0.hcl9m.mongodb.net/symx');
const schema = new mongoose.Schema({ name: String, icon: String }, { strict: false });
const Model = mongoose.models.SYMXAdminModule || mongoose.model("SYMXAdminModule", schema, "symxAdminModules");
async function run() {
  await Model.updateOne({ name: "Everyday" }, { $set: { icon: "IconSun" } });
  console.log("Updated");
  process.exit();
}
run();
