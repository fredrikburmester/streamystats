import { Container } from "@/components/Container";
import { PageTitle } from "@/components/PageTitle";
import { redirect } from "next/navigation";
import { HistoryTable } from "./HistoryTable";
import { getServer } from "@/lib/db/server";
import { getHistory, HistoryResponse } from "@/lib/db/history";

export default async function HistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    page?: string;
    search?: string;
    sort_by?: string;
    sort_order?: string;
  }>;
}) {
  const { id } = await params;
  const { page, search, sort_by, sort_order } = await searchParams;
  const server = await getServer(id);

  if (!server) {
    redirect("/setup");
  }

  const data = await getHistory(
    server.id,
    parseInt(page || "1", 10),
    50,
    search,
    sort_by,
    sort_order
  );

  // Convert the data to match HistoryTable expectations
  const historyData: HistoryResponse = {
    page: data.page,
    perPage: data.perPage,
    totalCount: data.totalCount,
    totalPages: data.totalPages,
    data: data.data,
  };

  return (
    <Container className="flex flex-col w-screen md:w-[calc(100vw-256px)]">
      <PageTitle title="History" subtitle="View playback history." />
      <HistoryTable data={historyData} server={server} />
    </Container>
  );
}
