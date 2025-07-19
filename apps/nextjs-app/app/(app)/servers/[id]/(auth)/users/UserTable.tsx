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
import * as React from "react";

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
import type { UserWithStats } from "@/lib/db/users";
import type { Server } from "@/lib/types";
import { formatDuration } from "@/lib/utils";
import { useRouter } from "nextjs-toploader/app";
import Link from "next/link";
import User from "./[name]/page";

export interface UserTableProps {
  data: UserWithStats[];
  server: Server;
}

export const UserTable: React.FC<UserTableProps> = ({
  data,
  server,
}: UserTableProps) => {
  const router = useRouter();
  const columns: ColumnDef<UserWithStats>[] = [
    {
      id: "avatar",
      header: () => <div className="text-left">Avatar</div>,
      cell: ({ row }) => (
        <div className="flex">
          <JellyfinAvatar
            user={{
              id: row.original?.id ?? "",
              name: row.original?.name ?? "",
              jellyfin_id: row.original?.id ?? null,
            }}
            serverUrl={server.url}
            className="h-6 w-6 transition-transform duration-200 group-hover:scale-110"
          />
        </div>
      ),
    },
    {
      accessorKey: "name",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => (
        <button
          type="button"
          className="cursor-pointer hover:opacity-80 focus:outline-none bg-transparent border-0 w-full text-left transition-colors duration-200 hover:text-primary"
          onClick={() => {
            router.push(`/servers/${server.id}/users/${row.original.name}`);
          }}
        >
          <p className="font-medium">{row.getValue("name")}</p>
        </button>
      ),
    },
    {
      id: "total_watch_time",
      accessorFn: (row) => row.watch_stats?.total_watch_time ?? 0,
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            className="justify-self-end place-self-end self-end"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Total Watch Time
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const totalWatchTime = row.original.watch_stats?.total_watch_time ?? 0;
        return (
          <div className="text-left">{formatDuration(totalWatchTime)}</div>
        );
      },
    },
    {
      id: "total_plays",
      accessorFn: (row) => row.watch_stats?.total_plays ?? 0,
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Total Plays
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const totalPlays = row.original.watch_stats?.total_plays ?? 0;
        return <div className="text-left">{totalPlays}</div>;
      },
    },
    {
      id: "avg_watch_time",
      accessorFn: (row) => {
        const totalWatchTime = row.watch_stats?.total_watch_time ?? 0;
        const totalPlays = row.watch_stats?.total_plays ?? 1;
        return totalWatchTime / (totalPlays || 1);
      },
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Avg. Watch Time
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const totalWatchTime = row.original.watch_stats?.total_watch_time ?? 0;
        const totalPlays = row.original.watch_stats?.total_plays ?? 1;
        const avgWatchTime = totalWatchTime / (totalPlays || 1);
        return <div className="text-left">{formatDuration(avgWatchTime)}</div>;
      },
    },
    {
      id: "longest_streak",
      accessorFn: (row) => row.longest_streak ?? 0,
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Longest Streak
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const longestStreak = row.original.longest_streak ?? 0;
        return (
          <div className="text-left">
            {formatDuration(longestStreak, "days")}
          </div>
        );
      },
    },
  ];

  const [sorting, setSorting] = React.useState<SortingState>([
    { desc: true, id: "total_watch_time" },
  ]);

  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  return (
    <div className="w-full">
      <div className="flex items-center py-4">
        <Input
          placeholder="Filter names..."
          value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("name")?.setFilterValue(event.target.value)
          }
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
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
};
