const LOTTIE_PATH = "/animations/fingerprint.lottie";
const CACHE_NAME = "fidence-splash-v3";

/** Load splash Lottie from Cache API after first fetch — avoids repeat server requests. */
export async function resolveSplashLottieSrc(): Promise<string> {
  if (typeof window === "undefined" || !("caches" in window)) {
    return LOTTIE_PATH;
  }

  try {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(LOTTIE_PATH);
    if (cached) {
      const blob = await cached.blob();
      return URL.createObjectURL(blob);
    }

    const response = await fetch(LOTTIE_PATH);
    if (!response.ok) return LOTTIE_PATH;

    await cache.put(LOTTIE_PATH, response.clone());
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch {
    return LOTTIE_PATH;
  }
}

export function revokeSplashLottieSrc(src: string) {
  if (src.startsWith("blob:")) {
    URL.revokeObjectURL(src);
  }
}
