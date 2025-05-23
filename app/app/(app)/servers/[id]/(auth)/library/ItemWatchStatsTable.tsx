"use client";

import { Button } from "@/components/ui/button";
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
import { useQueryParams } from "@/hooks/useQueryParams";
import {
  ItemWatchStats,
  ItemWatchStatsResponse,
  Library,
  Server,
} from "@/lib/db";
import { formatDuration } from "@/lib/utils";
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
import { useSearchParams } from "next/navigation";
import { useRouter } from "nextjs-toploader/app";
import * as React from "react";
import { useDebounce } from "use-debounce";
import { Poster } from "../dashboard/Poster";
import LibraryDropdown from "./LibraryDropdown";
import { getExternalUrl } from "@/utils/getServerUrl";

export interface ItemWatchStatsTableProps {
  server: Server;
  data: ItemWatchStatsResponse;
  libraries: Library[];
}

export function ItemWatchStatsTable({
  server,
  data,
  libraries,
}: ItemWatchStatsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

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

  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});

  const { updateQueryParams } = useQueryParams();

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

  const handlePageChange = (newPage: number) => {
    updateQueryParams({
      page: newPage.toString(),
    });
  };

  const columns: ColumnDef<ItemWatchStats>[] = [
    {
      accessorFn: (row) => row.item.name,
      id: "name",
      header: () => (
        <Button variant="ghost" onClick={() => handleSortChange("name")}>
          Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <a
          href={`${getExternalUrl(server)}/web/index.html#!/details?id=${
            row.original.item.jellyfin_id
          }`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-row items-center gap-4 group"
        >
          <div className="shrink-0 rounded overflow-hidden transition-transform duration-200 group-hover:scale-110">
            <Poster item={row.original.item} server={server} />
          </div>
          <div>
            <p className="capitalize transition-colors duration-200 group-hover:text-primary">
              {row.getValue("name")}
            </p>
            <p className="text-sm text-muted-foreground">
              {row.original.item.type}
              {row.original.item.production_year &&
                ` • ${row.original.item.production_year}`}
              {row.original.item.series_name &&
                ` • ${row.original.item.series_name}`}
              {row.original.item.season_name &&
                ` • ${row.original.item.season_name}`}
            </p>
          </div>
        </a>
      ),
      size: 320,
      minSize: 220,
      maxSize: 400,
    },
    {
      accessorKey: "total_watch_time",
      header: () => (
        <Button
          variant="ghost"
          onClick={() => handleSortChange("total_watch_time")}
        >
          Total Watch Time
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const totalWatchTime = row.getValue("total_watch_time") as number;
        const formatted = formatDuration(totalWatchTime);
        return <div className="text-left font-medium">{formatted}</div>;
      },
      size: 120,
      minSize: 80,
      maxSize: 160,
    },
    {
      accessorKey: "watch_count",
      header: () => (
        <Button variant="ghost" onClick={() => handleSortChange("watch_count")}>
          Watch Count
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="text-left font-medium">
          {row.getValue("watch_count")}
        </div>
      ),
      size: 80,
      minSize: 60,
      maxSize: 100,
    },
    {
      accessorFn: (row) => row.item.official_rating,
      id: "official_rating",
      header: () => (
        <Button
          variant="ghost"
          onClick={() => handleSortChange("official_rating")}
        >
          Rating
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="text-left">
          {row.original.item.official_rating || "-"}
        </div>
      ),
      size: 80,
      minSize: 60,
      maxSize: 100,
    },
    {
      accessorFn: (row) => row.item.community_rating,
      id: "community_rating",
      header: () => (
        <Button
          variant="ghost"
          onClick={() => handleSortChange("community_rating")}
        >
          User Rating
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="text-left">
          {row.original.item.community_rating
            ? row.original.item.community_rating.toFixed(1) + "★"
            : "-"}
        </div>
      ),
      size: 100,
      minSize: 80,
      maxSize: 120,
    },
    {
      accessorFn: (row) => row.item.runtime_ticks,
      id: "runtime",
      header: () => (
        <Button variant="ghost" onClick={() => handleSortChange("runtime")}>
          Runtime
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const ticks = Number(row.original.item.runtime_ticks);
        if (!ticks) return <div className="text-left">-</div>;
        const totalSeconds = Math.floor(ticks / 10000000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        return (
          <div className="text-left">
            {hours ? `${hours}h ${minutes}m` : `${minutes}m`}
          </div>
        );
      },
      size: 90,
      minSize: 70,
      maxSize: 110,
    },
    {
      accessorFn: (row) => row.item.genres,
      id: "genres",
      header: () => (
        <Button variant="ghost" onClick={() => handleSortChange("genres")}>
          Genres
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="text-left">
          {Array.isArray(row.original.item.genres) &&
          row.original.item.genres.length > 0
            ? row.original.item.genres.join(", ")
            : "-"}
        </div>
      ),
      size: 180,
      minSize: 120,
      maxSize: 240,
    },
  ];

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
      columnFilters,
      columnVisibility,
      sorting,
    },
    manualPagination: true,
    pageCount: data?.total_pages || -1,
  });

  return (
    <div className="w-full">
      <div className="flex items-center justify-start py-4 gap-2">
        <Input
          placeholder="Search items..."
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          className="max-w-sm mr-auto"
        />
        <LibraryDropdown libraries={libraries} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="">
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
              table
                .getRowModel()
                .rows.map((row) => (
                  <MemoizedTableRow
                    key={row.id}
                    row={row}
                    server={server}
                    columns={columns}
                  />
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
            {((data?.page || 0) - 1) * 20 + 1} -{" "}
            {((data?.page || 0) - 1) * 20 + (data?.data.length || 0)} of{" "}
            {data?.total_items} results.
          </p>
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            Previous
          </Button>
          <Button
            disabled={currentPage >= (data?.total_pages || 1)}
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

const MemoizedTableRow = React.memo(
  ({
    row,
    server,
    columns,
  }: {
    row: any;
    server: Server;
    columns: ColumnDef<ItemWatchStats>[];
  }) => {
    return (
      <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
        {row.getVisibleCells().map((cell: any) => (
          <TableCell key={cell.id}>
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        ))}
      </TableRow>
    );
  },
  (prevProps, nextProps) => {
    // Only re-render if row data has changed
    return prevProps.row.original.item_id === nextProps.row.original.item_id;
  }
);
