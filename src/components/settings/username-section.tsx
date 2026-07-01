"use client"

import { useState } from "react"
import { CopyIcon, Loader2Icon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getPaymentBaseUrl } from "@/lib/payment-link-url"
import { cn } from "@/lib/utils"

function normalizeUsernameInput(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9_]/g, "")
}

export function UsernameSection({
  username: initialUsername,
  onSaved,
}: {
  username?: string
  onSaved: (username: string) => void
}) {
  const [username, setUsername] = useState(initialUsername ?? "")
  const [isSaving, setIsSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const preview = normalizeUsernameInput(username)
  const profileBaseUrl = preview
    ? `${getPaymentBaseUrl()}/${preview}`
    : `${getPaymentBaseUrl()}/username`

  async function handleCopyUrl() {
    if (!preview) return

    await navigator.clipboard.writeText(`${profileBaseUrl}/`)
    setCopied(true)
    toast.success("Profile URL copied")
    window.setTimeout(() => setCopied(false), 1500)
  }

  async function handleSave() {
    setIsSaving(true)

    try {
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "username",
          username: preview,
        }),
      })

      const data = (await response.json()) as {
        error?: string
        username?: string
      }

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save username")
      }

      const nextUsername = data.username ?? preview
      setUsername(nextUsername)
      onSaved(nextUsername)
      toast.success("Username saved")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save username"
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="divide-y divide-border/40 rounded-xl border border-border/60">
      <div className="flex items-center gap-2 px-4 py-3">
        <span className="font-mono text-xs text-muted-foreground/50">02</span>
        <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Username
        </h4>
      </div>

      <div className="space-y-4 px-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">
              @
            </span>
            <Input
              id="username"
              value={username}
              onChange={(event) =>
                setUsername(normalizeUsernameInput(event.target.value))
              }
              placeholder="alexrivera"
              className="pl-7 font-mono"
              autoComplete="username"
              spellCheck={false}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            3–30 characters. Lowercase letters, numbers, and underscores only.
          </p>
        </div>

        <div className="overflow-hidden rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-muted-foreground">
                Your profile URL
              </p>
              <p
                className={cn(
                  "mt-0.5 break-all font-mono text-xs leading-relaxed",
                  preview ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {profileBaseUrl}/
                <span className="text-muted-foreground">{`{link-id}`}</span>
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="mt-3 shrink-0 text-muted-foreground hover:text-primary"
              aria-label="Copy profile URL"
              disabled={!preview || preview.length < 3}
              onClick={handleCopyUrl}
            >
              <CopyIcon className="size-3.5" />
            </Button>
          </div>
          {copied ? (
            <p className="mt-2 text-[11px] text-primary">Copied to clipboard</p>
          ) : null}
        </div>
      </div>

      <div className="flex justify-end px-4 py-3">
        <Button
          size="sm"
          className="h-7 rounded-lg px-3 text-xs"
          onClick={handleSave}
          disabled={isSaving || preview.length < 3}
        >
          {isSaving ? (
            <>
              <Loader2Icon className="size-3 animate-spin" />
              Saving...
            </>
          ) : (
            "Save username"
          )}
        </Button>
      </div>
    </div>
  )
}
