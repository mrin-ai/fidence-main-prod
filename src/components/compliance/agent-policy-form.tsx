"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeftIcon, ChevronsUpDownIcon } from "lucide-react";
import { toast } from "sonner";
import type { AgentListItem } from "@/lib/merchant-ui-types";
import { getPaymentTokenIcon, getPaymentTokenIconSize } from "@/lib/create-payment-link-data";
import { truncateAddress } from "@/lib/profile-url";
import { getWalletNetworkIcon } from "@/lib/wallet-networks";
import {
  createEmptyPolicyInput,
  getComplianceStatus,
  getPolicyStatus,
} from "@/lib/compliance/policy-helpers";
import { getPolicy, savePolicy } from "@/lib/compliance/policy-store";
import {
  COMPLIANCE_NETWORKS,
  COMPLIANCE_TOKENS,
  WIDE_OPEN_DAILY_CAP,
  type AgentPolicy,
  type AgentPolicyInput,
} from "@/lib/compliance/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

function getComplianceTokenIcon(id: string) {
  if (id === "lcx") return "/tokens/lcx.png";
  return getPaymentTokenIcon(id);
}

type MultiSelectOption = {
  id: string;
  label: string;
  iconSrc?: string;
  iconSize?: number;
};

type FormState = {
  maxAmountPerPayment: string;
  dailySpendCap: string;
  monthlySpendCap: string;
  allowedNetworkIds: string[];
  allowedTokenIds: string[];
  allowCreatePaymentLinks: boolean;
  allowPay: boolean;
  requireApproval: boolean;
  requireApprovalAbove: string;
};

type FormErrors = Partial<
  Record<
    | "maxAmountPerPayment"
    | "dailySpendCap"
    | "monthlySpendCap"
    | "allowedNetworkIds"
    | "allowedTokenIds"
    | "actions"
    | "requireApprovalAbove",
    string
  >
>;

function policyToForm(policy: AgentPolicy | null): FormState {
  const base = policy ?? createEmptyPolicyInput();
  return {
    maxAmountPerPayment: String(base.maxAmountPerPayment),
    dailySpendCap: String(base.dailySpendCap),
    monthlySpendCap:
      base.monthlySpendCap == null ? "" : String(base.monthlySpendCap),
    allowedNetworkIds: [...base.allowedNetworkIds],
    allowedTokenIds: [...base.allowedTokenIds],
    allowCreatePaymentLinks: base.allowCreatePaymentLinks,
    allowPay: base.allowPay,
    requireApproval: base.requireApprovalAbove != null,
    requireApprovalAbove:
      base.requireApprovalAbove == null
        ? ""
        : String(base.requireApprovalAbove),
  };
}

function parseNonNegative(value: string, label: string): number | string {
  if (value.trim() === "") return `${label} is required`;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return `${label} must be a valid number ≥ 0`;
  return n;
}

function toggleId(list: string[], id: string, checked: boolean) {
  if (checked) {
    if (list.includes(id)) return list;
    return [...list, id];
  }
  return list.filter((item) => item !== id);
}

function MultiSelectDropdown({
  label,
  placeholder,
  options,
  selectedIds,
  onChange,
  invalid,
  error,
}: {
  label: string;
  placeholder: string;
  options: MultiSelectOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  invalid?: boolean;
  error?: string;
}) {
  const selected = options.filter((option) => selectedIds.includes(option.id));
  const summary =
    selected.length === 0
      ? placeholder
      : selected.length <= 2
        ? selected.map((option) => option.label).join(", ")
        : `${selected.length} selected`;

  return (
    <Field data-invalid={invalid}>
      <FieldLabel>{label}</FieldLabel>
      <Popover>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              className={cn(
                "h-9 w-full justify-between px-3 font-normal",
                selected.length === 0 && "text-muted-foreground",
              )}
            />
          }
        >
          <span className="flex min-w-0 items-center gap-2">
            {selected.slice(0, 3).map((option) =>
              option.iconSrc ? (
                <Image
                  key={option.id}
                  src={option.iconSrc}
                  alt=""
                  width={option.iconSize ?? 16}
                  height={option.iconSize ?? 16}
                  className="shrink-0 object-contain"
                  style={{
                    width: option.iconSize ?? 16,
                    height: option.iconSize ?? 16,
                  }}
                />
              ) : null,
            )}
            <span className="truncate">{summary}</span>
          </span>
          <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--anchor-width)] p-1.5">
          <div className="flex flex-col gap-0.5">
            {options.map((option) => {
              const checked = selectedIds.includes(option.id);
              return (
                <label
                  key={option.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted/60",
                    checked && "bg-muted/40",
                  )}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) =>
                      onChange(toggleId(selectedIds, option.id, value === true))
                    }
                  />
                  {option.iconSrc ? (
                    <Image
                      src={option.iconSrc}
                      alt=""
                      width={option.iconSize ?? 16}
                      height={option.iconSize ?? 16}
                      className="shrink-0 object-contain"
                      style={{
                        width: option.iconSize ?? 16,
                        height: option.iconSize ?? 16,
                      }}
                    />
                  ) : null}
                  <span>{option.label}</span>
                </label>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  );
}

