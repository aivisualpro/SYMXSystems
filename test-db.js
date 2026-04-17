const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/symx', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    const db = mongoose.connection.useDb('test'); // Replace with actual DB name if different
    const col = mongoose.connection.collection('messagingtemplates'); // or whatever collection
    const docs = await col.find({}).toArray();
    console.log(docs);
    process.exit(0);
  });
