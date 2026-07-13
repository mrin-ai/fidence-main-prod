"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CommerceSource } from "@/lib/db/merchant-types";

export function CommerceSourceToggle({
  value,
  onChange,
}: {
  value: CommerceSource;
  onChange: (value: CommerceSource) => void;
}) {
  return (
    <Tabs
      value={value}
      onValueChange={(next) => onChange(next as CommerceSource)}
    >
      <TabsList>
        <TabsTrigger value="human">Human</TabsTrigger>
        <TabsTrigger value="agent">Agent</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
