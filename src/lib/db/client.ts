import { MongoClient, type Db } from "mongodb";

const uri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/fidence";
const dbName = process.env.MONGODB_DB ?? "fidence";

// Self-hosted Mongo from Vercel: use TLS, allowlist/tunnel, keep maxPoolSize conservative.
const clientOptions = {
  maxPoolSize: 15,
  serverSelectionTimeoutMS: 5000,
};

declare global {
  // eslint-disable-next-line no-var
  var __mongoClientPromise: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === "development") {
  if (!global.__mongoClientPromise) {
    const client = new MongoClient(uri, clientOptions);
    global.__mongoClientPromise = client.connect();
  }
  clientPromise = global.__mongoClientPromise;
} else {
  const client = new MongoClient(uri, clientOptions);
  clientPromise = client.connect();
}

export async function getDb(): Promise<Db> {
  const client = await clientPromise;
  return client.db(dbName);
}

export { clientPromise };
