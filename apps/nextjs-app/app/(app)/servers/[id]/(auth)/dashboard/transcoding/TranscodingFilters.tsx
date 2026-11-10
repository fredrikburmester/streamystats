"use client";
import {
  addDays,
  differenceInCalendarDays,
  format,
  isValid,
  parseISO,
} from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import * as React from "react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQueryParams } from "@/hooks/useQueryParams";

const DATE_PARAM_FORMAT = "yyyy-MM-dd";

function parseDateParam(value: string | null): Date | undefined {
  if (!value) return undefined;
  const parsed = parseISO(value);
  if (!isValid(parsed)) return undefined;
  return parsed;
}

function formatDateParam(date: Date): string {
  return format(date, DATE_PARAM_FORMAT);
}

interface TranscodingFiltersProps {
  users: { id: string; name: string }[];
  showUserFilter?: boolean;
}

export function TranscodingFilters({
  users,
  showUserFilter = true,
}: TranscodingFiltersProps) {
  const searchParams = useSearchParams();
  const { updateQueryParams, isLoading } = useQueryParams();
  const [datePickerOpen, setDatePickerOpen] = React.useState(false);

  const disableFutureDays = React.useCallback((date: Date) => {
    return date > new Date();
  }, []);

  const rangeFromUrl = React.useMemo((): DateRange | undefined => {
    const from = parseDateParam(searchParams.get("startDate"));
    const to = parseDateParam(searchParams.get("endDate"));

    if (from && to) {
      return { from, to };
    }

    return undefined;
  }, [searchParams]);

  const [range, setRange] = React.useState<DateRange | undefined>(rangeFromUrl);

  const activePreset = React.useMemo(() => {
    if (searchParams.get("startDate") === "all") return "all";
    if (!rangeFromUrl?.from || !rangeFromUrl?.to) return null;

    const days = differenceInCalendarDays(rangeFromUrl.to, rangeFromUrl.from);
    if (days === 7) return "7d";
    if (days === 30) return "30d";
    if (days === 90) return "90d";
    if (days === 365) return "365d";
    return null;
  }, [rangeFromUrl, searchParams]);

  React.useEffect(() => {
    if (!datePickerOpen) {
      setRange(rangeFromUrl);
    }
  }, [rangeFromUrl, datePickerOpen]);

  const commitRangeToUrl = React.useCallback(
    (next: DateRange) => {
      if (!next.from || !next.to) return;

      updateQueryParams({
        startDate: formatDateParam(next.from),
        endDate: formatDateParam(next.to),
      });
    },
    [updateQueryParams],
  );

  const handleDateSelect = React.useCallback((next: DateRange | undefined) => {
    setRange(next);
  }, []);

  const applyRange = () => {
    if (range?.from && range?.to) {
      commitRangeToUrl(range);
      setDatePickerOpen(false);
    }
  };

  const cancelRange = () => {
    setRange(rangeFromUrl);
    setDatePickerOpen(false);
  };

  const applyPreset = React.useCallback(
    (days: number) => {
      const to = new Date();
      const from = addDays(to, -days);
      const next = { from, to } satisfies DateRange;
      setRange(next);
      commitRangeToUrl(next);
      setDatePickerOpen(false);
    },
    [commitRangeToUrl],
  );

  const apply7d = React.useCallback(() => applyPreset(7), [applyPreset]);
  const apply30d = React.useCallback(() => applyPreset(30), [applyPreset]);
  const apply90d = React.useCallback(() => applyPreset(90), [applyPreset]);
  const apply365d = React.useCallback(() => applyPreset(365), [applyPreset]);

  const applyAll = React.useCallback(() => {
    updateQueryParams({
      startDate: "all",
      endDate: null,
    });
    setRange(undefined);
    setDatePickerOpen(false);
  }, [updateQueryParams]);

  const dateRangeLabel = React.useMemo(() => {
    if (searchParams.get("startDate") === "all") return "All time";
    if (!rangeFromUrl?.from) return "Date range";
    if (!rangeFromUrl.to) return format(rangeFromUrl.from, "MMM dd, yyyy");
    return `${format(rangeFromUrl.from, "MMM dd, yyyy")} – ${format(rangeFromUrl.to, "MMM dd, yyyy")}`;
  }, [rangeFromUrl, searchParams]);

  const selectedUserId = searchParams.get("userId") || "all";

  const handleUserChange = (value: string) => {
    updateQueryParams({
      userId: value === "all" ? null : value,
    });
  };

  const clearFilters = () => {
    updateQueryParams({
      startDate: null,
      endDate: null,
      userId: null,
    });
  };

  return (
    <div className="flex flex-col gap-4 mb-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Popover
            open={datePickerOpen}
            onOpenChange={(open) => {
              setDatePickerOpen(open);
              if (!open) {
                setRange(rangeFromUrl);
              }
            }}
          >
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                disabled={isLoading}
                className="justify-start text-left font-normal sm:w-[320px]"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRangeLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                captionLayout="dropdown"
                fromYear={2010}
                toYear={new Date().getFullYear()}
                numberOfMonths={2}
                defaultMonth={range?.from || new Date()}
                selected={range}
                onSelect={handleDateSelect}
                initialFocus
                disabled={disableFutureDays}
              />
              <div className="flex items-center justify-end gap-2 p-3 border-t">
                <Button variant="ghost" size="sm" onClick={cancelRange}>
                  Cancel
                </Button>
                <Button size="sm" onClick={applyRange}>
                  Apply
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {showUserFilter && (
            <Select
              value={selectedUserId}
              onValueChange={handleUserChange}
              disabled={isLoading}
            >
              <SelectTrigger className="w-full sm:w-[200px] ml-0 sm:ml-2">
                <SelectValue placeholder="All users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="flex gap-2 sm:justify-end">
          <Button
            type="button"
            variant={activePreset === "7d" ? "default" : "secondary"}
            size="sm"
            disabled={isLoading}
            onClick={apply7d}
          >
            7d
          </Button>
          <Button
            type="button"
            variant={activePreset === "30d" ? "default" : "secondary"}
            size="sm"
            disabled={isLoading}
            onClick={apply30d}
          >
            30d
          </Button>
          <Button
            type="button"
            variant={activePreset === "90d" ? "default" : "secondary"}
            size="sm"
            disabled={isLoading}
            onClick={apply90d}
          >
            90d
          </Button>
          <Button
            type="button"
            variant={activePreset === "365d" ? "default" : "secondary"}
            size="sm"
            disabled={isLoading}
            onClick={apply365d}
          >
            365d
          </Button>
          <Button
            type="button"
            variant={activePreset === "all" ? "default" : "secondary"}
            size="sm"
            disabled={isLoading}
            onClick={applyAll}
          >
            All
          </Button>

          {(searchParams.get("startDate") ||
            searchParams.get("endDate") ||
            searchParams.get("userId")) && (
            <Button
              variant="ghost"
              size="icon"
              onClick={clearFilters}
              title="Clear filters"
              disabled={isLoading}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
