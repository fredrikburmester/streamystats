"use client";

import { format, isValid, parseISO } from "date-fns";
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
import { useQueryParams } from "@/hooks/useQueryParams";
import { cn } from "@/lib/utils";
import { type FilterOption, MultiSelectFilter } from "./MultiSelectFilter";

const DATE_PARAM_FORMAT = "yyyy-MM-dd";

// No "Series": plays are recorded per episode, so it filtered on episodes too
// and unticking one of the two contradicted the other. Old ?itemType=Series
// links still work.
const ITEM_TYPE_OPTIONS: FilterOption[] = [
  { value: "Movie", label: "Movie" },
  { value: "Episode", label: "Episode" },
  { value: "Audio", label: "Audio" },
  { value: "MusicAlbum", label: "Music Album" },
  { value: "MusicArtist", label: "Music Artist" },
];

const asOptions = (values: string[]): FilterOption[] =>
  values.map((value) => ({ value, label: value }));

function parseDateParam(value: string | null): Date | undefined {
  if (!value) return undefined;
  const parsed = parseISO(value);
  if (!isValid(parsed)) return undefined;
  return parsed;
}

function formatDateParam(date: Date): string {
  return format(date, DATE_PARAM_FORMAT);
}

interface HistoryFiltersProps {
  users: { id: string; name: string }[];
  deviceNames: string[];
  clientNames: string[];
  playMethods: string[];
  hideUserFilter?: boolean;
}

export function HistoryFilters({
  users,
  deviceNames,
  clientNames,
  playMethods,
  hideUserFilter = false,
}: HistoryFiltersProps) {
  const searchParams = useSearchParams();
  const { updateQueryParams, isLoading } = useQueryParams();

  const [datePickerOpen, setDatePickerOpen] = React.useState(false);

  const dateRangeFromUrl = React.useMemo((): DateRange => {
    const from = parseDateParam(searchParams.get("startDate"));
    const to = parseDateParam(searchParams.get("endDate"));
    return { from, to };
  }, [searchParams]);

  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(
    dateRangeFromUrl,
  );

  React.useEffect(() => {
    if (!datePickerOpen) {
      setDateRange(dateRangeFromUrl);
    }
  }, [dateRangeFromUrl, datePickerOpen]);

  const dateRangeLabel = React.useMemo(() => {
    if (!dateRangeFromUrl?.from) return "Date range";
    if (!dateRangeFromUrl.to)
      return format(dateRangeFromUrl.from, "MMM dd, yyyy");
    return `${format(dateRangeFromUrl.from, "MMM dd, yyyy")} – ${format(dateRangeFromUrl.to, "MMM dd, yyyy")}`;
  }, [dateRangeFromUrl]);

  const handleDateRangeSelect = (range: DateRange | undefined) => {
    setDateRange(range);
  };

  const applyDateRange = () => {
    const params: Record<string, string | null> = { page: "1" };
    if (dateRange?.from) {
      params.startDate = formatDateParam(dateRange.from);
    } else {
      params.startDate = null;
    }
    if (dateRange?.to) {
      params.endDate = formatDateParam(dateRange.to);
    } else {
      params.endDate = null;
    }
    updateQueryParams(params);
    setDatePickerOpen(false);
  };

  const cancelDateRange = () => {
    setDateRange(dateRangeFromUrl);
    setDatePickerOpen(false);
  };

  const userOptions = React.useMemo(
    () => users.map((user) => ({ value: user.id, label: user.name })),
    [users],
  );
  const deviceOptions = React.useMemo(
    () => asOptions(deviceNames),
    [deviceNames],
  );
  const clientOptions = React.useMemo(
    () => asOptions(clientNames),
    [clientNames],
  );
  const methodOptions = React.useMemo(
    () => asOptions(playMethods),
    [playMethods],
  );

  const hasFilters = React.useMemo(() => {
    return !!(
      searchParams.get("startDate") ||
      searchParams.get("endDate") ||
      searchParams.get("userId") ||
      searchParams.get("itemType") ||
      searchParams.get("deviceName") ||
      searchParams.get("clientName") ||
      searchParams.get("playMethod")
    );
  }, [searchParams]);

  const clearFilters = () => {
    updateQueryParams({
      startDate: null,
      endDate: null,
      userId: null,
      itemType: null,
      deviceName: null,
      clientName: null,
      playMethod: null,
      page: "1",
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 pb-4">
      <Popover
        open={datePickerOpen}
        onOpenChange={(open) => {
          setDatePickerOpen(open);
          if (!open) {
            // If closed without applying, reset to URL state
            setDateRange(dateRangeFromUrl);
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-[240px] justify-start text-left font-normal",
              !dateRangeFromUrl?.from && "text-muted-foreground",
            )}
            disabled={isLoading}
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
            selected={dateRange}
            onSelect={handleDateRangeSelect}
            numberOfMonths={2}
            disabled={(date) => date > new Date()}
          />
          <div className="flex items-center justify-end gap-2 p-3 border-t">
            <Button variant="ghost" size="sm" onClick={cancelDateRange}>
              Cancel
            </Button>
            <Button size="sm" onClick={applyDateRange}>
              Apply
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {!hideUserFilter && (
        <MultiSelectFilter
          param="userId"
          noun="users"
          options={userOptions}
          className="w-[200px]"
          disabled={isLoading}
        />
      )}

      <MultiSelectFilter
        param="itemType"
        noun="types"
        options={ITEM_TYPE_OPTIONS}
        className="w-[160px]"
        disabled={isLoading}
      />

      {deviceNames.length > 0 && (
        <MultiSelectFilter
          param="deviceName"
          noun="devices"
          options={deviceOptions}
          className="w-[180px]"
          disabled={isLoading}
        />
      )}

      {clientNames.length > 0 && (
        <MultiSelectFilter
          param="clientName"
          noun="clients"
          options={clientOptions}
          className="w-[180px]"
          disabled={isLoading}
        />
      )}

      {playMethods.length > 0 && (
        <MultiSelectFilter
          param="playMethod"
          noun="methods"
          options={methodOptions}
          className="w-[180px]"
          disabled={isLoading}
        />
      )}

      {hasFilters && (
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
  );
}
