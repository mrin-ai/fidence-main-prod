"use client";

import * as React from "react";
import { Loader2Icon, MailIcon } from "lucide-react";
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
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { InvoiceStatus } from "@/lib/db/types";

export function ShareInvoiceDialog({
  open,
  onOpenChange,
  invoiceId,
  onShared,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  onShared?: (status?: InvoiceStatus) => void;
}) {
  const [to, setTo] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [isSending, setIsSending] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setTo("");
      setMessage("");
      setIsSending(false);
    }
  }, [open]);

  async function handleShare() {
    setIsSending(true);
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: to.trim(),
          message: message.trim() || undefined,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        to?: string;
        status?: InvoiceStatus;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to share invoice");
      }

      toast.success(`Invoice emailed to ${payload.to ?? to.trim()}`);
      onShared?.(payload.status);
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to share invoice",
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border/50 px-5 pt-5 pb-4">
          <DialogTitle>Share invoice</DialogTitle>
          <DialogDescription>
            Send an email with a secure payment link. You&apos;ll get notified
            when the payment is completed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-5 py-4">
          <Field>
            <FieldLabel>Recipient email</FieldLabel>
            <FieldContent>
              <Input
                type="email"
                autoFocus
                placeholder="client@company.com"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                disabled={isSending}
              />
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel>Message</FieldLabel>
            <FieldContent>
              <Textarea
                placeholder="Optional note for your client"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                disabled={isSending}
                className="min-h-24"
              />
              <FieldDescription>
                The email includes amount due and a Pay invoice button.
              </FieldDescription>
            </FieldContent>
          </Field>
        </div>

        <DialogFooter className="border-t border-border/50 bg-muted/20 px-5 py-4">
          <Button
            type="button"
            variant="outline"
            disabled={isSending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isSending || !to.trim()}
            onClick={() => void handleShare()}
          >
            {isSending ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <MailIcon className="size-4" />
            )}
            Send email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
