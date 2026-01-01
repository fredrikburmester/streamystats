import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Container } from "@/components/Container";
import { WrappedContent } from "@/components/wrapped/WrappedContent";
import { WrappedLoading } from "@/components/wrapped/WrappedLoading";
import { getServer } from "@/lib/db/server";
import { getAvailableWrappedYears, getWrappedOverview } from "@/lib/db/wrapped";
import { getMe } from "@/lib/me";
import { formatDuration } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; year: string }>;
}): Promise<Metadata> {
  const { id, year } = await params;
  const server = await getServer({ serverId: id });
  const me = await getMe();

  if (!server || !me) {
    return { title: "Wrapped" };
  }

  const yearNum = Number.parseInt(year, 10);
  const overview = await getWrappedOverview({
    serverId: server.id,
    userId: me.id,
    year: yearNum,
  });

  const watchTime = formatDuration(overview.totalWatchTimeSeconds);

  return {
    title: `${me.name}'s ${year} Wrapped - Streamystats`,
    description: `${me.name} watched ${watchTime} of content in ${year}!`,
    openGraph: {
      title: `${me.name}'s ${year} Wrapped`,
      description: `Watched ${watchTime} of content in ${year}`,
      type: "website",
    },
  };
}

export default async function WrappedYearPage({
  params,
}: {
  params: Promise<{ id: string; year: string }>;
}) {
  const { id, year } = await params;
  const server = await getServer({ serverId: id });

  if (!server) {
    redirect("/");
  }

  const me = await getMe();
  if (!me) {
    redirect(`/servers/${id}/login`);
  }

  const yearNum = Number.parseInt(year, 10);
  if (Number.isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
    redirect(`/servers/${id}/wrapped`);
  }

  const availableYears = await getAvailableWrappedYears(server.id, me.id);
  if (!availableYears.includes(yearNum)) {
    redirect(`/servers/${id}/wrapped`);
  }

  return (
    <Container className="p-0 md:p-0">
      <Suspense fallback={<WrappedLoading />}>
        <WrappedContent
          serverId={server.id}
          userId={me.id}
          userName={me.name}
          year={yearNum}
          availableYears={availableYears}
          server={server}
        />
      </Suspense>
    </Container>
  );
}
