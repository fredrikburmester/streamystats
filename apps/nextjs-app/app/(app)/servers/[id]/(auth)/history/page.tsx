import { redirect } from "next/navigation";
import { Container } from "@/components/Container";
import { PageTitle } from "@/components/PageTitle";
import {
  getHistory,
  getUniqueClientNames,
  getUniqueDeviceNames,
  getUniquePlayMethods,
  type HistoryResponse,
} from "@/lib/db/history";
import { getServer } from "@/lib/db/server";
import { getUsers, getViewerUserId } from "@/lib/db/users";
import { HistoryTable } from "./HistoryTable";

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
    startDate?: string;
    endDate?: string;
    userId?: string;
    itemType?: string;
    deviceName?: string;
    clientName?: string;
    playMethod?: string;
  }>;
}) {
  const { id } = await params;
  const {
    page,
    search,
    sort_by,
    sort_order,
    startDate,
    endDate,
    userId,
    itemType,
    deviceName,
    clientName,
    playMethod,
  } = await searchParams;
  const server = await getServer({ serverId: id });

  if (!server) {
    redirect("/setup");
  }

  const viewerUserId = await getViewerUserId();

  const [data, users, deviceNames, clientNames, playMethods] =
    await Promise.all([
      getHistory(
        server.id,
        Number.parseInt(page || "1", 10),
        50,
        search,
        sort_by,
        sort_order,
        {
          startDate,
          endDate,
          userId,
          itemType,
          deviceName,
          clientName,
          playMethod,
        },
        viewerUserId,
      ),
      getUsers({ serverId: server.id }),
      getUniqueDeviceNames(server.id),
      getUniqueClientNames(server.id),
      getUniquePlayMethods(server.id),
    ]);

  // Convert the data to match HistoryTable expectations
  const historyData: HistoryResponse = {
    page: data.page,
    perPage: data.perPage,
    totalCount: data.totalCount,
    totalPages: data.totalPages,
    data: data.data,
  };

  return (
    <Container className="flex flex-col">
      <PageTitle title="History" subtitle="View playback history." />
      <HistoryTable
        data={historyData}
        server={server}
        users={users}
        deviceNames={deviceNames}
        clientNames={clientNames}
        playMethods={playMethods}
      />
    </Container>
  );
}
