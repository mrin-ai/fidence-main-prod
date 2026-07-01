"use client"

import { useState } from "react"
import { Loader2Icon } from "lucide-react"
import { toast } from "sonner"

import type { SettingsUserProfile } from "@/components/settings/settings-types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function PersonalInfoSection({
  email,
  profile,
  onSaved,
}: {
  email?: string
  profile: SettingsUserProfile
  onSaved: (next: { name: string; initials: string; profile: SettingsUserProfile }) => void
}) {
  const [firstName, setFirstName] = useState(profile.firstName ?? "")
  const [lastName, setLastName] = useState(profile.lastName ?? "")
  const [phone, setPhone] = useState(profile.phone ?? "")
  const [company, setCompany] = useState(profile.company ?? "")
  const [isSaving, setIsSaving] = useState(false)

  async function handleSave() {
    setIsSaving(true)

    try {
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "personal",
          firstName,
          lastName,
          phone,
          company,
        }),
      })

      const data = (await response.json()) as {
        error?: string
        name?: string
        initials?: string
        profile?: SettingsUserProfile
      }

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save personal information")
      }

      onSaved({
        name: data.name ?? [firstName, lastName].filter(Boolean).join(" "),
        initials: data.initials ?? "",
        profile: data.profile ?? {
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          phone: phone || undefined,
          company: company || undefined,
        },
      })

      toast.success("Personal information saved")
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save personal information"
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="divide-y divide-border/40 rounded-xl border border-border/60">
      <div className="flex items-center gap-2 px-4 py-3">
        <span className="font-mono text-xs text-muted-foreground/50">01</span>
        <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Personal information
        </h4>
      </div>

      <div className="space-y-4 px-4 py-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="first-name">First name</Label>
            <Input
              id="first-name"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              placeholder="Alex"
              autoComplete="given-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="last-name">Last name</Label>
            <Input
              id="last-name"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              placeholder="Rivera"
              autoComplete="family-name"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            value={email ?? ""}
            disabled
            placeholder="Not linked"
          />
          <p className="text-[11px] text-muted-foreground">
            Email is managed through your sign-in method.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+1 (555) 000-0000"
            autoComplete="tel"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="company">Company</Label>
          <Input
            id="company"
            value={company}
            onChange={(event) => setCompany(event.target.value)}
            placeholder="LCX AG"
            autoComplete="organization"
          />
        </div>
      </div>

      <div className="flex justify-end px-4 py-3">
        <Button
          size="sm"
          className="h-7 rounded-lg px-3 text-xs"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <>
              <Loader2Icon className="size-3 animate-spin" />
              Saving...
            </>
          ) : (
            "Save changes"
          )}
        </Button>
      </div>
    </div>
  )
}
