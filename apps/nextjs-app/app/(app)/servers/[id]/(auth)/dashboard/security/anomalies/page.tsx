import { redirect } from "next/navigation";
import type { AnomalyFilterParams } from "@/lib/anomaly-filters";
import { getServerAnomalies } from "@/lib/db/locations";
import { getServer } from "@/lib/db/server";
import { AnomaliesContent } from "./AnomaliesContent";

const PAGE_SIZE = 50;

export default async function AnomaliesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    resolved?: string;
    severity?: string;
    userId?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: string;
  }>;
}) {
  const { id } = await params;
  const { resolved, severity, userId, dateFrom, dateTo, page } =
    await searchParams;

  const server = await getServer({ serverId: id });
  if (!server) {
    redirect("/");
  }

  const currentPage = Math.max(1, Number(page) || 1);
  const offset = (currentPage - 1) * PAGE_SIZE;

  const filters: AnomalyFilterParams = {
    resolved,
    severity,
    userId,
    dateFrom,
    dateTo,
  };

  const anomalyData = await getServerAnomalies(server.id, {
    ...filters,
    limit: PAGE_SIZE,
    offset,
  });

  const hasFilters = !!(userId || dateFrom || dateTo);

  return (
    <AnomaliesContent
      serverId={server.id}
      anomalies={anomalyData.anomalies}
      totalAnomalies={anomalyData.total}
      currentPage={currentPage}
      pageSize={PAGE_SIZE}
      hasLocationFilters={hasFilters}
      filters={filters}
    />
  );
}
