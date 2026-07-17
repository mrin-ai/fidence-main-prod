function isTransientMongoError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return /MongoServerSelectionError|MongoNetworkError|ECONNREFUSED|ENOTFOUND|timed out|socket/i.test(
    error.message,
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withDbRetry<T>(
  operation: () => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isTransientMongoError(error) || attempt === maxAttempts - 1) {
        throw error;
      }
      await sleep(150 * (attempt + 1));
    }
  }

  throw lastError;
}

export { isTransientMongoError };
