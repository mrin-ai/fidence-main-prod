"use client";

import {
  Columns2Icon,
  EyeIcon,
  FileTextIcon,
} from "lucide-react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";

export type InvoiceViewTab = "form" | "preview" | "both";

export function InvoiceTabSwitch({
  value,
  onChange,
}: {
  value: InvoiceViewTab;
  onChange: (value: InvoiceViewTab) => void;
}) {
  const isMobile = useIsMobile();

  return (
    <Select
      value={value}
      onValueChange={(next) => onChange(next as InvoiceViewTab)}
    >
      <SelectTrigger className="w-32">
        <SelectValue placeholder="View" />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectGroup>
          <SelectItem value="form">
            <FileTextIcon className="size-3.5" />
            Form
          </SelectItem>
          <SelectItem value="preview">
            <EyeIcon className="size-3.5" />
            Preview
          </SelectItem>
          {!isMobile ? (
            <SelectItem value="both">
              <Columns2Icon className="size-3.5" />
              Both
            </SelectItem>
          ) : null}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
