import { FidenceLogoIcon } from "@/components/fidence-logo-icon";
import { cn } from "@/lib/utils";

interface FidenceLogoProps {
  className?: string;
  showWordmark?: boolean;
}

export function FidenceLogo({
  className,
  showWordmark = false,
}: FidenceLogoProps) {
  return (
    <span
      className={cn("inline-flex items-center gap-2.5 overflow-visible", className)}
      aria-label="Fidence"
    >
      <FidenceLogoIcon className="h-[115%] w-auto max-w-none" />
      {showWordmark ? (
        <span className="font-serif text-2xl tracking-tight text-foreground">
          Fidence
        </span>
      ) : null}
    </span>
  );
}
