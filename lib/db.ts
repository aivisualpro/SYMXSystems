import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || process.env.DEVELOPMENT_MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    "Please define the MONGODB_URI environment variable inside .env.local"
  );
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongoose: MongooseCache;
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectToDatabase() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      maxPoolSize: 10,              // More concurrent queries (default is 5)
      minPoolSize: 2,               // Keep connections warm
      socketTimeoutMS: 30000,       // 30s socket timeout
      serverSelectionTimeoutMS: 5000, // Fail fast if DB is unreachable
      autoIndex: process.env.NODE_ENV === 'development', // Auto-create indexes in dev
      family: 4,                    // Force IPv4. Fixes Vercel/Node 20 IPv6 TLS handshake issues with MongoDB Atlas
    };

    cached.promise = mongoose.connect(MONGODB_URI!, opts).then((mongoose) => {
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e: any) {
    cached.promise = null;
    console.error("Database connection error: ", e);
    if (e.message && e.message.includes("SSL routines:ssl3_read_bytes:tlsv1 alert internal error")) {
      console.error(
        "\n======================================================\n" +
        "🚨 MONGODB IP ALLOWLIST ERROR 🚨\n\n" +
        "This SSL TLS error on Vercel almost always means your current deployment IP is NOT whitelisted in MongoDB Atlas.\n\n" +
        "To fix this:\n" +
        "1. Go to your MongoDB Atlas dashboard.\n" +
        "2. Navigate to 'Network Access' under 'Security' on the left sidebar.\n" +
        "3. Click 'Add IP Address'.\n" +
        "4. Choose 'ALLOW ACCESS FROM ANYWHERE' (which sets it to 0.0.0.0/0).\n" +
        "5. Click 'Confirm' and wait a maximum of 3-5 minutes for it to deploy.\n" +
        "======================================================\n"
      );
    }
    throw e;
  }

  return cached.conn;
}

export default connectToDatabase;
