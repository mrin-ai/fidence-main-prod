"use client"

import { useRouter } from "next/navigation"
import { useDisconnect } from "wagmi"
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { Switch } from "@/components/ui/switch"
import {
  NOTIFICATIONS_ENABLED_KEY,
  useLocalPreference,
} from "@/hooks/use-local-preference"
import {
  BellIcon,
  GiftIcon,
  HistoryIcon,
  LogOutIcon,
  SettingsIcon,
  UsersIcon,
} from "lucide-react"

export function NavUser({
  user,
}: {
  user: {
    name: string
    role: string
    initials: string
  }
}) {
  const { isMobile } = useSidebar()
  const router = useRouter()
  const { disconnect } = useDisconnect()
  const [notificationsEnabled, setNotificationsEnabled] = useLocalPreference(
    NOTIFICATIONS_ENABLED_KEY,
    true,
  )

  const handleLogOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    disconnect()
    router.push("/sign-in")
    router.refresh()
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="aria-expanded:bg-sidebar-accent"
              />
            }
          >
            <Avatar className="size-8 rounded-full">
              <AvatarFallback className="rounded-full bg-accent text-xs font-semibold text-primary">
                {user.initials}
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">{user.name}</span>
              <span className="truncate font-mono text-xs text-muted-foreground">
                {user.role}
              </span>
            </div>
            <SettingsIcon className="ml-auto size-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="size-8 rounded-full">
                    <AvatarFallback className="rounded-full bg-accent text-xs font-semibold text-primary">
                      {user.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="truncate font-mono text-xs text-muted-foreground">
                      {user.role}
                    </span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                className="flex items-center justify-between gap-3"
                onSelect={(event) => event.preventDefault()}
              >
                <span className="flex items-center gap-2">
                  <BellIcon />
                  Notifications
                </span>
                <Switch
                  checked={notificationsEnabled}
                  onCheckedChange={setNotificationsEnabled}
                  aria-label="Toggle notifications"
                  onClick={(event) => event.stopPropagation()}
                />
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/activity")}>
                <HistoryIcon />
                Activity
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/referrals")}>
                <UsersIcon />
                Referrals
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/rewards")}>
                <GiftIcon />
                Reward
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/settings")}>
                <SettingsIcon />
                Settings
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogOut}>
              <LogOutIcon />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
