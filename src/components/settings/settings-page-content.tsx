"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useDisconnect } from "wagmi"
import { LogOutIcon } from "lucide-react"

import { PersonalInfoSection } from "@/components/settings/personal-info-section"
import type { SettingsUser } from "@/components/settings/settings-types"
import { UsernameSection } from "@/components/settings/username-section"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

function useLocalPreference(key: string, defaultValue: boolean) {
  const [value, setValue] = useState(defaultValue)

  useEffect(() => {
    const stored = window.localStorage.getItem(key)
    if (stored != null) {
      setValue(stored === "true")
    }
  }, [key])

  function updateValue(next: boolean) {
    setValue(next)
    window.localStorage.setItem(key, String(next))
  }

  return [value, updateValue] as const
}

export function SettingsPageContent({ user: initialUser }: { user: SettingsUser }) {
  const router = useRouter()
  const { disconnect } = useDisconnect()
  const [user, setUser] = useState(initialUser)
  const [blurPersonalInfo, setBlurPersonalInfo] = useLocalPreference(
    "lcx-blur-personal-info",
    false
  )

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" })
    disconnect()
    router.push("/sign-in")
    router.refresh()
  }

  return (
    <div className="w-full">
      <header className="sticky top-0 z-10 border-b border-border/40 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-4 md:px-6">
          <div className="md:hidden">
            <SidebarTrigger />
          </div>
          <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 p-4 md:p-6">
        <div className="grid items-start gap-4 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-6">
          <Card className="order-1 border-border/60 p-6 shadow-none lg:col-start-1 lg:row-start-1">
            <div className="flex flex-col items-center space-y-4 text-center">
              <Avatar className="size-20 overflow-hidden rounded-full ring-2 ring-border/50 ring-offset-2 ring-offset-background">
                <AvatarFallback
                  className={cn(
                    "bg-accent text-lg font-semibold text-primary",
                    blurPersonalInfo && "blur-sm"
                  )}
                >
                  {user.initials}
                </AvatarFallback>
              </Avatar>
              <div className="w-full space-y-1">
                <div className="flex items-center justify-center gap-2">
                  <h3
                    className={cn(
                      "text-base font-semibold",
                      blurPersonalInfo && "blur-sm"
                    )}
                  >
                    {user.name}
                  </h3>
                  {user.isProUser && (
                    <Badge className="rounded-lg bg-primary/10 text-primary hover:bg-primary/10">
                      Enterprise
                    </Badge>
                  )}
                </div>
                {user.username && (
                  <p
                    className={cn(
                      "font-mono text-xs text-primary",
                      blurPersonalInfo && "blur-sm"
                    )}
                  >
                    @{user.username}
                  </p>
                )}
                <p
                  className={cn(
                    "break-all text-xs text-muted-foreground",
                    blurPersonalInfo && "blur-sm"
                  )}
                >
                  {user.email ?? user.walletAddress ?? "No email on file"}
                </p>
                <p className="font-mono text-[11px] text-muted-foreground/70">
                  {user.role}
                </p>
              </div>
              <div className="flex w-full items-center justify-between pt-3">
                <Label
                  htmlFor="blur-personal"
                  className="text-xs text-muted-foreground"
                >
                  Blur personal info
                </Label>
                <Switch
                  id="blur-personal"
                  checked={blurPersonalInfo}
                  onCheckedChange={setBlurPersonalInfo}
                />
              </div>
              <div className="w-full pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2 text-muted-foreground hover:text-foreground"
                  onClick={handleSignOut}
                >
                  <LogOutIcon className="size-4" />
                  Sign out
                </Button>
              </div>
            </div>
          </Card>

          <div className="order-2 lg:col-start-1 lg:row-start-2">
            <UsernameSection
              username={user.username}
              onSaved={(username) => {
                setUser((current) => ({ ...current, username }))
                router.refresh()
              }}
            />
          </div>

          <div className="order-3 lg:col-start-2 lg:row-start-1 lg:row-span-2">
            <PersonalInfoSection
              email={user.email}
              profile={user.profile}
              onSaved={({ name, initials, profile }) => {
                setUser((current) => ({
                  ...current,
                  name,
                  initials,
                  profile,
                }))
                router.refresh()
              }}
            />
          </div>
        </div>
      </main>
    </div>
  )
}
