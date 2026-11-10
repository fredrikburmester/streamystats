"use client";

import { ChevronDown } from "lucide-react";
import { useSearchParams } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQueryParams } from "@/hooks/useQueryParams";
import {
  ALL_VALUES,
  allSelected,
  formatValueFilter,
  isSelected,
  parseValueFilter,
  toggleValue,
  type ValueFilter,
} from "@/lib/filter-values";
import { cn } from "@/lib/utils";

export interface FilterOption {
  value: string;
  label: string;
}

interface MultiSelectFilterProps {
  /** Query parameter holding the selection (see lib/filter-values). */
  param: string;
  options: FilterOption[];
  /** Plural noun for the trigger, e.g. "users" → "All users". */
  noun: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Checkbox dropdown for a history filter. Everything starts checked, so
 * "everyone except me" is one untick; unchecking "All" first switches to
 * picking only the checked values. Changes are applied when the menu
 * closes, so picking several values reloads the table once.
 */
export function MultiSelectFilter({
  param,
  options,
  noun,
  className,
  disabled,
}: MultiSelectFilterProps) {
  const searchParams = useSearchParams();
  const { updateQueryParams } = useQueryParams();
  const values = React.useMemo(() => options.map((o) => o.value), [options]);
  const raw = searchParams.get(param);
  const applied = React.useMemo(
    () => parseValueFilter(raw) ?? ALL_VALUES,
    [raw],
  );

  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<ValueFilter>(applied);

  React.useEffect(() => {
    if (!open) setDraft(applied);
  }, [applied, open]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) return;
    const value = formatValueFilter(draft, values);
    if (value !== raw) {
      updateQueryParams({ [param]: value, page: "1" });
    }
  };

  const everything = allSelected(draft, values);
  const label = triggerLabel(applied, options, noun);

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn("justify-between font-normal", className)}
          disabled={disabled}
          title={label}
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="max-h-[min(24rem,var(--radix-dropdown-menu-content-available-height))] w-56 overflow-y-auto"
      >
        <DropdownMenuCheckboxItem
          checked={everything}
          onSelect={(e) => e.preventDefault()}
          onCheckedChange={() =>
            setDraft(everything ? { mode: "include", values: [] } : ALL_VALUES)
          }
        >
          All {noun}
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={isSelected(draft, option.value)}
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={() =>
              setDraft((current) => toggleValue(current, option.value))
            }
          >
            {option.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function triggerLabel(
  filter: ValueFilter,
  options: FilterOption[],
  noun: string,
): string {
  const name = (value: string) =>
    options.find((o) => o.value === value)?.label ?? value;
  const listed = filter.values;
  if (listed.length === 0) return `All ${noun}`;
  if (filter.mode === "exclude") {
    return listed.length === 1
      ? `All except ${name(listed[0])}`
      : `All except ${listed.length} ${noun}`;
  }
  return listed.length === 1 ? name(listed[0]) : `${listed.length} ${noun}`;
}
