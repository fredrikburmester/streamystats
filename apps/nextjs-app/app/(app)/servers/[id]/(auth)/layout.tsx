import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { type PropsWithChildren, Suspense } from "react";
import { ChatDialogWrapper } from "@/components/ChatDialogWrapper";
import { DynamicBreadcrumbs } from "@/components/DynamicBreadcrumbs";
import ErrorBoundary from "@/components/ErrorBoundary";
import { GlobalSearch } from "@/components/GlobalSearch";
import { SideBar } from "@/components/SideBar";
import { SuspenseLoading } from "@/components/SuspenseLoading";
import { UpdateNotifier } from "@/components/UpdateNotifier";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { getServer, getServers } from "@/lib/db/server";
import { getMe, isUserAdmin } from "@/lib/db/users";

interface Props extends PropsWithChildren {
  params: Promise<{ id: string }>;
}

async function SideBarContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [servers, me, isAdmin] = await Promise.all([
    getServers(),
    getMe(),
    isUserAdmin(),
  ]);

  if (!me) {
    redirect(`/servers/${id}/login`);
  }

  return (
    <>
      <SideBar servers={servers} me={me} allowedToCreateServer={isAdmin} />
      {isAdmin && <UpdateNotifier />}
    </>
  );
}

async function HeaderContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [server, me] = await Promise.all([
    getServer({ serverId: id }),
    getMe(),
  ]);

  const chatConfigured = !!(server?.chatProvider && server?.chatModel);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center p-4 gap-2 relative">
      <div className="flex flex-row items-center gap-2">
        <SidebarTrigger />
        <Separator orientation="vertical" className="hidden sm:block" />
        <div className="min-w-0 max-w-[200px] lg:max-w-[300px] shrink">
          <DynamicBreadcrumbs />
        </div>
        <div className="ml-auto flex items-center gap-2 sm:hidden">
          <ChatDialogWrapper
            chatConfigured={chatConfigured}
            me={me ?? undefined}
            server={
              server
                ? { url: server.url, internalUrl: server.internalUrl }
                : undefined
            }
          />
        </div>
      </div>
      <div className="sm:hidden w-full">
        <GlobalSearch serverUrl={server?.url} />
      </div>
      <div className="hidden sm:flex flex-1 items-center gap-2">
        <GlobalSearch serverUrl={server?.url} />
        <ChatDialogWrapper
          chatConfigured={chatConfigured}
          me={me ?? undefined}
          server={
            server
              ? { url: server.url, internalUrl: server.internalUrl }
              : undefined
          }
        />
      </div>
    </div>
  );
}

function HeaderSkeleton() {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center p-4 gap-2 relative">
      <div className="flex flex-row items-center gap-2">
        <Skeleton className="h-8 w-8" />
        <Separator orientation="vertical" className="hidden sm:block" />
        <Skeleton className="h-4 w-48" />
        <div className="ml-auto flex items-center gap-2 sm:hidden">
          <Skeleton className="h-9 w-9" />
        </div>
      </div>
      <Skeleton className="sm:hidden h-9 w-full" />
      <div className="hidden sm:flex ml-auto items-center gap-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-9" />
      </div>
    </div>
  );
}

function SideBarSkeleton() {
  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarContent>
        <Skeleton className="h-full w-full" />
      </SidebarContent>
    </Sidebar>
  );
}

async function LayoutContent({ children, params }: Props) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <Suspense fallback={<SideBarSkeleton />}>
        <SideBarContent params={params} />
      </Suspense>
      <SidebarInset className="min-w-0">
        <ErrorBoundary>
          <Suspense fallback={<HeaderSkeleton />}>
            <HeaderContent params={params} />
          </Suspense>
          <Suspense fallback={<SuspenseLoading />}>{children}</Suspense>
        </ErrorBoundary>
      </SidebarInset>
    </SidebarProvider>
  );
}

function LayoutSkeleton() {
  return (
    <SidebarProvider>
      <SideBarSkeleton />
      <SidebarInset className="min-w-0">
        <HeaderSkeleton />
        <SuspenseLoading />
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function layout({ children, params }: Props) {
  return (
    <Suspense fallback={<LayoutSkeleton />}>
      <LayoutContent params={params}>{children}</LayoutContent>
    </Suspense>
  );
}
