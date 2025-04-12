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
  console.log(data);
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
    [],
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
      header: "Name",
      cell: ({ row }) => (
        <div className="flex flex-row items-center gap-4">
          <div className="w-12 shrink-0 rounded overflow-hidden">
            <Poster item={row.original.item} server={server} />
          </div>
          <p className="capitalize">{row.getValue("name")}</p>
        </div>
      ),
    },
    {
      accessorFn: (row) => row.item.type,
      id: "type",
      header: "Type",
      cell: ({ row }) => <div>{row.getValue("type")}</div>,
    },
    {
      accessorFn: (row) => row.item.production_year,
      id: "production_year",
      header: "Year",
      cell: ({ row }) => <div>{row.getValue("production_year")}</div>,
    },
    {
      accessorFn: (row) => row.item.series_name,
      id: "series_name",
      header: "Series",
      cell: ({ row }) => <div>{row.getValue("series_name") || "-"}</div>,
    },
    {
      accessorFn: (row) => row.item.season_name,
      id: "season_name",
      header: "Season",
      cell: ({ row }) => <div>{row.getValue("season_name") || "-"}</div>,
    },
    {
      accessorKey: "watch_count",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => handleSortChange("watch_count")}
          >
            Watch Count
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => (
        <div className="text-right font-medium">
          {row.getValue("watch_count")}
        </div>
      ),
    },
    {
      accessorKey: "total_watch_time",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => handleSortChange("total_watch_time")}
          >
            Total Watch Time
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const totalWatchTime = row.getValue("total_watch_time") as number;
        const formatted = formatDuration(totalWatchTime);
        return <div className="text-right font-medium">{formatted}</div>;
      },
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        const playbackActivity = row.original;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  window.open(
                    `${server.url}/web/#/details?id=${playbackActivity.item_id}`,
                    "_blank",
                  );
                }}
              >
                Open in Jellyfin
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
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
  },
);
