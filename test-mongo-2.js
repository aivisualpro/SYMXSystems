require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');
async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const confs = await db.collection('SYMXScheduleConfirmations').find({ employeeName: /ADAN/i }).toArray();
  console.log("Confs:", confs);
  process.exit(0);
}
check();
