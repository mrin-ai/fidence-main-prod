"use client"

import * as React from "react"

import { FidenceLogoIcon } from "@/components/fidence-logo-icon"
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
  CreditCardIcon,
  FileTextIcon,
  GiftIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  Link2Icon,
  ReceiptIcon,
  ShieldCheckIcon,
  StoreIcon,
  UsersIcon,
  WalletIcon,
  WebhookIcon,
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
          title: "Pay",
          url: "/pay/agents",
          icon: <CreditCardIcon />,
          featureFlag: "pay" as const,
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
            {
              title: "Webhooks",
              url: "/merchant/webhooks",
              icon: <WebhookIcon />,
            },
          ],
        },
      ],
    },
    {
      label: "Soon",
      items: [
        {
          title: "Rewards",
          url: "#",
          icon: <GiftIcon />,
          comingSoon: true,
        },
        {
          title: "Referrals",
          url: "#",
          icon: <UsersIcon />,
          comingSoon: true,
        },
        {
          title: "Intelligence Commerce",
          url: "#",
          icon: <StoreIcon />,
          comingSoon: true,
        },
        {
          title: "API docs",
          url: "/docs",
          icon: <Code2Icon />,
        },
      ],
    },
  ],
}

export function AppSidebar({
  user,
  workspace: _workspace,
  payEnabled = true,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: {
    name: string
    role: string
    initials: string
    username: string | null
    hasVerifiedWallet: boolean
  }
  workspace: {
    name: string
    slug: string
  }
  payEnabled?: boolean
}) {
  const navGroups = React.useMemo(() => {
    if (payEnabled) return data.navGroups
    return data.navGroups.map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !("featureFlag" in item && item.featureFlag === "pay"),
      ),
    }))
  }, [payEnabled])

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="Fidence"
              className="pointer-events-none group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:overflow-visible! group-data-[collapsible=icon]:p-0.5!"
              render={<div />}
            >
              <div className="flex aspect-square size-8 shrink-0 items-center justify-center overflow-visible rounded-lg border border-border/50 bg-white group-data-[collapsible=icon]:size-full group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent">
                <FidenceLogoIcon className="size-8 scale-[1.35] group-data-[collapsible=icon]:size-6 group-data-[collapsible=icon]:scale-100" />
              </div>
              <div className="flex min-w-0 flex-1 items-baseline text-left font-serif text-xl tracking-tight leading-none group-data-[collapsible=icon]:hidden">
                <span className="truncate">Fidence</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain groups={navGroups} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
