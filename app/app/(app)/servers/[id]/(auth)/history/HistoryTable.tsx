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
import { useQueryParams } from "@/hooks/useQueryParams";
import { Server, UserPlaybackStatistics } from "@/lib/db";
import { formatDuration } from "@/lib/utils";
import { useSearchParams } from "next/navigation";
import { useRouter } from "nextjs-toploader/app";
import { useDebounce } from "use-debounce";

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
  console.log(data);
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
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "item_name",
      header: "Item",
      cell: ({ row }) => (
        <div className="capitalize">{row.getValue("item_name")}</div>
      ),
    },
    {
      accessorKey: "series_name",
      header: "Series",
      cell: ({ row }) => {
        const seriesName = row.getValue("series_name") as string | null;
        return <div className="capitalize">{seriesName || "-"}</div>;
      },
    },
    {
      accessorKey: "season_name",
      header: "Season",
      cell: ({ row }) => {
        const seasonName = row.getValue("season_name") as string | null;
        return <div className="capitalize">{seasonName || "-"}</div>;
      },
    },
    {
      accessorKey: "index_number",
      header: "Episode",
      cell: ({ row }) => {
        const indexNumber = row.getValue("index_number") as number | null;
        return <div>{indexNumber !== null ? indexNumber : "-"}</div>;
      },
    },
    {
      accessorKey: "user_name",
      header: () => <div className="text-right">User</div>,
      cell: ({ row }) => {
        const user = row.getValue("user_name") as string;
        return <div className="text-right font-medium">{user}</div>;
      },
    },
    {
      accessorKey: "play_duration",
      header: () => <div className="text-right">Duration</div>,
      cell: ({ row }) => {
        const playDuration = row.getValue("play_duration") as number | null;
        const formatted = playDuration ? formatDuration(playDuration) : "-";
        return <div className="text-right font-medium">{formatted}</div>;
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
              <DropdownMenuItem
                onClick={() =>
                  navigator.clipboard.writeText(playbackActivity.id.toString())
                }
              >
                Copy activity ID
              </DropdownMenuItem>
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
              <DropdownMenuItem
                onClick={() => {
                  router.push(
                    `/servers/${server.id}/users/${playbackActivity.user_name}`,
                  );
                }}
              >
                View user details
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({
      user_name: !hideUserColumn,
    });
  const [rowSelection, setRowSelection] = React.useState({});

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
    onRowSelectionChange: setRowSelection,
    state: {
      sorting, // We keep this to display the current sort state
      columnFilters,
      columnVisibility,
      rowSelection,
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
            {((data?.page || 0) - 1) * (data?.per_page || 20) + 1} -{" "}
            {((data?.page || 0) - 1) * (data?.per_page || 20) +
              (data?.data?.length || 0)}{" "}
            of {data?.total_items || 0} results.
            {rowSelection && Object.keys(rowSelection).length > 0 && (
              <> ({Object.keys(rowSelection).length} selected)</>
            )}
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
