import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI as string | undefined;

declare global {
  var _mongooseConn: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null } | undefined;
}

const cached = global._mongooseConn ?? { conn: null, promise: null };
global._mongooseConn = cached;

export async function connectMongo() {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured. Add it to your .env.local");
  }

  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, { dbName: process.env.MONGODB_DB ?? "cardiosense" });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}
