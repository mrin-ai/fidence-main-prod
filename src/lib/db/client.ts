import { MongoClient, type Db } from "mongodb";

const uri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/fidence";
const readUri = process.env.MONGODB_READ_URI;
const dbName = process.env.MONGODB_DB ?? "fidence";
const maxPoolSize = Number(process.env.MONGODB_MAX_POOL_SIZE ?? 35);

const clientOptions = {
  maxPoolSize,
  serverSelectionTimeoutMS: 5000,
};

const readClientOptions = {
  ...clientOptions,
  readPreference: "secondaryPreferred" as const,
};

declare global {
  // eslint-disable-next-line no-var
  var __mongoClientPromise: Promise<MongoClient> | undefined;
  // eslint-disable-next-line no-var
  var __mongoReadClientPromise: Promise<MongoClient> | undefined;
}

function connectClient(
  connectionUri: string,
  options: typeof clientOptions,
  globalKey: "__mongoClientPromise" | "__mongoReadClientPromise",
) {
  if (process.env.NODE_ENV === "development") {
    if (!global[globalKey]) {
      const client = new MongoClient(connectionUri, options);
      global[globalKey] = client.connect();
    }
    return global[globalKey]!;
  }

  const client = new MongoClient(connectionUri, options);
  return client.connect();
}

const clientPromise = connectClient(uri, clientOptions, "__mongoClientPromise");
const readClientPromise = readUri
  ? connectClient(readUri, readClientOptions, "__mongoReadClientPromise")
  : null;

export async function getDb(): Promise<Db> {
  const client = await clientPromise;
  return client.db(dbName);
}

/** Prefer secondary when MONGODB_READ_URI is configured (read replica). */
export async function getReadDb(): Promise<Db> {
  if (!readClientPromise) {
    return getDb();
  }

  const client = await readClientPromise;
  return client.db(dbName);
}

export { clientPromise };
