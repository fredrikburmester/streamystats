"use client";

import {
  ColumnDef,
  ColumnFiltersState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronDown } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import Link from "next/link";

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
import JellyfinAvatar from "@/components/JellyfinAvatar";
import { Activity, Server } from "@streamystats/database/schema";

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
  server: Server;
  data: PaginatedActivities;
}

export function ActivityLogTable({ server, data }: ActivityLogTableProps) {
  const router = useRouter();
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  const searchParams = useSearchParams();

  // Get current page from URL query parameters or default to 1
  const currentPage = Number(searchParams.get("page") || "1");

  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});

  const columns: ColumnDef<Activity>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Link
            href={`${basePath}/servers/${server.id}/users/${row.original.userId}`}
            className="flex items-center gap-2 group"
          >
            <JellyfinAvatar
              user={{
                id: row.original.userId?.toString() || "",
                name: row.getValue("name"),
                jellyfin_id: row.original.userId?.toString() || "",
              }}
              serverUrl={server.url}
              className="h-6 w-6 transition-transform duration-200 group-hover:scale-110"
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
      header: "Type",
      cell: ({ row }) => <div>{row.getValue("type")}</div>,
    },
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }) => (
        <div>
          {new Date(row.getValue("date")).toLocaleString("en-UK", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </div>
      ),
    },
    // {
    //   accessorKey: "severity",
    //   header: "Severity",
    //   cell: ({ row }) => <div>{row.getValue("severity")}</div>,
    // },
    // {
    //   accessorKey: "short_overview",
    //   header: "Overview",
    //   cell: ({ row }) => <div>{row.getValue("short_overview")}</div>,
    // },
    // {
    //   id: "actions",
    //   enableHiding: false,
    //   cell: ({ row }) => { ... }
    // },
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
      columnFilters,
      columnVisibility,
    },
    manualPagination: true,
    pageCount: data?.pagination.totalPages || -1,
  });

  // Function to update URL with new page parameter
  const handlePageChange = (newPage: number) => {
    // Create a new URLSearchParams object from the current search params
    const params = new URLSearchParams(searchParams.toString());

    // Update or add the page parameter
    params.set("page", newPage.toString());

    // Update the URL without reloading the page
    router.push(`?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="w-full">
      <div className="flex items-center mb-2">
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
