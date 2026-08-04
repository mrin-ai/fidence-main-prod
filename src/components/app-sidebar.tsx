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
  SidebarRail,
} from "@/components/ui/sidebar"
import {
  BotIcon,
  Code2Icon,
  FileTextIcon,
  GiftIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  Link2Icon,
  ReceiptIcon,
  ShieldCheckIcon,
  StoreIcon,
  WalletIcon,
} from "lucide-react"

const data = {
  navGroups: [
    {
      label: "Menu",
      items: [
        {
          title: "Dashboard",
          url: "/dashboard",
          icon: <LayoutDashboardIcon />,
        },
        {
          title: "Wallets",
          url: "/wallets",
          icon: <WalletIcon />,
          isNew: true,
        },
        {
          title: "Invoices",
          url: "/manage-invoices",
          icon: <FileTextIcon />,
          isNew: true,
          children: [
            {
              title: "Create invoice",
              url: "/invoice/new",
              icon: <FileTextIcon />,
            },
            {
              title: "Manage invoices",
              url: "/manage-invoices",
              icon: <ReceiptIcon />,
            },
          ],
        },
        {
          title: "Payments",
          url: "/payment-links",
          icon: <Link2Icon />,
          children: [
            {
              title: "Payment links",
              url: "/payment-links",
              icon: <Link2Icon />,
            },
            {
              title: "Transactions",
              url: "/transactions",
              icon: <ReceiptIcon />,
            },
          ],
        },
        {
          title: "Reward",
          url: "/rewards",
          icon: <GiftIcon />,
        },
        {
          title: "Merchant",
          url: "/merchant/api-credentials",
          icon: <KeyRoundIcon />,
          children: [
            {
              title: "API credentials",
              url: "/merchant/api-credentials",
              icon: <KeyRoundIcon />,
            },
            {
              title: "Registered agents",
              url: "/merchant/agents",
              icon: <BotIcon />,
            },
            {
              title: "Compliance Engine",
              url: "/merchant/compliance",
              icon: <ShieldCheckIcon />,
            },
          ],
        },
      ],
    },
    {
      label: "Soon",
      items: [
        {
          title: "Intelligence Commerce",
          url: "#",
          icon: <StoreIcon />,
          comingSoon: true,
        },
        {
          title: "API & Webhooks",
          url: "#",
          icon: <Code2Icon />,
          comingSoon: true,
        },
      ],
    },
  ],
}

export function AppSidebar({
  user,
  workspace: _workspace,
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
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="Payagent"
              className="pointer-events-none group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:overflow-visible! group-data-[collapsible=icon]:p-0.5!"
              render={<div />}
            >
              <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-white group-data-[collapsible=icon]:size-full group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent">
                <Image
                  src="/logo.png"
                  alt="Payagent"
                  width={32}
                  height={32}
                  className="size-7 object-contain group-data-[collapsible=icon]:size-7"
                  priority
                />
              </div>
              <div className="flex min-w-0 flex-1 items-baseline gap-1.5 text-left font-serif text-xl tracking-tight leading-none group-data-[collapsible=icon]:hidden">
                <span className="truncate">Payagent</span>
                <span className="shrink-0 text-muted-foreground">by LCX</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain groups={data.navGroups} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
