"use client";

import type { Activity, User } from "@streamystats/database/schema";
import {
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import { ArrowUpDown, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import * as React from "react";
import { useDebounce } from "use-debounce";
import JellyfinAvatar from "@/components/JellyfinAvatar";
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
import type { ServerPublic } from "@/lib/types";
import { ActivityFilters } from "./ActivityFilters";

interface PaginatedActivities {
  data: Activity[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface ActivityLogTableProps {
  server: ServerPublic;
  data: PaginatedActivities;
  users: User[];
  activityTypes: string[];
}

export function ActivityLogTable({
  server,
  data,
  users,
  activityTypes,
}: ActivityLogTableProps) {
  const searchParams = useSearchParams();
  const { updateQueryParams } = useQueryParams();

  // Get current page from URL query parameters or default to 1
  const currentPage = Number(searchParams.get("page") || "1");
  const currentSortBy = searchParams.get("sort_by") || "";
  const currentSortOrder = searchParams.get("sort_order") || "";
  const currentSearch = searchParams.get("search") || "";

  // Local state for search input before debouncing
  const [searchInput, setSearchInput] = React.useState<string>(currentSearch);
  const [debouncedSearch] = useDebounce(searchInput, 500);

  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [columnVisibility, setColumnVisibility, _isLoadingVisibility] =
    usePersistantState<VisibilityState>(
      `activities-column-visibility-${server.id}`,
      {},
    );

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

  const columns: ColumnDef<Activity>[] = [
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
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Link
            href={`/servers/${server.id}/users/${row.original.userId}`}
            className="flex items-center gap-2 group"
          >
            <JellyfinAvatar
              user={{
                id: row.original.userId?.toString() || "",
                name: row.getValue("name"),
                jellyfin_id: row.original.userId?.toString() || "",
              }}
              server={server}
              className="h-6 w-6 transition-transform duration-200"
            />
            <span className="capitalize transition-colors duration-200 group-hover:text-primary">
              {row.getValue("name")}
            </span>
          </Link>
        </div>
      ),
    },
    {
      accessorKey: "type",
      header: () => {
        return (
          <Button variant="ghost" onClick={() => handleSortChange("type")}>
            Type
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => <div>{row.getValue("type")}</div>,
    },
    {
      accessorKey: "date",
      header: () => {
        return (
          <Button variant="ghost" onClick={() => handleSortChange("date")}>
            Date
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => (
        <div>
          {new Date(row.getValue("date")).toLocaleString("en-UK", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </div>
      ),
    },
    {
      accessorKey: "severity",
      header: () => (
        <Button variant="ghost" onClick={() => handleSortChange("severity")}>
          Severity
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <div>{row.getValue("severity")}</div>,
    },
    {
      accessorKey: "shortOverview",
      header: "Overview",
      cell: ({ row }) => (
        <div
          className="max-w-[400px] truncate"
          title={row.getValue("shortOverview")}
        >
          {row.getValue("shortOverview")}
        </div>
      ),
    },
  ];

  const table = useReactTable({
    data: data?.data || [],
    columns,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
    manualPagination: true,
    manualSorting: true,
    pageCount: data?.pagination.totalPages || -1,
  });

  // Function to update URL with new page parameter
  const handlePageChange = (newPage: number) => {
    updateQueryParams({
      page: newPage.toString(),
    });
  };

  return (
    <div className="w-full">
      <div className="flex flex-col gap-4 mb-4">
        <ActivityFilters users={users} activityTypes={activityTypes} />
        <div className="flex items-center justify-between">
          <Input
            placeholder="Search activities..."
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className="max-w-sm"
          />
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
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader className="">
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
            {((data?.pagination.page || 0) - 1) *
              (data?.pagination.pageSize || 0) +
              1}{" "}
            -{" "}
            {((data?.pagination.page || 0) - 1) *
              (data?.pagination.pageSize || 0) +
              (data?.data?.length || 0)}{" "}
            of {data?.pagination.total} results.
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
            disabled={currentPage >= (data?.pagination.totalPages || 1)}
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
