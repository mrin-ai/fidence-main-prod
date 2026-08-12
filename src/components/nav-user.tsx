"use client"

import { useRouter } from "next/navigation"
import { useDisconnect } from "wagmi"
import { toast } from "sonner"
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
  CircleUserIcon,
  HistoryIcon,
  LogOutIcon,
  SettingsIcon,
  UsersIcon,
} from "lucide-react"
import { hasUsername } from "@/lib/onboarding"
import { buildProfilePath } from "@/lib/profile-url"

export function NavUser({
  user,
}: {
  user: {
    name: string
    role: string
    initials: string
    username: string | null
    hasVerifiedWallet: boolean
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

  const handleViewProfile = () => {
    if (!hasUsername(user.username)) {
      toast.error("Set up your username first to view your public profile.")
      return
    }

    if (!user.hasVerifiedWallet) {
      toast.error(
        "Verify at least one wallet before viewing your public profile.",
        {
          action: {
            label: "Go to Wallets",
            onClick: () => router.push("/wallets"),
          },
        },
      )
      return
    }

    router.push(buildProfilePath(user.username))
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                tooltip={user.name}
                className="aria-expanded:bg-sidebar-accent"
              />
            }
          >
            <Avatar className="size-8 rounded-full">
              <AvatarFallback className="rounded-full bg-accent text-xs font-semibold text-primary">
                {user.initials}
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
              <span className="truncate font-semibold">{user.name}</span>
              <span className="truncate font-mono text-xs text-muted-foreground">
                {user.role}
              </span>
            </div>
            <SettingsIcon className="ml-auto size-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
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
              <DropdownMenuItem
                className="justify-between gap-3"
                onClick={() => router.push("/activity")}
              >
                <span className="flex items-center gap-2">
                  <HistoryIcon />
                  Activity
                </span>
                <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[0.625rem] font-medium text-secondary-foreground">
                  New
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleViewProfile}>
                <CircleUserIcon />
                View profile
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled
                className="justify-between gap-3 text-muted-foreground"
              >
                <span className="flex items-center gap-2">
                  <UsersIcon />
                  Referrals
                </span>
                <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[0.625rem] font-medium text-secondary-foreground">
                  Soon
                </span>
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
