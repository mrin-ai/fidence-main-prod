import Image from "next/image";
import { cn } from "@/lib/utils";

interface LcxLogoProps {
  className?: string;
  priority?: boolean;
}

export function LcxLogo({ className, priority }: LcxLogoProps) {
  return (
    <Image
      src="/lcx-logo.png"
      alt="LCX"
      width={240}
      height={60}
      priority={priority}
      className={cn("h-auto w-auto object-contain", className)}
    />
  );
}