function PermissionChip({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors",
        checked
          ? "border-primary/30 bg-primary/5 text-foreground"
          : "border-border/70 bg-background text-muted-foreground hover:bg-muted/40",
      )}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
      />
      {label}
    </label>
  );
}

export function AgentPolicyForm({ agent }: { agent: AgentListItem }) {
  const [policy, setPolicy] = useState<AgentPolicy | null>(null);
  const [form, setForm] = useState<FormState>(() => policyToForm(null));
  const [errors, setErrors] = useState<FormErrors>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPolicy(agent.id)
      .then((existing) => {
        if (cancelled) return;
        setPolicy(existing);
        setForm(policyToForm(existing));
        setHydrated(true);
      })
      .catch(() => {
        if (cancelled) return;
        setHydrated(true);
        toast.error("Failed to load policy");
      });
    return () => {
      cancelled = true;
    };
  }, [agent.id]);

  const policyStatus = getPolicyStatus(policy);
  const compliance = getComplianceStatus(agent, policy);
  const isActive = policy?.status === "active";

  const walletLabel = useMemo(() => {
    if (!agent.walletAddress) return "No wallet";
    return truncateAddress(agent.walletAddress, 6);
  }, [agent.walletAddress]);

  function buildInput(
    status: "draft" | "active",
    mode: "draft" | "activate",
  ): { ok: true; input: AgentPolicyInput } | { ok: false; errors: FormErrors } {
    const nextErrors: FormErrors = {};

    const maxParsed = parseNonNegative(form.maxAmountPerPayment, "Max amount");
    const dailyParsed = parseNonNegative(form.dailySpendCap, "Daily spend cap");

    let maxAmount = 0;
    let dailyCap = 0;

    if (typeof maxParsed === "string") {
      nextErrors.maxAmountPerPayment = maxParsed;
    } else {
      maxAmount = maxParsed;
    }

    if (typeof dailyParsed === "string") {
      nextErrors.dailySpendCap = dailyParsed;
    } else {
      dailyCap = dailyParsed;
    }

    let monthlySpendCap: number | null = null;
    if (form.monthlySpendCap.trim() !== "") {
      const monthlyParsed = parseNonNegative(
        form.monthlySpendCap,
        "Monthly spend cap",
      );
      if (typeof monthlyParsed === "string") {
        nextErrors.monthlySpendCap = monthlyParsed;
      } else {
        monthlySpendCap = monthlyParsed;
      }
    }

    let requireApprovalAbove: number | null = null;
    if (form.requireApproval) {
      const approvalParsed = parseNonNegative(
        form.requireApprovalAbove,
        "Approval threshold",
      );
      if (typeof approvalParsed === "string") {
        nextErrors.requireApprovalAbove = approvalParsed;
      } else {
        requireApprovalAbove = approvalParsed;
      }
    }

    if (mode === "activate") {
      if (typeof maxParsed === "number" && maxParsed <= 0) {
        nextErrors.maxAmountPerPayment = "Max amount must be greater than 0";
      }
      if (
        typeof maxParsed === "number" &&
        typeof dailyParsed === "number" &&
        dailyParsed < maxParsed
      ) {
        nextErrors.dailySpendCap = "Daily cap must be ≥ max amount per payment";
      }
      if (form.allowedNetworkIds.length === 0) {
        nextErrors.allowedNetworkIds = "Select at least one network";
      }
      if (form.allowedTokenIds.length === 0) {
        nextErrors.allowedTokenIds = "Select at least one token";
      }
      if (!form.allowCreatePaymentLinks && !form.allowPay) {
        nextErrors.actions = "Allow at least one action";
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      return { ok: false, errors: nextErrors };
    }

    return {
      ok: true,
      input: {
        status,
        maxAmountPerPayment: maxAmount,
        dailySpendCap: dailyCap,
        monthlySpendCap,
        allowedNetworkIds: form.allowedNetworkIds,
        allowedTokenIds: form.allowedTokenIds,
        allowCreatePaymentLinks: form.allowCreatePaymentLinks,
        allowPay: form.allowPay,
        requireApprovalAbove,
      },
    };
  }

  async function persist(
    status: "draft" | "active",
    mode: "draft" | "activate",
    options?: { confirmWideOpen?: boolean },
  ) {
    const result = buildInput(status, mode);
    if (!result.ok) {
      setErrors(result.errors);
      toast.error("Fix the highlighted fields before continuing");
      return false;
    }

    setErrors({});
    try {
      const saved = await savePolicy(agent.id, result.input, options);
      setPolicy(saved);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save policy");
      return false;
    }
  }

  async function handleSaveDraft() {
    if (await persist("draft", "draft")) {
      toast.success("Policy saved as draft — agent remains blocked");
    }
  }

  async function handleActivateClick() {
    const result = buildInput("active", "activate");
    if (!result.ok) {
      setErrors(result.errors);
      toast.error("Fix the highlighted fields before activating");
      return;
    }

    if (result.input.dailySpendCap >= WIDE_OPEN_DAILY_CAP) {
      setConfirmOpen(true);
      return;
    }

    if (await persist("active", "activate")) {
      toast.success("Policy activated — agent can run within these rules");
    }
  }

  async function confirmActivate() {
    setConfirmOpen(false);
    if (await persist("active", "activate", { confirmWideOpen: true })) {
      toast.success("Policy activated — agent can run within these rules");
    }
  }

  async function handleDeactivate() {
    if (await persist("draft", "draft")) {
      toast.success("Policy deactivated — agent is blocked");
    }
  }

  if (!hydrated) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-6 text-sm text-muted-foreground lg:px-8 lg:py-8">
        Loading policy…
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6 pb-24 lg:px-8 lg:py-8">
      <div className="space-y-3">
        <Button
          size="sm"
          variant="ghost"
          className="-ml-2 text-muted-foreground"
          nativeButton={false}
          render={<Link href="/merchant/compliance" />}
        >
          <ArrowLeftIcon data-icon="inline-start" />
          Compliance Engine
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h2 className="truncate text-lg font-semibold tracking-tight">
              {agent.name}
            </h2>
            <p className="text-xs text-muted-foreground">
              <span className="font-mono">{agent.publicId}</span>
              <span className="mx-1.5 text-border">·</span>
              {walletLabel}
              {agent.networkId ? (
                <>
                  <span className="mx-1.5 text-border">·</span>
                  {agent.networkId}
                </>
              ) : null}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              variant="secondary"
              className={
                compliance === "compliant"
                  ? "bg-emerald-50 text-emerald-800"
                  : "bg-rose-50 text-rose-800"
              }
            >
              {compliance === "compliant" ? "Ready" : "Blocked"}
            </Badge>
            {policyStatus !== "none" ? (
              <Badge
                variant="secondary"
                className={
                  policyStatus === "active"
                    ? undefined
                    : "bg-amber-50 text-amber-800"
                }
              >
                {policyStatus === "active" ? "Active" : "Draft"}
              </Badge>
            ) : null}
          </div>
        </div>

        {compliance === "blocked" ? (
          <p className="rounded-lg border border-rose-200/70 bg-rose-50/60 px-3 py-2 text-xs text-rose-900">
            This agent can&apos;t create links or pay until you activate a
            policy
            {agent.status !== "active" ? " and enable the agent" : ""}.
          </p>
        ) : (
          <p className="rounded-lg border border-emerald-200/70 bg-emerald-50/60 px-3 py-2 text-xs text-emerald-900">
            Policy is active. Agent can run within the limits below.
          </p>
        )}
      </div>

      <Card className="border-border/60 shadow-none">
        <CardContent className="space-y-5 p-5">
          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-medium">Spend limits</h3>
              <p className="text-xs text-muted-foreground">Amounts in USD</p>
            </div>
            <FieldGroup className="grid gap-3 sm:grid-cols-3">
              <Field data-invalid={!!errors.maxAmountPerPayment}>
                <FieldLabel htmlFor="max-amount">Max payment</FieldLabel>
                <Input
                  id="max-amount"
                  type="number"
                  min={0}
                  step="any"
                  value={form.maxAmountPerPayment}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      maxAmountPerPayment: e.target.value,
                    }))
                  }
                />
                {errors.maxAmountPerPayment ? (
                  <FieldError>{errors.maxAmountPerPayment}</FieldError>
                ) : null}
              </Field>
              <Field data-invalid={!!errors.dailySpendCap}>
                <FieldLabel htmlFor="daily-cap">Daily cap</FieldLabel>
                <Input
                  id="daily-cap"
                  type="number"
                  min={0}
                  step="any"
                  value={form.dailySpendCap}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      dailySpendCap: e.target.value,
                    }))
                  }
                />
                {errors.dailySpendCap ? (
                  <FieldError>{errors.dailySpendCap}</FieldError>
                ) : null}
              </Field>
              <Field data-invalid={!!errors.monthlySpendCap}>
                <FieldLabel htmlFor="monthly-cap">Monthly cap</FieldLabel>
                <Input
                  id="monthly-cap"
                  type="number"
                  min={0}
                  step="any"
                  placeholder="Optional"
                  value={form.monthlySpendCap}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      monthlySpendCap: e.target.value,
                    }))
                  }
                />
                {errors.monthlySpendCap ? (
                  <FieldError>{errors.monthlySpendCap}</FieldError>
                ) : null}
              </Field>
            </FieldGroup>
          </section>

          <Separator />

          <section className="grid gap-4 sm:grid-cols-2">
            <MultiSelectDropdown
              label="Networks"
              placeholder="Select networks"
              options={COMPLIANCE_NETWORKS.map((network) => ({
                id: network.id,
                label: network.label,
                iconSrc: getWalletNetworkIcon(network.id),
                iconSize: network.id === "base" ? 12 : 16,
              }))}
              selectedIds={form.allowedNetworkIds}
              onChange={(ids) =>
                setForm((current) => ({
                  ...current,
                  allowedNetworkIds: ids,
                }))
              }
              invalid={!!errors.allowedNetworkIds}
              error={errors.allowedNetworkIds}
            />
            <MultiSelectDropdown
              label="Tokens"
              placeholder="Select tokens"
              options={COMPLIANCE_TOKENS.map((token) => ({
                id: token.id,
                label: token.label,
                iconSrc: getComplianceTokenIcon(token.id),
                iconSize: getPaymentTokenIconSize(token.id),
              }))}
              selectedIds={form.allowedTokenIds}
              onChange={(ids) =>
                setForm((current) => ({
                  ...current,
                  allowedTokenIds: ids,
                }))
              }
              invalid={!!errors.allowedTokenIds}
              error={errors.allowedTokenIds}
            />
          </section>

          <Separator />

          <section className="space-y-3">
            <h3 className="text-sm font-medium">Permissions</h3>
            <div className="flex flex-wrap gap-2">
              <PermissionChip
                label="Create payment links"
                checked={form.allowCreatePaymentLinks}
                onCheckedChange={(checked) =>
                  setForm((current) => ({
                    ...current,
                    allowCreatePaymentLinks: checked,
                  }))
                }
              />
              <PermissionChip
                label="Pay links / profiles"
                checked={form.allowPay}
                onCheckedChange={(checked) =>
                  setForm((current) => ({
                    ...current,
                    allowPay: checked,
                  }))
                }
              />
            </div>
            {errors.actions ? <FieldError>{errors.actions}</FieldError> : null}

            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2.5">
              <div className="min-w-0 space-y-0.5">
                <Label htmlFor="require-approval" className="text-sm">
                  Human approval above amount
                </Label>
                <p className="text-xs text-muted-foreground">
                  Optional confirm step for larger payments
                </p>
              </div>
              <Switch
                id="require-approval"
                checked={form.requireApproval}
                onCheckedChange={(checked) =>
                  setForm((current) => ({
                    ...current,
                    requireApproval: checked,
                  }))
                }
              />
            </div>
            {form.requireApproval ? (
              <Field
                className="max-w-[200px]"
                data-invalid={!!errors.requireApprovalAbove}
              >
                <FieldLabel htmlFor="approval-threshold">
                  Threshold (USD)
                </FieldLabel>
                <Input
                  id="approval-threshold"
                  type="number"
                  min={0}
                  step="any"
                  value={form.requireApprovalAbove}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      requireApprovalAbove: e.target.value,
                    }))
                  }
                />
                {errors.requireApprovalAbove ? (
                  <FieldError>{errors.requireApprovalAbove}</FieldError>
                ) : null}
              </Field>
            ) : null}
          </section>
        </CardContent>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border/60 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4 py-3 lg:px-8">
          <p className="hidden text-xs text-muted-foreground sm:block">
            {isActive
              ? "Policy is live for this agent"
              : "Save a draft or activate to allow payments"}
          </p>
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2 sm:flex-none">
            <Button type="button" variant="outline" onClick={handleSaveDraft}>
              Save draft
            </Button>
            {isActive ? (
              <Button
                type="button"
                variant="ghost"
                onClick={handleDeactivate}
              >
                Deactivate
              </Button>
            ) : null}
            <Button type="button" onClick={handleActivateClick}>
              {isActive ? "Update & keep active" : "Activate policy"}
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Activate with a high daily cap?</DialogTitle>
            <DialogDescription>
              Daily spend cap is ${form.dailySpendCap || "0"} (at or above $
              {WIDE_OPEN_DAILY_CAP.toLocaleString()}). Confirm you want this
              agent to run with that limit.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={confirmActivate}>
              Activate anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
