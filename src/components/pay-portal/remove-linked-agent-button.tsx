"use client";

import { useState } from "react";
import { Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type RemoveLinkedAgentButtonProps = {
  agentId: string;
  agentName: string;
  onRemoved?: () => void;
  variant?: "outline" | "ghost" | "destructive";
  size?: "default" | "sm";
  className?: string;
};

export function RemoveLinkedAgentButton({
  agentId,
  agentName,
  onRemoved,
  variant = "outline",
  size = "sm",
  className,
}: RemoveLinkedAgentButtonProps) {
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function handleRemove() {
    setRemoving(true);
    try {
      const res = await fetch(`/api/pay/linked-agents/${encodeURIComponent(agentId)}/disconnect`, {
        method: "POST",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Failed to remove agent");
        return;
      }
      toast.success(`${agentName} removed`);
      setOpen(false);
      onRemoved?.();
    } finally {
      setRemoving(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={cn(variant === "outline" && "text-destructive hover:text-destructive", className)}
        onClick={() => setOpen(true)}
      >
        <Trash2Icon className="size-3.5" />
        Remove agent
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {agentName}?</DialogTitle>
            <DialogDescription>
              This revokes the agent&apos;s API key and disables payments. The agent will disappear
              from your Pay portal. You can connect it again later with{" "}
              <code className="rounded bg-muted px-1">fidence setup</code>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={removing}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={() => void handleRemove()} disabled={removing}>
              {removing ? "Removing…" : "Remove agent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
