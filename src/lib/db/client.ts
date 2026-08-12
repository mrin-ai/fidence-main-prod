import { MongoClient, type Db } from "mongodb";

const uri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/fidence";
const readUri = process.env.MONGODB_READ_URI;
const dbName = process.env.MONGODB_DB ?? "fidence";
const maxPoolSize = Number(process.env.MONGODB_MAX_POOL_SIZE ?? 35);

function isLocalMongoUri(connectionUri: string) {
  return /mongodb(\+srv)?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(connectionUri);
}

/** Skip remote read replica when primary is local dev Mongo. */
const useReadReplica = Boolean(readUri) && !isLocalMongoUri(uri);

const clientOptions = {
  maxPoolSize,
  serverSelectionTimeoutMS: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS ?? 10_000),
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
  if (!global[globalKey]) {
    const client = new MongoClient(connectionUri, options);
    global[globalKey] = client.connect();
  }
  return global[globalKey]!;
}

const clientPromise = connectClient(uri, clientOptions, "__mongoClientPromise");
const readClientPromise = useReadReplica
  ? connectClient(readUri!, readClientOptions, "__mongoReadClientPromise")
  : null;

let dbBootstrapPromise: Promise<void> | null = null;
let isBootstrapping = false;

async function ensureDatabaseReady(db: Db) {
  if (dbBootstrapPromise) {
    await dbBootstrapPromise;
    return;
  }

  dbBootstrapPromise = (async () => {
    isBootstrapping = true;
    try {
      const { runDbMigrations, ensureDbIndexes } = await import("@/lib/db/seed");
      await runDbMigrations(db);
      await ensureDbIndexes(db);
    } finally {
      isBootstrapping = false;
    }
  })().catch((error) => {
    dbBootstrapPromise = null;
    throw error;
  });

  await dbBootstrapPromise;
}

export async function getDb(): Promise<Db> {
  const client = await clientPromise;
  const db = client.db(dbName);

  if (isBootstrapping) {
    return db;
  }

  if (!dbBootstrapPromise) {
    await ensureDatabaseReady(db);
  } else {
    await dbBootstrapPromise;
  }

  return db;
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
