"use client"

import { ActivityTimeline } from "@/components/activity-timeline"
import { AssignedAgents } from "@/components/assigned-agents"
import { Balance } from "@/components/balance"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const viewTabs = [
  { label: "Overview", value: "overview" },
  { label: "Payment Accounts", value: "payment-accounts" },
  { label: "Agents", value: "agents" },
  { label: "Policies", value: "policies" },
  { label: "Activity", value: "activity" },
  { label: "Permissions", value: "permissions" },
] as const

export function IdentitiesPageContent() {
  return (
    <div className="@container/main flex w-full flex-col px-4 py-6 lg:px-8 lg:py-8">
      <Tabs defaultValue="overview" className="w-full flex-col justify-start gap-0">
        <div className="flex items-center justify-between">
          <Label htmlFor="view-selector" className="sr-only">
            View
          </Label>
          <Select defaultValue="overview" items={[...viewTabs]}>
            <SelectTrigger
              className="flex w-fit @4xl/main:hidden"
              size="sm"
              id="view-selector"
            >
              <SelectValue placeholder="Select a view" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {viewTabs.map((tab) => (
                  <SelectItem key={tab.value} value={tab.value}>
                    {tab.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <TabsList className="hidden gap-2 p-1.5 @4xl/main:flex">
            {viewTabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="px-4">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <Separator className="my-6 bg-border" />

        <div className="grid items-start gap-6 lg:grid-cols-12">
          <AssignedAgents className="lg:col-span-5" />
          <Balance className="lg:col-span-3" />
          <ActivityTimeline className="lg:col-span-4" />
        </div>

        {viewTabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-6" />
        ))}
      </Tabs>
    </div>
  )
}
