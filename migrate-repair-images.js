const { MongoClient } = require('mongodb');
const uri = "mongodb+srv://adeel_db_user:MX3ZW3LRoVYHob1g@symxproduction.e1h4x4o.mongodb.net/SYMXProduction";

async function main() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log("Connected to MongoDB.");
    const db = client.db('SYMXProduction'); // explicitly use the DB name from the connection string
    const collection = db.collection('vehiclesRepairs');
    
    const cursor = collection.find({ image: { $exists: true, $ne: "" }, $or: [ { images: { $exists: false } }, { images: { $size: 0 } } ] });
    const docs = await cursor.toArray();
    console.log(`Found ${docs.length} documents needing migration.`);

    let migrated = 0;
    for (const doc of docs) {
       let newImages = Array.isArray(doc.images) ? [...doc.images] : [];
       if (!newImages.includes(doc.image)) {
         newImages.push(doc.image);
       }
       
       await collection.updateOne(
         { _id: doc._id }, 
         { 
           $set: { images: newImages }
         }
       );
       migrated++;
    }
    console.log(`Successfully migrated ${migrated} records. Now purging 'image' from all docs...`);

    const result = await collection.updateMany({}, { $unset: { image: "" } });
    console.log(`Unset 'image' on ${result.modifiedCount} documents.`);
  } catch(e) {
    console.error(e);
  } finally {
    await client.close();
  }
}
main();
