"use client";

import { Server } from "@/lib/db";
import { cn } from "@/lib/utils";
import {
  Check,
  ChevronsUpDown,
  GalleryVerticalEnd,
  PlusIcon,
  Star,
  StarOff,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useMemo } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { SidebarMenuButton } from "./ui/sidebar";
import { useAtom } from "jotai";
import { preferredServerIdAtom, serverOrderAtom } from "@/lib/atoms/serverAtom";

interface Props extends React.HTMLAttributes<HTMLButtonElement> {
  servers: Server[];
  allowedToCreateServer?: boolean;
}

export const ServerSelector: React.FC<Props> = ({
  servers,
  allowedToCreateServer = false,
  className,
  ...props
}) => {
  const params = useParams();
  const { id } = params as { id: string };
  const [preferredServerId, setPreferredServerId] = useAtom(
    preferredServerIdAtom
  );
  const [serverOrder, setServerOrder] = useAtom(serverOrderAtom);

  const currentServer = useMemo(() => {
    return servers.find((server) => server.id === Number(id));
  }, [servers, id]);

  const router = useRouter();

  const handleSetPreferred = (serverId: number) => {
    setPreferredServerId(serverId);
  };

  const handleRemovePreferred = () => {
    setPreferredServerId(null);
  };

  // Apply custom server order for display
  const orderedServers = useMemo(() => {
    if (serverOrder.length === 0) return servers;

    return serverOrder
      .map((id) => servers.find((s) => s.id === id))
      .filter((server): server is NonNullable<typeof server> => Boolean(server))
      .concat(servers.filter((s) => !serverOrder.includes(s.id)));
  }, [servers, serverOrder]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          data-size="lg"
          className={cn(
            "data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left outline-none ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-[[data-sidebar=menu-action]]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:!size-8  [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 h-12 text-sm group-data-[collapsible=icon]:!p-0",
            className
          )}
          {...props}
        >
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <GalleryVerticalEnd className="size-4" />
          </div>
          <div className="flex flex-col gap-0.5 leading-none">
            <span className="font-semibold flex items-center gap-1">
              Server
              {preferredServerId === currentServer?.id && (
                <Star className="size-3 fill-yellow-400 text-yellow-400" />
              )}
            </span>
            <span className="">{currentServer?.name || "N/A"}</span>
          </div>
          <ChevronsUpDown className="ml-auto" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-[--radix-dropdown-menu-trigger-width]"
        align="start"
      >
        {orderedServers.map((s) => (
          <DropdownMenuItem
            key={s.id}
            onSelect={() => {
              router.push(`/servers/${s.id}/login`);
            }}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              {preferredServerId === s.id && (
                <Star className="size-3 fill-yellow-400 text-yellow-400" />
              )}
              <span>{s.name}</span>
              {s.id === currentServer?.id && <Check className="size-4" />}
            </div>
          </DropdownMenuItem>
        ))}

        {servers.length > 0 && (
          <>
            <DropdownMenuSeparator />
            {currentServer && preferredServerId !== currentServer.id && (
              <DropdownMenuItem
                onSelect={() => handleSetPreferred(currentServer.id)}
                className="text-sm text-muted-foreground"
              >
                <Star className="size-4 mr-2" />
                Set as preferred server
              </DropdownMenuItem>
            )}
            {preferredServerId === currentServer?.id && (
              <DropdownMenuItem
                onSelect={handleRemovePreferred}
                className="text-sm text-muted-foreground"
              >
                <StarOff className="size-4 mr-2" />
                Remove as preferred
              </DropdownMenuItem>
            )}
          </>
        )}

        {allowedToCreateServer && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <a href={"/setup/"} className="flex flex-row items-center gap-2">
                <PlusIcon />
                <span>Add server</span>
              </a>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
