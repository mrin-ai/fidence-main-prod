"use client";

import type { ReactNode } from "react";
import dynamic from "next/dynamic";

import { cn } from "@/lib/utils";

const DotLottieReact = dynamic(
  () =>
    import("@lottiefiles/dotlottie-react").then((mod) => mod.DotLottieReact),
  {
    ssr: false,
    loading: () => <div className="size-28 animate-pulse rounded-full bg-muted/40" />,
  },
);

export function EmptyStateLottie({
  title,
  description,
  className,
  animationClassName,
  src = "/animations/empty-status.lottie",
  loop = true,
}: {
  title: string;
  description?: ReactNode;
  className?: string;
  animationClassName?: string;
  src?: string;
  loop?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-4 py-6 text-center",
        className,
      )}
    >
      <DotLottieReact
        src={src}
        loop={loop}
        autoplay
        className={cn("h-28 w-28", animationClassName)}
      />
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? (
          <div className="text-xs text-muted-foreground">{description}</div>
        ) : null}
      </div>
    </div>
  );
}
