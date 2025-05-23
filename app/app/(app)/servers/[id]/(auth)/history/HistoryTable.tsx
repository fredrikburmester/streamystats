"use client";

import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, ChevronDown, MoreHorizontal } from "lucide-react";
import * as React from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Server, UserPlaybackStatistics } from "@/lib/db";
import { formatDuration } from "@/lib/utils";
import { useRouter } from "nextjs-toploader/app";
import { useQueryParams } from "@/hooks/useQueryParams";
import { useSearchParams } from "next/navigation";
import { useDebounce } from "use-debounce";
import { Poster } from "@/app/(app)/servers/[id]/(auth)/dashboard/Poster";
import JellyfinAvatar from "@/components/JellyfinAvatar";
import { PlaybackMethodBadge } from "@/components/PlaybackMethodBadge";
import { getExternalUrl } from "@/utils/getServerUrl";

export interface HistoryTableProps {
  data: {
    page: number;
    per_page: number;
    total_items: number;
    total_pages: number;
    data: UserPlaybackStatistics[];
  };
  server: Server;
  hideUserColumn?: boolean;
}

export function HistoryTable({
  data,
  server,
  hideUserColumn = false,
}: HistoryTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { updateQueryParams, isLoading } = useQueryParams();

  // Get current values from URL query params
  const currentPage = Number(searchParams.get("page") || "1");
  const currentSearch = searchParams.get("search") || "";
  const currentSortBy = searchParams.get("sort_by") || "";
  const currentSortOrder = searchParams.get("sort_order") || "";

  // Local state for search input before debouncing
  const [searchInput, setSearchInput] = React.useState<string>(currentSearch);
  const [debouncedSearch] = useDebounce(searchInput, 500);

  // Update URL when debounced search changes
  React.useEffect(() => {
    if (debouncedSearch !== currentSearch) {
      updateQueryParams({
        search: debouncedSearch || null,
        page: "1", // Reset to first page on search change
      });
    }
  }, [debouncedSearch]);

  // Create sorting state based on URL parameters
  const sorting: SortingState = currentSortBy
    ? [{ id: currentSortBy, desc: currentSortOrder === "desc" }]
    : [];

  const handleSortChange = (columnId: string) => {
    if (currentSortBy !== columnId) {
      // New column, default to ascending
      updateQueryParams({
        sort_by: columnId,
        sort_order: "asc",
      });
    } else {
      // Same column, toggle direction
      updateQueryParams({
        sort_order: currentSortOrder === "asc" ? "desc" : "asc",
      });
    }
  };

  const columns: ColumnDef<UserPlaybackStatistics>[] = [
    {
      accessorKey: "item_name",
      header: "Item",
      cell: ({ row }) => (
        <a
          href={`${getExternalUrl(server)}/web/index.html#!/details?id=${
            row.original.item_id
          }`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-row items-center gap-4 cursor-pointer group"
        >
          <div className="shrink-0 rounded overflow-hidden transition-transform duration-200 group-hover:scale-105">
            <Poster
              item={{
                jellyfin_id: row.original.item_id,
                name: row.original.item_name,
                type: row.original.item_type as "Series" | "Episode" | "Movie",
                primary_image_tag: row.original.primary_image_tag,
                backdrop_image_tags: row.original.backdrop_image_tags,
                image_blur_hashes: row.original.image_blur_hashes,
                parent_backdrop_item_id: row.original.parent_backdrop_item_id,
                parent_backdrop_image_tags:
                  row.original.parent_backdrop_image_tags,
                parent_thumb_item_id: row.original.parent_thumb_item_id,
                parent_thumb_image_tag: row.original.parent_thumb_image_tag,
                primary_image_aspect_ratio:
                  row.original.primary_image_aspect_ratio,
                series_primary_image_tag: row.original.series_primary_image_tag,
                primary_image_thumb_tag: row.original.primary_image_thumb_tag,
                primary_image_logo_tag: row.original.primary_image_logo_tag,
              }}
              server={server}
            />
          </div>
          <div className="flex flex-col">
            <div className="capitalize font-medium transition-colors duration-200 group-hover:text-primary">
              {row.getValue("item_name")}
            </div>
            {row.original.series_name && (
              <div className="text-sm text-neutral-500 transition-colors duration-200 group-hover:text-primary/80">
                {row.original.series_name}
                {row.original.season_name && ` • ${row.original.season_name}`}
                {row.original.index_number &&
                  ` • Episode ${row.original.index_number}`}
              </div>
            )}
            <div className="text-sm text-neutral-500 transition-colors duration-200 group-hover:text-primary/80">
              {row.original.item_type}
              {row.original.play_duration &&
                ` • ${formatDuration(row.original.play_duration)}`}
            </div>
          </div>
        </a>
      ),
    },
    {
      accessorKey: "user_name",
      header: () => <div className="text-left">User</div>,
      cell: ({ row }) => {
        const user = row.getValue("user_name") as string;
        return (
          <div className="flex items-center gap-2">
            <Link
              href={`/servers/${server.id}/users/${row.original.jellyfin_user_id}`}
              className="flex items-center gap-2 cursor-pointer group"
            >
              <JellyfinAvatar
                user={{
                  id: row.original.jellyfin_user_id,
                  name: user,
                  jellyfin_id: row.original.jellyfin_user_id,
                }}
                serverUrl={getExternalUrl(server)}
                className="h-6 w-6 transition-transform duration-200 group-hover:scale-110"
              />
              <span className="font-medium transition-colors duration-200 group-hover:text-primary">
                {user}
              </span>
            </Link>
          </div>
        );
      },
    },
    {
      accessorKey: "play_method",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => handleSortChange("play_method")}
          >
            Play Method
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => (
        <PlaybackMethodBadge
          isVideoDirect={row.original.transcoding_is_video_direct}
          isAudioDirect={row.original.transcoding_is_audio_direct}
          videoCodec={row.original.transcoding_video_codec}
          audioCodec={row.original.transcoding_audio_codec}
          bitrate={row.original.transcoding_bitrate}
          playMethod={row.original.play_method}
          width={row.original.transcoding_width}
          height={row.original.transcoding_height}
          audioChannels={row.original.transcoding_audio_channels}
        />
      ),
    },
    {
      accessorKey: "remote_end_point",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => handleSortChange("remote_end_point")}
          >
            IP Address
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const ip = row.original.remote_end_point;
        return <div className="font-medium">{ip || "-"}</div>;
      },
    },
    {
      accessorKey: "client_name",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => handleSortChange("client_name")}
          >
            Client
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const client = row.original.client_name;
        return <div className="font-medium">{client || "-"}</div>;
      },
    },
    {
      accessorKey: "device_name",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => handleSortChange("device_name")}
          >
            Device
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const device = row.original.device_name;
        return <div className="font-medium">{device || "-"}</div>;
      },
    },
    {
      accessorKey: "date_created",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => handleSortChange("date_created")}
          >
            Date
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => (
        <div>
          {new Date(row.getValue("date_created")).toLocaleString("en-UK", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </div>
      ),
    },
  ];

  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({
      user_name: !hideUserColumn,
    });

  // Handle pagination with URL query params
  const handlePageChange = (newPage: number) => {
    updateQueryParams({
      page: newPage.toString(),
    });
  };

  // Update column visibility when hideUserColumn prop changes
  React.useEffect(() => {
    setColumnVisibility((prev) => ({
      ...prev,
      user_name: !hideUserColumn,
    }));
  }, [hideUserColumn]);

  const table = useReactTable({
    data: data?.data || [],
    columns,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
    manualPagination: true,
    pageCount: data?.total_pages || -1,
  });

  return (
    <div className="w-full">
      <div className="flex items-center py-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="ml-auto">
              Columns <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(!!value)
                    }
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                );
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between space-x-2 py-4">
        <div>
          <p className="text-sm text-neutral-500">
            {((data?.page || 0) - 1) * (data?.per_page || 20) + 1} -{" "}
            {((data?.page || 0) - 1) * (data?.per_page || 20) +
              (data?.data?.length || 0)}{" "}
            of {data?.total_items || 0} results.
          </p>
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1 || isLoading}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= (data?.total_pages || 1) || isLoading}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
