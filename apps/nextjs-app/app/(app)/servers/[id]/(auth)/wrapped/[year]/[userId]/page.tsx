import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Container } from "@/components/Container";
import { WrappedContent } from "@/components/wrapped/WrappedContent";
import { WrappedLoading } from "@/components/wrapped/WrappedLoading";
import { getServer } from "@/lib/db/server";
import { getUserById, isUserAdmin } from "@/lib/db/users";
import { getAvailableWrappedYears, getWrappedOverview } from "@/lib/db/wrapped";
import { formatDuration } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; year: string; userId: string }>;
}): Promise<Metadata> {
  const { id, year, userId } = await params;
  const server = await getServer({ serverId: id });

  if (!server) {
    return { title: "Wrapped" };
  }

  const user = await getUserById({ userId, serverId: server.id });
  if (!user) {
    return { title: "Wrapped" };
  }

  const yearNum = Number.parseInt(year, 10);
  const overview = await getWrappedOverview({
    serverId: server.id,
    userId: user.id,
    year: yearNum,
  });

  const watchTime = formatDuration(overview.totalWatchTimeSeconds);

  return {
    title: `${user.name}'s ${year} Wrapped - Streamystats`,
    description: `${user.name} watched ${watchTime} of content in ${year}!`,
    openGraph: {
      title: `${user.name}'s ${year} Wrapped`,
      description: `Watched ${watchTime} of content in ${year}`,
      type: "website",
    },
  };
}

export default async function AdminWrappedPage({
  params,
}: {
  params: Promise<{ id: string; year: string; userId: string }>;
}) {
  const { id, year, userId } = await params;
  const server = await getServer({ serverId: id });

  if (!server) {
    redirect("/");
  }

  // Only admins can view other users' wrapped
  const isAdmin = await isUserAdmin();
  if (!isAdmin) {
    redirect(`/servers/${id}/wrapped/${year}`);
  }

  const user = await getUserById({ userId, serverId: server.id });
  if (!user) {
    redirect(`/servers/${id}/wrapped`);
  }

  const yearNum = Number.parseInt(year, 10);
  if (Number.isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
    redirect(`/servers/${id}/wrapped`);
  }

  const availableYears = await getAvailableWrappedYears(server.id, user.id);
  if (!availableYears.includes(yearNum)) {
    redirect(`/servers/${id}/wrapped`);
  }

  return (
    <Container className="p-0 md:p-0">
      <Suspense fallback={<WrappedLoading />}>
        <WrappedContent
          serverId={server.id}
          userId={user.id}
          userName={user.name}
          year={yearNum}
          availableYears={availableYears}
          server={server}
          isAdminView
        />
      </Suspense>
    </Container>
  );
}
