"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { useScanQr } from "@/components/scan-qr-drawer"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

type NavItem = {
  title: string
  url: string
  icon?: React.ReactNode
  badge?: string | number
  comingSoon?: boolean
  opensDrawer?: "scan-qr"
}

type NavGroup = {
  label: string
  items: NavItem[]
}

export function NavMain({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname()
  const { openScanQr } = useScanQr()

  return (
    <>
      {groups.map((group) => (
        <SidebarGroup key={group.label}>
          <SidebarGroupLabel className="text-[0.6875rem] tracking-[0.08em] uppercase">
            {group.label}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => {
                const isActive =
                  !item.comingSoon &&
                  !item.opensDrawer &&
                  item.url !== "#" &&
                  (pathname === item.url || pathname.startsWith(`${item.url}/`))

                return (
                  <SidebarMenuItem key={item.title}>
                    {item.comingSoon ? (
                      <SidebarMenuButton
                        tooltip={item.title}
                        className="cursor-default text-muted-foreground opacity-70 hover:bg-transparent hover:text-muted-foreground"
                        render={<button type="button" disabled aria-disabled />}
                      >
                        {item.icon}
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    ) : item.opensDrawer === "scan-qr" ? (
                      <SidebarMenuButton
                        tooltip={item.title}
                        render={
                          <button
                            type="button"
                            onClick={() => openScanQr()}
                          />
                        }
                      >
                        {item.icon}
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    ) : (
                      <SidebarMenuButton
                        tooltip={item.title}
                        isActive={isActive}
                        render={<Link href={item.url} />}
                      >
                        {item.icon}
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    )}
                    {item.comingSoon ? (
                      <SidebarMenuBadge
                        className={cn(
                          "bg-secondary text-[0.625rem] text-secondary-foreground"
                        )}
                      >
                        Soon
                      </SidebarMenuBadge>
                    ) : item.badge ? (
                      <SidebarMenuBadge className="bg-primary text-primary-foreground">
                        {item.badge}
                      </SidebarMenuBadge>
                    ) : null}
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  )
}
