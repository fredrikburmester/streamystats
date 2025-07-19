"use server";

import { DynamicBreadcrumbs } from "@/components/DynamicBreadcrumbs";
import ErrorBoundary from "@/components/ErrorBoundary";
import { JobStatusMonitor } from "@/components/JobStatusMonitor";
import { SideBar } from "@/components/SideBar";
import { SuspenseLoading } from "@/components/SuspenseLoading";
import { UpdateNotifier } from "@/components/UpdateNotifier";
import { Separator } from "@/components/ui/separator";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { getServers } from "@/lib/db/server";
import { getMe, isUserAdmin } from "@/lib/db/users";
import { redirect } from "next/navigation";
import { PropsWithChildren, Suspense } from "react";

interface Props extends PropsWithChildren {
  params: Promise<{ id: string }>;
}

export default async function layout({ children, params }: Props) {
  const { id } = await params;

  const servers = await getServers();

  const me = await getMe();
  const isAdmin = await isUserAdmin();

  if (!me) {
    redirect(`/servers/${id}/login`);
  }

  return (
    <SidebarProvider>
      <SideBar servers={servers} me={me} allowedToCreateServer={isAdmin} />
      <Suspense fallback={<SuspenseLoading />}>
        <ErrorBoundary>
          <main>
            <div className="flex flex-row items-center p-4 gap-2 relative">
              <SidebarTrigger />
              <Separator orientation="vertical" />
              <DynamicBreadcrumbs />
            </div>
            {children}
          </main>
        </ErrorBoundary>
      </Suspense>
      {isAdmin ? (
        <>
          <UpdateNotifier />
          <JobStatusMonitor />
        </>
      ) : null}
    </SidebarProvider>
  );
}
