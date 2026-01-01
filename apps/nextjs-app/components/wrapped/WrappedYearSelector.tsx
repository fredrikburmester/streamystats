"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface WrappedYearSelectorProps {
  currentYear: number;
  availableYears: number[];
  serverId: number;
  userId?: string;
}

export function WrappedYearSelector({
  currentYear,
  availableYears,
  serverId,
  userId,
}: WrappedYearSelectorProps) {
  const router = useRouter();

  const handleYearChange = (year: string) => {
    const basePath = `/servers/${serverId}/wrapped/${year}`;
    const path = userId ? `${basePath}/${userId}` : basePath;
    router.push(path);
  };

  return (
    <Select value={currentYear.toString()} onValueChange={handleYearChange}>
      <SelectTrigger className="w-32 bg-background/10 border-white/20 text-white">
        <SelectValue placeholder="Year" />
      </SelectTrigger>
      <SelectContent>
        {availableYears.map((year) => (
          <SelectItem key={year} value={year.toString()}>
            {year}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
