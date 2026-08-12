"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

import {
  resolveSplashLottieSrc,
  revokeSplashLottieSrc,
} from "@/lib/splash-lottie-cache";
import { cn } from "@/lib/utils";

const MIN_SPLASH_MS = 650;
const EXIT_MS = 280;
const SPLASH_FALLBACK_MS = 1500;
const SPLASH_HARD_CAP_MS = 2500;
const PLAYBACK_SPEED = 1.35;

const AUTH_PATHS = new Set(["/sign-in", "/sign-up"]);

const DotLottieReact = dynamic(
  () =>
    import("@lottiefiles/dotlottie-react").then((mod) => mod.DotLottieReact),
  { ssr: false },
);

type DotLottieInstance = {
  addEventListener: (event: string, handler: () => void) => void;
  removeEventListener: (event: string, handler: () => void) => void;
  setSpeed?: (speed: number) => void;
  set_speed?: (speed: number) => void;
};

export function AppSplashLoader({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const skipSplash = AUTH_PATHS.has(pathname);

  const [mounted, setMounted] = useState(false);
  const [showSplash, setShowSplash] = useState(!skipSplash);
  const [exiting, setExiting] = useState(false);
  const [lottieSrc, setLottieSrc] = useState<string | null>(null);
  const [player, setPlayer] = useState<DotLottieInstance | null>(null);
  const finishStarted = useRef(false);
  const mountedAt = useRef(0);
  const blobUrlRef = useRef<string | null>(null);

  const finishSplash = useCallback(() => {
    if (finishStarted.current || skipSplash) return;
    finishStarted.current = true;

    const elapsed = Date.now() - mountedAt.current;
    const wait = Math.max(0, MIN_SPLASH_MS - elapsed);

    window.setTimeout(() => {
      setExiting(true);
      window.setTimeout(() => setShowSplash(false), EXIT_MS);
    }, wait);
  }, [skipSplash]);

  useEffect(() => {
    if (skipSplash) {
      setShowSplash(false);
      setMounted(true);
      return;
    }

    let cancelled = false;
    mountedAt.current = Date.now();
    finishStarted.current = false;
    setMounted(true);
    setShowSplash(true);
    setExiting(false);
    setPlayer(null);

    const hardCap = window.setTimeout(finishSplash, SPLASH_HARD_CAP_MS);

    resolveSplashLottieSrc()
      .then((src) => {
        if (cancelled) {
          revokeSplashLottieSrc(src);
          return;
        }
        if (src.startsWith("blob:")) {
          blobUrlRef.current = src;
        }
        setLottieSrc(src);
      })
      .catch(() => {
        if (!cancelled) {
          setLottieSrc("/animations/fingerprint.lottie");
        }
      });

    return () => {
      cancelled = true;
      window.clearTimeout(hardCap);
      if (blobUrlRef.current) {
        revokeSplashLottieSrc(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [skipSplash, finishSplash]);

  useEffect(() => {
    if (skipSplash || !showSplash || !player) return;

    player.setSpeed?.(PLAYBACK_SPEED);
    player.set_speed?.(PLAYBACK_SPEED);

    const onComplete = () => finishSplash();
    player.addEventListener("complete", onComplete);

    const fallback = window.setTimeout(finishSplash, SPLASH_FALLBACK_MS);

    return () => {
      player.removeEventListener("complete", onComplete);
      window.clearTimeout(fallback);
    };
  }, [skipSplash, showSplash, player, finishSplash]);

  if (!mounted) {
    if (skipSplash) {
      return <>{children}</>;
    }

    return (
      <div
        className="min-h-screen bg-background"
        aria-busy="true"
        aria-label="Loading Fidence"
      />
    );
  }

  if (!showSplash) {
    return <>{children}</>;
  }

  const contentVisible = exiting;

  return (
    <>
      <div
        className={cn(
          "min-h-screen transition-opacity duration-200 ease-out",
          contentVisible ? "opacity-100" : "opacity-0",
        )}
        aria-hidden={!exiting}
      >
        {children}
      </div>

      <div
        className={cn(
          "fixed inset-0 z-[200] flex items-center justify-center bg-background transition-opacity duration-200 ease-out",
          exiting && "pointer-events-none opacity-0",
        )}
        aria-busy={!exiting}
        aria-label="Loading Fidence"
      >
        <div className="splash-lottie-primary flex flex-col items-center gap-4">
          {lottieSrc ? (
            <DotLottieReact
              src={lottieSrc}
              loop={false}
              autoplay
              className="h-24 w-64 max-w-[min(90vw,26rem)] sm:h-28"
              dotLottieRefCallback={(instance) => {
                setPlayer(instance as DotLottieInstance | null);
              }}
            />
          ) : (
            <div className="h-24 w-64 max-w-[min(90vw,26rem)] animate-pulse rounded-lg bg-muted/30 sm:h-28" />
          )}
        </div>
      </div>
    </>
  );
}
