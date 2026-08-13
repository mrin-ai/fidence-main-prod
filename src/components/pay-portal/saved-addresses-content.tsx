"use client";

import { useCallback, useEffect, useState } from "react";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import type { SavedAddressSummary } from "@/lib/pay/types";
import { savedAddressInputSchema, type SavedAddressInput } from "@/lib/pay/saved-address-schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { dashboardCardClassName } from "@/lib/dashboard-styles";

const emptyForm: SavedAddressInput = {
  name: "",
  email: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "US",
};

export function SavedAddressesPageContent() {
  const [addresses, setAddresses] = useState<SavedAddressSummary[]>([]);
  const [form, setForm] = useState<SavedAddressInput>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/pay/saved-addresses");
    const data = (await res.json()) as { addresses?: SavedAddressSummary[] };
    setAddresses(data.addresses ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = savedAddressInputSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    setSaving(true);
    try {
      const url = editingId
        ? `/api/pay/saved-addresses/${editingId}`
        : "/api/pay/saved-addresses";
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Failed to save");
        return;
      }
      toast.success(editingId ? "Address updated" : "Address saved");
      setForm(emptyForm);
      setEditingId(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/pay/saved-addresses/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to delete");
      return;
    }
    toast.success("Address removed");
    await load();
  }

  function startEdit(address: SavedAddressSummary) {
    setEditingId(address.id);
    setForm({
      name: address.name,
      email: address.email ?? "",
      phone: address.phone ?? "",
      line1: address.line1,
      line2: address.line2 ?? "",
      city: address.city,
      state: address.state ?? "",
      postalCode: address.postalCode ?? "",
      country: address.country,
    });
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-6 py-8">
      <div>
        <h1 className="font-serif text-2xl tracking-tight">Saved addresses</h1>
        <p className="text-sm text-muted-foreground">
          Billing contacts used when agents request payments on your behalf.
        </p>
      </div>

      <Card className={dashboardCardClassName}>
        <CardHeader>
          <CardTitle className="text-base">{editingId ? "Edit address" : "Add address"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
            <FieldGroup className="grid gap-4 md:grid-cols-2">
              {(
                [
                  ["name", "Name"],
                  ["email", "Email"],
                  ["phone", "Phone"],
                  ["line1", "Address line 1"],
                  ["line2", "Address line 2"],
                  ["city", "City"],
                  ["state", "State"],
                  ["postalCode", "Postal code"],
                  ["country", "Country (ISO)"],
                ] as const
              ).map(([key, label]) => (
                <Field key={key}>
                  <FieldLabel>{label}</FieldLabel>
                  <Input
                    value={form[key]}
                    onChange={(event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))}
                  />
                </Field>
              ))}
            </FieldGroup>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {editingId ? "Update" : "Save"}
              </Button>
              {editingId ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingId(null);
                    setForm(emptyForm);
                  }}
                >
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className={dashboardCardClassName}>
        <CardHeader>
          <CardTitle className="text-base">Your addresses</CardTitle>
        </CardHeader>
        <CardContent>
          {addresses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No saved addresses yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {addresses.map((address) => (
                  <TableRow key={address.id}>
                    <TableCell>{address.name}</TableCell>
                    <TableCell>
                      {address.line1}, {address.city}, {address.country}
                    </TableCell>
                    <TableCell className="flex gap-1">
                      <Button type="button" variant="ghost" size="icon" onClick={() => startEdit(address)}>
                        <PencilIcon className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => void handleDelete(address.id)}
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
