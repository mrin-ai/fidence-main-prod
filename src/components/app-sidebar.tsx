"use client"

import * as React from "react"
import Image from "next/image"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { ScanQrNavIcon } from "@/components/scan-qr-drawer"
import {
  BotIcon,
  ChevronsUpDownIcon,
  Code2Icon,
  CreditCardIcon,
  FileTextIcon,
  GiftIcon,
  LayoutDashboardIcon,
  Link2Icon,
  ReceiptIcon,
  ScrollTextIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  UsersIcon,
} from "lucide-react"

const data = {
  navGroups: [
    {
      label: "Control Plane",
      items: [
        {
          title: "Overview",
          url: "/dashboard",
          icon: <LayoutDashboardIcon />,
        },
        {
          title: "Identities",
          url: "#",
          icon: <UsersIcon />,
          comingSoon: true,
        },
        {
          title: "Agents",
          url: "#",
          icon: <BotIcon />,
          comingSoon: true,
        },
        {
          title: "Approvals",
          url: "#",
          icon: <ShieldCheckIcon />,
          badge: 4,
          comingSoon: true,
        },
        {
          title: "Policies",
          url: "#",
          icon: <SlidersHorizontalIcon />,
          comingSoon: true,
        },
        {
          title: "Payments",
          url: "#",
          icon: <CreditCardIcon />,
        },
        {
          title: "Invoice",
          url: "#",
          icon: <FileTextIcon />,
          comingSoon: true,
        },
        {
          title: "Visa Intelligence",
          url: "#",
          icon: <SparklesIcon />,
          comingSoon: true,
        },
        {
          title: "Reward",
          url: "#",
          icon: <GiftIcon />,
          comingSoon: true,
        },
      ],
    },
    {
      label: "Commerce",
      items: [
        {
          title: "Transactions",
          url: "#",
          icon: <ReceiptIcon />,
        },
        {
          title: "Payment Links",
          url: "#",
          icon: <Link2Icon />,
        },
        {
          title: "Scan QR",
          url: "#",
          icon: <ScanQrNavIcon />,
          opensDrawer: "scan-qr" as const,
        },
      ],
    },
    {
      label: "Developer",
      items: [
        {
          title: "API & Webhooks",
          url: "#",
          icon: <Code2Icon />,
          comingSoon: true,
        },
        {
          title: "Audit logs",
          url: "#",
          icon: <ScrollTextIcon />,
          comingSoon: true,
        },
      ],
    },
  ],
}

export function AppSidebar({
  user,
  workspace,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: {
    name: string
    role: string
    initials: string
  }
  workspace: {
    name: string
    slug: string
  }
}) {
  const sidebarData = {
    workspace: {
      name: workspace.name,
      label: "Workspace",
    },
    user,
    navGroups: data.navGroups,
  }

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="data-[slot=sidebar-menu-button]:p-2!"
              render={<button type="button" />}
            >
              <div className="relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/50 bg-white">
                <Image
                  src="/logo.png"
                  alt="Fidence"
                  width={32}
                  height={32}
                  className="size-8 object-contain"
                  priority
                />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{sidebarData.workspace.name}</span>
                <span className="truncate font-mono text-xs text-muted-foreground">
                  {sidebarData.workspace.label}
                </span>
              </div>
              <ChevronsUpDownIcon className="ml-auto size-4 text-muted-foreground" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain groups={sidebarData.navGroups} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={sidebarData.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
