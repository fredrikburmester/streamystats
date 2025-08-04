"use client";

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
import { CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";

interface DateRangePickerProps {
  startDate?: Date;
  endDate?: Date;
  onDateChange: (type: "start" | "end", date: Date | undefined) => void;
  onPresetChange: (preset: string) => void;
  onClearDates: () => void;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onDateChange,
  onPresetChange,
  onClearDates,
}) => {
  const [startPopoverOpen, setStartPopoverOpen] = useState(false);
  const [endPopoverOpen, setEndPopoverOpen] = useState(false);

  const getCurrentPreset = () => {
    if (!startDate || !endDate) return "";
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    
    const yearAgo = new Date(today);
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);

    if (startDate.getTime() === today.getTime() && endDate.getTime() === today.getTime()) {
      return "today";
    } else if (startDate.getTime() === yesterday.getTime() && endDate.getTime() === yesterday.getTime()) {
      return "yesterday";
    } else if (startDate.getTime() === weekAgo.getTime() && endDate.getTime() === today.getTime()) {
      return "last7days";
    } else if (startDate.getTime() === monthAgo.getTime() && endDate.getTime() === today.getTime()) {
      return "last30days";
    } else if (startDate.getTime() === yearAgo.getTime() && endDate.getTime() === today.getTime()) {
      return "lastyear";
    }
    
    return "";
  };

  const handlePresetChange = (preset: string) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (preset) {
      case "today":
        onDateChange("start", today);
        onDateChange("end", today);
        break;
      case "yesterday":
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        onDateChange("start", yesterday);
        onDateChange("end", yesterday);
        break;
      case "last7days":
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        onDateChange("start", weekAgo);
        onDateChange("end", today);
        break;
      case "last30days":
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        onDateChange("start", monthAgo);
        onDateChange("end", today);
        break;
      case "lastyear":
        const yearAgo = new Date(today);
        yearAgo.setFullYear(yearAgo.getFullYear() - 1);
        onDateChange("start", yearAgo);
        onDateChange("end", today);
        break;
    }
    
    onPresetChange(preset);
  };

  return (
    <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
      <div className="flex items-center gap-2">
        <Popover open={startPopoverOpen} onOpenChange={setStartPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-[150px] justify-start text-left font-normal"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {startDate ? format(startDate, "MMM dd, yyyy") : "Start date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={startDate}
              onSelect={(date) => {
                onDateChange("start", date);
                setStartPopoverOpen(false);
              }}
              initialFocus
              disabled={(date) =>
                date > new Date() || (endDate ? date > endDate : false)
              }
            />
          </PopoverContent>
        </Popover>

        <span className="text-muted-foreground">to</span>

        <Popover open={endPopoverOpen} onOpenChange={setEndPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-[150px] justify-start text-left font-normal"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {endDate ? format(endDate, "MMM dd, yyyy") : "End date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={endDate}
              onSelect={(date) => {
                onDateChange("end", date);
                setEndPopoverOpen(false);
              }}
              initialFocus
              disabled={(date) =>
                date > new Date() || (startDate ? date < startDate : false)
              }
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex items-center gap-2">
        <Select value={getCurrentPreset()} onValueChange={handlePresetChange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Quick select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="yesterday">Yesterday</SelectItem>
            <SelectItem value="last7days">Last 7 days</SelectItem>
            <SelectItem value="last30days">Last 30 days</SelectItem>
            <SelectItem value="lastyear">Last year</SelectItem>
          </SelectContent>
        </Select>

        {(startDate || endDate) && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearDates}
            className="px-2"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};