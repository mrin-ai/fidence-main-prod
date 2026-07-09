"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { ChevronRightIcon } from "lucide-react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

type NavItem = {
  title: string
  url: string
  icon?: React.ReactNode
  badge?: string | number
  comingSoon?: boolean
  children?: NavItem[]
}

type NavGroup = {
  label: string
  items: NavItem[]
}

function NavSubItemBadge({ item }: { item: NavItem }) {
  if (item.comingSoon) {
    return (
      <span className="ml-auto shrink-0 rounded-md bg-secondary px-1.5 py-0.5 text-[0.625rem] font-medium text-secondary-foreground">
        Soon
      </span>
    )
  }

  if (item.badge) {
    return (
      <span className="ml-auto shrink-0 rounded-md bg-primary px-1.5 py-0.5 text-[0.625rem] font-medium text-primary-foreground tabular-nums">
        {item.badge}
      </span>
    )
  }

  return null
}

function NavItemBadge({ item }: { item: NavItem }) {
  if (item.comingSoon) {
    return (
      <SidebarMenuBadge
        className={cn("bg-secondary text-[0.625rem] text-secondary-foreground")}
      >
        Soon
      </SidebarMenuBadge>
    )
  }

  if (item.badge) {
    return (
      <SidebarMenuBadge className="bg-primary text-primary-foreground">
        {item.badge}
      </SidebarMenuBadge>
    )
  }

  return null
}

function NavLeafItem({
  item,
  pathname,
  nested = false,
}: {
  item: NavItem
  pathname: string
  nested?: boolean
}) {
  const isActive =
    !item.comingSoon &&
    item.url !== "#" &&
    (pathname === item.url || pathname.startsWith(`${item.url}/`))

  if (nested) {
    return (
      <SidebarMenuSubItem>
        {item.comingSoon ? (
          <SidebarMenuSubButton
            className="cursor-default text-muted-foreground opacity-70 hover:bg-transparent hover:text-muted-foreground"
            render={<button type="button" disabled aria-disabled />}
          >
            {item.icon}
            <span className="min-w-0 flex-1 truncate">{item.title}</span>
            <NavSubItemBadge item={item} />
          </SidebarMenuSubButton>
        ) : (
          <SidebarMenuSubButton
            isActive={isActive}
            render={<Link href={item.url} />}
          >
            {item.icon}
            <span className="min-w-0 flex-1 truncate">{item.title}</span>
            <NavSubItemBadge item={item} />
          </SidebarMenuSubButton>
        )}
      </SidebarMenuSubItem>
    )
  }

  return (
    <SidebarMenuItem>
      {item.comingSoon ? (
        <SidebarMenuButton
          tooltip={item.title}
          className="cursor-default text-muted-foreground opacity-70 hover:bg-transparent hover:text-muted-foreground"
          render={<button type="button" disabled aria-disabled />}
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
      <NavItemBadge item={item} />
    </SidebarMenuItem>
  )
}

function NavCollapsibleItem({
  item,
  pathname,
}: {
  item: NavItem
  pathname: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        tooltip={item.title}
        data-open={open}
        className="group/collapsible"
        onClick={() => setOpen((current) => !current)}
        render={<button type="button" />}
      >
        {item.icon}
        <span>{item.title}</span>
        <ChevronRightIcon
          className={cn(
            "ml-auto size-4 text-muted-foreground transition-transform",
            open && "rotate-90",
          )}
        />
      </SidebarMenuButton>
      {open ? (
        <SidebarMenuSub className="pb-1">
          {item.children?.map((child) => (
            <NavLeafItem
              key={child.title}
              item={child}
              pathname={pathname}
              nested
            />
          ))}
        </SidebarMenuSub>
      ) : null}
    </SidebarMenuItem>
  )
}

export function NavMain({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname()

  return (
    <>
      {groups.map((group) => (
        <SidebarGroup key={group.label}>
          <SidebarGroupLabel className="text-[0.6875rem] tracking-[0.08em] uppercase">
            {group.label}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) =>
                item.children?.length ? (
                  <NavCollapsibleItem
                    key={item.title}
                    item={item}
                    pathname={pathname}
                  />
                ) : (
                  <NavLeafItem
                    key={item.title}
                    item={item}
                    pathname={pathname}
                  />
                ),
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  )
}
