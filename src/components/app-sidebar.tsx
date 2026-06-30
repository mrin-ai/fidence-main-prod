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
  workspace: {
    name: "LCX Ag",
    label: "Workspace",
  },
  user: {
    name: "Alex Rivera",
    role: "Owner",
    initials: "AR",
  },
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
          opensDrawer: "scan-qr",
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

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
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
                <span className="truncate font-semibold">{data.workspace.name}</span>
                <span className="truncate font-mono text-xs text-muted-foreground">
                  {data.workspace.label}
                </span>
              </div>
              <ChevronsUpDownIcon className="ml-auto size-4 text-muted-foreground" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain groups={data.navGroups} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
