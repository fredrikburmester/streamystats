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
import { ArrowUpDown, ChevronDown } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { Poster } from "@/app/(app)/servers/[id]/(auth)/dashboard/Poster";
import JellyfinAvatar from "@/components/JellyfinAvatar";
import { PlaybackMethodBadge } from "@/components/PlaybackMethodBadge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQueryParams } from "@/hooks/useQueryParams";
import { usePersistantState } from "@/hooks/usePersistantState";
import { formatDuration } from "@/lib/utils";
import { useSearchParams } from "next/navigation";
import { useRouter } from "nextjs-toploader/app";
import { useDebounce } from "use-debounce";
import { HistoryItem, HistoryResponse } from "@/lib/db/history";
import type { Server } from "@/lib/types";

export interface HistoryTableProps {
  data: HistoryResponse;
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

  const columns: ColumnDef<HistoryItem>[] = [
    {
      accessorKey: "item_name",
      header: "Item",
      cell: ({ row }) => (
        <Link
          href={`/servers/${server.id}/library/${row.original.item?.id}`}
          className="flex flex-row items-center gap-4 cursor-pointer group"
        >
          <div className="shrink-0 rounded overflow-hidden transition-transform duration-200">
            <Poster
              item={
                {
                  id: row.original.item?.id,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  serverId: server.id,
                  libraryId: "",
                  type: row.original.item?.type,
                  originalTitle: null,
                  etag: null,
                  dateCreated: null,
                  sortName: null,
                  productionYear: null,
                  premiereDate: null,
                  officialRating: null,
                  communityRating: null,
                  runtimeTicks: null,
                  playAccess: null,
                  aspectRatio: null,
                  fileName: null,
                  genres: null,
                  parentIndexNumber: null,
                  indexNumber: row.original.item?.indexNumber ?? null,
                  isFolder: false,
                  displayOrder: null,
                  primaryImageAspectRatio:
                    row.original.item?.primaryImageAspectRatio ?? null,
                  mediaType: null,
                  imageTags: null,
                  backdropImageTags: row.original.item?.backdropImageTags,
                  imageBlurHashes: row.original.item?.imageBlurHashes,
                  locationTypes: null,
                  mediaStreams: null,
                  partCount: null,
                  albumCount: null,
                  songCount: null,
                  childCount: null,
                  seriesName: row.original.item?.seriesName ?? null,
                  seasonName: row.original.item?.seasonName ?? null,
                  specialFeatureCount: null,
                  displayPreferencesId: null,
                  tags: null,
                  primaryImageTag: row.original.item?.primaryImageTag ?? null,
                  logoImageTag: null,
                  artImageTag: null,
                  thumbImageTag: null,
                  primaryImageItemId: null,
                  artists: null,
                  artistItems: null,
                  album: null,
                  collectionType: null,
                  displayPreferences: null,
                  userData: null,
                  recursiveItemCount: null,
                  childCountNumber: null,
                  playlistItemId: null,
                  parentLogoItemId: null,
                  parentArtItemId: null,
                  parentThumbItemId:
                    row.original.item?.parentThumbItemId ?? null,
                  parentThumbImageTag:
                    row.original.item?.parentThumbImageTag ?? null,
                  parentPrimaryImageItemId: null,
                  parentPrimaryImageTag: null,
                  chapters: null,
                  locationTyoe: null,
                  isoType: null,
                  mediaSourceCount: null,
                  parentBackdropItemId:
                    row.original.item?.parentBackdropItemId ?? null,
                  parentBackdropImageTags:
                    row.original.item?.parentBackdropImageTags,
                  localTrailerCount: null,
                  channelId: null,
                  channelName: null,
                  overview: null,
                  taglines: null,
                  providerIds: null,
                  parentIndexNumberName: null,
                  seriesId: null,
                  seasonId: null,
                  specialEpisodeNumbers: null,
                  seriesStudio: null,
                  seriesPrimaryImageTag:
                    row.original.item?.seriesPrimaryImageTag ?? null,
                  seasonPrimaryImageTag: null,
                  seriesThumbImageTag: null,
                  seasonThumbImageTag: null,
                  episodeTitle: null,
                  episodeFileExtension: null,
                  trickplay: null,
                  jellyfinId: row.original.item?.id,
                  processed: null,
                  jellyfin_id: row.original.item?.id,
                  name: row.original.item?.name,
                  series_name: row.original.item?.seriesName ?? null,
                  season_name: row.original.item?.seasonName ?? null,
                  index_number: row.original.item?.indexNumber ?? null,
                  parent_index_number: null,
                  primary_image_tag: row.original.item?.primaryImageTag ?? null,
                  series_id: null,
                  series_primary_image_tag:
                    row.original.item?.seriesPrimaryImageTag ?? null,
                  backdrop_image_tags: row.original.item?.backdropImageTags,
                  parent_backdrop_item_id:
                    row.original.item?.parentBackdropItemId ?? null,
                  parent_backdrop_image_tags:
                    row.original.item?.parentBackdropImageTags,
                  parent_thumb_item_id:
                    row.original.item?.parentThumbItemId ?? null,
                  parent_thumb_image_tag:
                    row.original.item?.parentThumbImageTag ?? null,
                  primary_image_thumb_tag:
                    row.original.item?.primaryImageThumbTag ?? null,
                  primary_image_logo_tag:
                    row.original.item?.primaryImageLogoTag ?? null,
                  image_blur_hashes: row.original.item?.imageBlurHashes,
                  production_year: null,
                  official_rating: null,
                  community_rating: null,
                  runtime_ticks: null,
                  primary_image_aspect_ratio:
                    row.original.item?.primaryImageAspectRatio ?? null,
                } as any
              }
              server={server}
            />
          </div>
          <div className="flex flex-col">
            <div className="capitalize font-medium transition-colors duration-200 group-hover:text-primary">
              {row.getValue("item_name")}
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
              href={`/servers/${server.id}/users/${row.original.user?.id}`}
              className="flex items-center gap-2 cursor-pointer group"
            >
              <JellyfinAvatar
                user={{
                  id: row.original.user?.id ?? "",
                  name: row.original.user?.name ?? null,
                  jellyfin_id: row.original.user?.id ?? null,
                }}
                serverUrl={server.url}
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
        const ip = row.original.session.remoteEndPoint;
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
        const client = row.original.session.clientName;
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
        const device = row.original.session.deviceName;
        return <div className="font-medium">{device || "-"}</div>;
      },
    },
    {
      accessorKey: "session.createdAt",
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
      cell: ({ row }) => {
        const dateValue = row.original.session.createdAt;
        if (!dateValue) {
          return <div>No Date</div>;
        }

        const date = new Date(dateValue);
        if (isNaN(date.getTime())) {
          return <div>Invalid Date</div>;
        }

        return (
          <div>
            {date.toLocaleString("en-UK", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </div>
        );
      },
    },
  ];

  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [columnVisibility, setColumnVisibility, isLoadingVisibility] =
    usePersistantState<VisibilityState>(`history-column-visibility-${server.id}`, {
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
