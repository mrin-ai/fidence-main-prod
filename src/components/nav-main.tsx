"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { ChevronRightIcon } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  useSidebar,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

type NavItem = {
  title: string
  url: string
  icon?: React.ReactNode
  badge?: string | number
  comingSoon?: boolean
  isNew?: boolean
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

  if (item.isNew) {
    return (
      <span className="ml-auto shrink-0 rounded-md bg-secondary px-1.5 py-0.5 text-[0.625rem] font-medium text-secondary-foreground">
        New
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

  if (item.isNew) {
    return (
      <SidebarMenuBadge
        className={cn("bg-secondary text-[0.625rem] text-secondary-foreground")}
      >
        New
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
  const router = useRouter()
  const { state, isMobile } = useSidebar()
  const childActive = item.children?.some(
    (child) =>
      !child.comingSoon &&
      child.url !== "#" &&
      (pathname === child.url || pathname.startsWith(`${child.url}/`)),
  )
  const [open, setOpen] = useState(Boolean(childActive))

  useEffect(() => {
    if (childActive) setOpen(true)
  }, [childActive])

  if (state === "collapsed" && !isMobile) {
    return (
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                tooltip={item.title}
                isActive={childActive}
              />
            }
          >
            {item.icon}
            <span>{item.title}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56"
            side="right"
            align="start"
            sideOffset={8}
          >
            <DropdownMenuLabel>{item.title}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {item.children?.map((child) =>
              child.comingSoon ? (
                <DropdownMenuItem
                  key={child.title}
                  disabled
                  className="text-muted-foreground"
                >
                  {child.icon}
                  <span>{child.title}</span>
                  <span className="ml-auto rounded-md bg-secondary px-1.5 py-0.5 text-[0.625rem] font-medium text-secondary-foreground">
                    Soon
                  </span>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  key={child.title}
                  onClick={() => router.push(child.url)}
                >
                  {child.icon}
                  <span>{child.title}</span>
                </DropdownMenuItem>
              ),
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    )
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        tooltip={item.title}
        data-open={open}
        isActive={childActive}
        className="group/collapsible"
        onClick={() => setOpen((current) => !current)}
        render={<button type="button" />}
      >
        {item.icon}
        <span>{item.title}</span>
        {item.isNew ? (
          <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[0.625rem] font-medium text-secondary-foreground group-data-[collapsible=icon]:hidden">
            New
          </span>
        ) : null}
        <ChevronRightIcon
          className={cn(
            "ml-auto size-4 text-muted-foreground transition-transform group-data-[collapsible=icon]:hidden",
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
