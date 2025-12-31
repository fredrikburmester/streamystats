"use client";

import {
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import { ArrowUpDown, ChevronDown, Trash2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import * as React from "react";
import { useEffect } from "react";
import { useDebounce } from "use-debounce";
import { Poster } from "@/app/(app)/servers/[id]/(auth)/dashboard/Poster";
import JellyfinAvatar from "@/components/JellyfinAvatar";
import { PlaybackMethodBadge } from "@/components/PlaybackMethodBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
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
import { usePersistantState } from "@/hooks/usePersistantState";
import { useQueryParams } from "@/hooks/useQueryParams";
import type { HistoryItem, HistoryResponse } from "@/lib/db/history";
import { formatLocalDate } from "@/lib/timezone";
import type { ServerPublic } from "@/lib/types";
import { formatDuration } from "@/lib/utils";
import { HistoryFilters } from "./HistoryFilters";

export interface HistoryTableProps {
  data: HistoryResponse;
  server: ServerPublic;
  hideUserColumn?: boolean;
  users: { id: string; name: string }[];
  deviceNames: string[];
  clientNames: string[];
  playMethods: string[];
}

export function HistoryTable({
  data,
  server,
  hideUserColumn = false,
  users,
  deviceNames,
  clientNames,
  playMethods,
}: HistoryTableProps) {
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
  useEffect(() => {
    if (debouncedSearch !== currentSearch) {
      updateQueryParams({
        search: debouncedSearch || null,
        page: "1", // Reset to first page on search change
      });
    }
  }, [debouncedSearch, currentSearch, updateQueryParams]);

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

  const columns: ColumnDef<HistoryItem>[] = [
    {
      accessorFn: (row) => row.item?.name || row.session.itemName || "",
      id: "item_name",
      header: "Item",
      cell: ({ row }) => {
        const itemName =
          row.original.item?.name || row.original.session.itemName || "";
        const isDeleted =
          row.original.item?.deletedAt !== null &&
          row.original.item?.deletedAt !== undefined;
        return (
          <Link
            href={`/servers/${server.id}/library/${row.original.item?.id}`}
            className="flex flex-row items-center gap-4 cursor-pointer group"
          >
            <div
              className={`shrink-0 rounded overflow-hidden transition-transform duration-200 ${
                isDeleted ? "opacity-60 grayscale" : ""
              }`}
            >
              <Poster
                item={{
                  id: row.original.item?.id,
                  name: row.original.item?.name,
                  type: row.original.item?.type,
                  primaryImageTag: row.original.item?.primaryImageTag,
                  primaryImageThumbTag: row.original.item?.primaryImageThumbTag,
                  primaryImageLogoTag: row.original.item?.primaryImageLogoTag,
                  backdropImageTags: row.original.item?.backdropImageTags,
                  seriesId: row.original.item?.seriesId,
                  seriesPrimaryImageTag:
                    row.original.item?.seriesPrimaryImageTag,
                  parentBackdropItemId: row.original.item?.parentBackdropItemId,
                  parentBackdropImageTags:
                    row.original.item?.parentBackdropImageTags,
                  parentThumbItemId: row.original.item?.parentThumbItemId,
                  parentThumbImageTag: row.original.item?.parentThumbImageTag,
                  imageBlurHashes: row.original.item?.imageBlurHashes,
                }}
                server={server}
              />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <div className="capitalize font-medium transition-colors duration-200 group-hover:text-primary">
                  {itemName}
                </div>
                {isDeleted && (
                  <Badge variant="destructive" className="text-xs px-1.5 py-0">
                    <Trash2 className="w-3 h-3 mr-0.5" />
                    Removed
                  </Badge>
                )}
              </div>
              {row.original.item?.seriesName && (
                <div className="text-sm text-neutral-500 transition-colors duration-200 group-hover:text-primary/80">
                  {row.original.item?.seriesName}
                  {row.original.item?.seasonName &&
                    ` • ${row.original.item?.seasonName}`}
                  {row.original.item?.indexNumber &&
                    ` • Episode ${row.original.item?.indexNumber}`}
                </div>
              )}
              <div className="text-sm text-neutral-500 transition-colors duration-200 group-hover:text-primary/80">
                {row.original.item?.type}
                {row.original.session.playDuration &&
                  ` • ${formatDuration(row.original.session.playDuration)}`}
              </div>
            </div>
          </Link>
        );
      },
    },
    {
      accessorKey: "user_name",
      header: () => <div className="text-left">User</div>,
      cell: ({ row }) => {
        const user = row.getValue("user_name") as string;
        return (
          <div className="flex items-center gap-2">
            <Link
              href={`/servers/${server.id}/users/${row.original.user?.id}`}
              className="flex items-center gap-2 cursor-pointer group"
            >
              <JellyfinAvatar
                user={{
                  id: row.original.user?.id ?? "",
                  name: row.original.user?.name ?? null,
                  jellyfin_id: row.original.user?.id ?? null,
                }}
                server={server}
                className="h-6 w-6 transition-transform duration-200"
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
      header: () => {
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
          isVideoDirect={row.original.session.transcodingIsVideoDirect}
          isAudioDirect={row.original.session.transcodingIsAudioDirect}
          videoCodec={row.original.session.transcodingVideoCodec}
          audioCodec={row.original.session.transcodingAudioCodec}
          bitrate={row.original.session.transcodingBitrate}
          playMethod={row.original.session.playMethod}
          width={row.original.session.transcodingWidth}
          height={row.original.session.transcodingHeight}
          audioChannels={row.original.session.transcodingAudioChannels}
        />
      ),
    },
    {
      accessorKey: "remote_end_point",
      header: () => {
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
        const ip = row.original.session.remoteEndPoint;
        return <div className="font-medium">{ip || "-"}</div>;
      },
    },
    {
      accessorKey: "client_name",
      header: () => {
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
        const client = row.original.session.clientName;
        return <div className="font-medium">{client || "-"}</div>;
      },
    },
    {
      accessorKey: "device_name",
      header: () => {
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
        const device = row.original.session.deviceName;
        return <div className="font-medium">{device || "-"}</div>;
      },
    },
    {
      accessorKey: "session.startTime",
      header: () => {
        return (
          <Button
            variant="ghost"
            onClick={() => handleSortChange("start_time")}
          >
            Date
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const dateValue = row.original.session.startTime;
        if (!dateValue) {
          return <div>No Date</div>;
        }

        const date = new Date(dateValue);
        if (Number.isNaN(date.getTime())) {
          return <div>Invalid Date</div>;
        }

        return <div>{formatLocalDate(date, "d MMM yyyy, HH:mm")}</div>;
      },
    },
  ];

  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [columnVisibility, setColumnVisibility, _isLoadingVisibility] =
    usePersistantState<VisibilityState>(
      `history-column-visibility-${server.id}`,
      {
        user_name: !hideUserColumn,
      },
    );

  // Handle pagination with URL query params
  const handlePageChange = (newPage: number) => {
    updateQueryParams({
      page: newPage.toString(),
    });
  };

  // Update column visibility when hideUserColumn prop changes
  useEffect(() => {
    setColumnVisibility((prev) => ({
      ...prev,
      user_name: !hideUserColumn,
    }));
  }, [hideUserColumn, setColumnVisibility]);

  const table = useReactTable({
    data: data.data || [],
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
    pageCount: data?.totalPages || -1,
  });

  return (
    <div className="w-full">
      <div className="flex flex-col">
        <HistoryFilters
          users={users}
          deviceNames={deviceNames}
          clientNames={clientNames}
          playMethods={playMethods}
        />
      </div>
      <div className="flex items-center pb-4">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search items or users..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="max-w-sm"
          />
        </div>
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
                            header.getContext(),
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
                        cell.getContext(),
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
            {((data?.page || 0) - 1) * (data?.perPage || 20) + 1} -{" "}
            {((data?.page || 0) - 1) * (data?.perPage || 20) +
              (data?.data?.length || 0)}{" "}
            of {data?.totalCount || 0} results.
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
            disabled={currentPage >= (data?.totalPages || 1) || isLoading}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
