"use client";

import type { Item } from "@streamystats/database";
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
import { ArrowUpDown, ChevronDown, Globe, Lock } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { useDebounce } from "use-debounce";
import JellyfinAvatar from "@/components/JellyfinAvatar";
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
import type { WatchlistWithItemCount } from "@/lib/db/watchlists";
import { formatLocalDate } from "@/lib/timezone";

interface WatchlistWithPreviews extends WatchlistWithItemCount {
  previewItems: Item[];
}

interface WatchlistsGridProps {
  watchlists: WatchlistWithPreviews[];
  serverId: number;
  server: { url: string; internalUrl?: string | null };
  currentUserId: string;
}

export function WatchlistsTable({
  watchlists,
  serverId,
  server,
  currentUserId,
}: WatchlistsGridProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { updateQueryParams, isLoading } = useQueryParams();

  const currentPage = Number(searchParams.get("page") || "1");
  const currentSearch = searchParams.get("search") || "";
  const currentSortBy = searchParams.get("sort_by") || "";
  const currentSortOrder = searchParams.get("sort_order") || "";

  const [searchInput, setSearchInput] = React.useState<string>(currentSearch);
  const [debouncedSearch] = useDebounce(searchInput, 500);

  React.useEffect(() => {
    if (debouncedSearch !== currentSearch) {
      updateQueryParams({
        search: debouncedSearch || null,
        page: "1",
      });
    }
  }, [debouncedSearch, currentSearch, updateQueryParams]);

  const sorting: SortingState = currentSortBy
    ? [{ id: currentSortBy, desc: currentSortOrder === "desc" }]
    : [];

  const handleSortChange = (columnId: string) => {
    if (currentSortBy !== columnId) {
      updateQueryParams({
        sort_by: columnId,
        sort_order: "asc",
      });
    } else {
      updateQueryParams({
        sort_order: currentSortOrder === "asc" ? "desc" : "asc",
      });
    }
  };

  const columns: ColumnDef<WatchlistWithPreviews>[] = [
    {
      accessorKey: "name",
      header: () => {
        return (
          <Button variant="ghost" onClick={() => handleSortChange("name")}>
            Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const watchlist = row.original;
        const isOwner = watchlist.userId === currentUserId;
        return (
          <Link
            href={`/servers/${serverId}/watchlists/${watchlist.id}`}
            className="flex flex-row items-center gap-4 cursor-pointer group"
          >
            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="capitalize font-medium transition-colors duration-200 group-hover:text-primary truncate">
                  {watchlist.name}
                </div>
                {watchlist.isPublic ? (
                  <Globe className="w-4 h-4 text-muted-foreground/70 shrink-0" />
                ) : (
                  <Lock className="w-4 h-4 text-muted-foreground/70 shrink-0" />
                )}
                {!isOwner && (
                  <Badge
                    variant="outline"
                    className="text-xs font-medium px-2 py-0.5 text-muted-foreground border-border/50 shrink-0"
                  >
                    Shared
                  </Badge>
                )}
              </div>
              {watchlist.description && (
                <div className="text-sm text-neutral-500 transition-colors duration-200 group-hover:text-primary/80 line-clamp-1">
                  {watchlist.description}
                </div>
              )}
            </div>
          </Link>
        );
      },
    },
    {
      accessorKey: "itemCount",
      header: () => {
        return (
          <Button variant="ghost" onClick={() => handleSortChange("itemCount")}>
            Items
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const count = row.getValue("itemCount") as number;
        return (
          <Badge
            variant="secondary"
            className="text-xs font-medium px-2.5 py-0.5 bg-primary/10 text-primary border-primary/20"
          >
            {count} {count === 1 ? "item" : "items"}
          </Badge>
        );
      },
    },
    {
      accessorKey: "allowedItemType",
      header: () => <div className="text-left">Type</div>,
      cell: ({ row }) => {
        const type = row.getValue("allowedItemType") as string | null;
        return (
          <div className="font-medium">
            {type ? (
              <Badge
                variant="outline"
                className="text-xs font-medium px-2.5 py-0.5 border-border/50"
              >
                {type}
              </Badge>
            ) : (
              <span className="text-muted-foreground">Any</span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "userId",
      id: "owner",
      header: () => <div className="text-left">Owner</div>,
      cell: ({ row }) => {
        const userId = row.getValue("userId") as string;
        const isOwner = userId === currentUserId;
        return (
          <div className="flex items-center gap-2">
            <Link
              href={`/servers/${serverId}/users/${userId}`}
              className="flex items-center gap-2 cursor-pointer group"
            >
              <JellyfinAvatar
                user={{
                  id: userId,
                  name: null,
                  jellyfin_id: userId,
                }}
                server={server}
                className="h-6 w-6 transition-transform duration-200"
              />
              <span className="font-medium transition-colors duration-200 group-hover:text-primary">
                {isOwner ? "You" : "User"}
              </span>
            </Link>
          </div>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: () => {
        return (
          <Button variant="ghost" onClick={() => handleSortChange("createdAt")}>
            Created
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const dateValue = row.getValue("createdAt") as Date | null;
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
  const [columnVisibility, setColumnVisibility] =
    usePersistantState<VisibilityState>(
      `watchlists-column-visibility-${serverId}`,
      {},
    );

  const handlePageChange = (newPage: number) => {
    updateQueryParams({
      page: newPage.toString(),
    });
  };

  const filteredData = React.useMemo(() => {
    if (!debouncedSearch) return watchlists;

    const searchLower = debouncedSearch.toLowerCase();
    return watchlists.filter(
      (watchlist) =>
        watchlist.name.toLowerCase().includes(searchLower) ||
        watchlist.description?.toLowerCase().includes(searchLower) ||
        watchlist.allowedItemType?.toLowerCase().includes(searchLower),
    );
  }, [watchlists, debouncedSearch]);

  const sortedData = React.useMemo(() => {
    if (!currentSortBy) return filteredData;

    const sorted = [...filteredData];
    sorted.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (currentSortBy) {
        case "name":
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case "itemCount":
          aVal = a.itemCount;
          bVal = b.itemCount;
          break;
        case "createdAt":
          aVal = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          bVal = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return currentSortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return currentSortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [filteredData, currentSortBy, currentSortOrder]);

  const pageSize = 20;
  const totalPages = Math.ceil(sortedData.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedData = sortedData.slice(startIndex, endIndex);

  const table = useReactTable({
    data: paginatedData,
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
    manualPagination: false,
    pageCount: totalPages,
  });

  if (watchlists.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-muted-foreground mb-4">
          <svg
            className="w-16 h-16 mx-auto mb-4 opacity-50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            role="img"
            aria-labelledby="empty-watchlist-title"
          >
            <title id="empty-watchlist-title">Empty watchlist</title>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          <p className="text-lg font-medium">No watchlists yet</p>
          <p className="text-sm">
            Create your first watchlist to start organizing your media
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center pb-4">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search watchlists..."
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
              table.getRowModel().rows.map((row) => {
                const watchlist = row.original;
                return (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className="cursor-pointer"
                    onClick={() => {
                      router.push(
                        `/servers/${serverId}/watchlists/${watchlist.id}`,
                      );
                    }}
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
                );
              })
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
            {startIndex + 1} - {Math.min(endIndex, sortedData.length)} of{" "}
            {sortedData.length} results.
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
            disabled={currentPage >= totalPages || isLoading}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
