"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { AnomalyList } from "@/components/locations/AnomalyList";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSecurityEvents } from "@/hooks/useSecurityEvents";
import type { AnomalyFilterParams } from "@/lib/anomaly-filters";
import type { Anomaly } from "@/lib/db/locations";
import {
  resolveAllAnomalies,
  resolveAnomaliesByIds,
  resolveAnomaly,
  unresolveAnomaly,
} from "@/lib/db/locations";

interface AnomaliesContentProps {
  serverId: number;
  anomalies: Anomaly[];
  totalAnomalies: number;
  currentPage: number;
  pageSize: number;
  hasLocationFilters: boolean;
  filters: AnomalyFilterParams;
}

export function AnomaliesContent({
  serverId,
  anomalies,
  totalAnomalies,
  currentPage,
  pageSize,
  hasLocationFilters,
  filters,
}: AnomaliesContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [_isPending, startTransition] = useTransition();

  // Subscribe to real-time security events
  useSecurityEvents(serverId);

  const handleResolve = async (anomalyId: number, note?: string) => {
    await resolveAnomaly(serverId, anomalyId, { resolutionNote: note });
    startTransition(() => {
      router.refresh();
    });
  };

  const handleUnresolve = async (anomalyId: number) => {
    await unresolveAnomaly(serverId, anomalyId);
    startTransition(() => {
      router.refresh();
    });
  };

  const handleResolveAll = async () => {
    await resolveAllAnomalies(serverId, { filters });
    startTransition(() => {
      router.refresh();
    });
  };

  const handleResolveAllOnPage = async () => {
    const unresolvedIds = anomalies.filter((a) => !a.resolved).map((a) => a.id);
    if (unresolvedIds.length === 0) return;
    await resolveAnomaliesByIds(serverId, unresolvedIds);
    startTransition(() => {
      router.refresh();
    });
  };

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (page === 1) {
      params.delete("page");
    } else {
      params.set("page", page.toString());
    }
    router.push(`?${params.toString()}`);
  };

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    params.delete("page");
    router.push(`?${params.toString()}`);
  };

  const clearFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("resolved");
    params.delete("severity");
    params.delete("page");
    router.push(`?${params.toString()}`);
  };

  const hasAnomalyFilters = !!(
    searchParams.get("resolved") || searchParams.get("severity")
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Select
          value={searchParams.get("resolved") || "all"}
          onValueChange={(value) => handleFilterChange("resolved", value)}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="false">Open</SelectItem>
            <SelectItem value="true">Resolved</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={searchParams.get("severity") || "all"}
          onValueChange={(value) => handleFilterChange("severity", value)}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severity</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>

        {hasAnomalyFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </div>

      <AnomalyList
        anomalies={anomalies}
        serverId={serverId}
        showUserColumn={true}
        onResolve={handleResolve}
        onUnresolve={handleUnresolve}
        onResolveAll={handleResolveAll}
        onResolveAllOnPage={handleResolveAllOnPage}
        hasFilters={hasLocationFilters || hasAnomalyFilters}
        onClearFilters={clearFilters}
        totalCount={totalAnomalies}
        currentPage={currentPage}
        pageSize={pageSize}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
