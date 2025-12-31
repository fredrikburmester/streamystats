"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  ChevronDown,
  ExternalLink,
  Globe,
  Lock,
  Megaphone,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import JellyfinAvatar from "@/components/JellyfinAvatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { usePersistantState } from "@/hooks/usePersistantState";
import type { WatchlistWithItemCount } from "@/lib/db/watchlists";
import { formatLocalDate } from "@/lib/timezone";

interface WatchlistRowActionsProps {
  watchlist: WatchlistWithItemCount;
  serverId: number;
  isOwner: boolean;
}

function WatchlistRowActions({
  watchlist,
  serverId,
  isOwner,
}: WatchlistRowActionsProps) {
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [showEditDialog, setShowEditDialog] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const [name, setName] = React.useState(watchlist.name);
  const [description, setDescription] = React.useState(
    watchlist.description ?? "",
  );
  const [isPublic, setIsPublic] = React.useState(watchlist.isPublic);
  const [allowedItemType, setAllowedItemType] = React.useState(
    watchlist.allowedItemType ?? "",
  );
  const [defaultSortOrder, setDefaultSortOrder] = React.useState(
    watchlist.defaultSortOrder,
  );

  React.useEffect(() => {
    if (showEditDialog) {
      setName(watchlist.name);
      setDescription(watchlist.description ?? "");
      setIsPublic(watchlist.isPublic);
      setAllowedItemType(watchlist.allowedItemType ?? "");
      setDefaultSortOrder(watchlist.defaultSortOrder);
    }
  }, [showEditDialog, watchlist]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/watchlists/${watchlist.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/watchlists/${watchlist.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          isPublic,
          allowedItemType: allowedItemType || null,
          defaultSortOrder,
        }),
      });

      if (res.ok) {
        setShowEditDialog(false);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/servers/${serverId}/watchlists/${watchlist.id}`}>
              <ExternalLink className="w-4 h-4 mr-2" />
              Open
            </Link>
          </DropdownMenuItem>
          {isOwner && (
            <>
              <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
                <Pencil className="w-4 h-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setShowDeleteDialog(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Remove
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Watchlist</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{watchlist.name}"? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleEdit}>
            <DialogHeader>
              <DialogTitle>Edit Watchlist</DialogTitle>
              <DialogDescription>
                Update your watchlist settings
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Watchlist"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="A collection of..."
                  rows={2}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-itemType">Item Type Lock</Label>
                <Select
                  value={allowedItemType || "_none"}
                  onValueChange={(v) =>
                    setAllowedItemType(v === "_none" ? "" : v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Allow all types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Allow all types</SelectItem>
                    <SelectItem value="Movie">Movies only</SelectItem>
                    <SelectItem value="Series">Series only</SelectItem>
                    <SelectItem value="Episode">Episodes only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-sortOrder">Default Sort Order</Label>
                <Select
                  value={defaultSortOrder}
                  onValueChange={setDefaultSortOrder}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">Custom Order</SelectItem>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="dateAdded">Date Added</SelectItem>
                    <SelectItem value="releaseDate">Release Date</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-public" className="cursor-pointer">
                  Make Public
                </Label>
                <Switch
                  id="edit-public"
                  checked={isPublic}
                  onCheckedChange={setIsPublic}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEditDialog(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading || !name.trim()}>
                {loading ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface WatchlistsTableProps {
  watchlists: WatchlistWithItemCount[];
  serverId: number;
  server: { url: string; internalUrl?: string | null };
  currentUserId: string;
}

export function WatchlistsTable({
  watchlists,
  serverId,
  server,
  currentUserId,
}: WatchlistsTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const columns: ColumnDef<WatchlistWithItemCount>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => {
        return (
          <Button variant="ghost" onClick={column.getToggleSortingHandler()}>
            Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const watchlist = row.original;
        const isOwner = watchlist.userId === currentUserId;
        return (
          <div className="flex flex-row items-center gap-4 group">
            <Link
              href={`/servers/${serverId}/watchlists/${watchlist.id}`}
              className="flex flex-col min-w-0 flex-1 cursor-pointer"
            >
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
                {(watchlist as { isPromoted?: boolean }).isPromoted && (
                  <Badge
                    variant="default"
                    className="text-xs font-medium px-2 py-0.5 gap-1 shrink-0"
                  >
                    <Megaphone className="w-3 h-3" />
                    Promoted
                  </Badge>
                )}
              </div>
              {watchlist.description && (
                <div className="text-sm text-neutral-500 transition-colors duration-200 group-hover:text-primary/80 line-clamp-1">
                  {watchlist.description}
                </div>
              )}
            </Link>
          </div>
        );
      },
    },
    {
      accessorKey: "itemCount",
      header: ({ column }) => {
        return (
          <Button variant="ghost" onClick={column.getToggleSortingHandler()}>
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
        // Column id is "owner" (not "userId"), so avoid row.getValue("userId") which spams console.
        const userId = row.original.userId;
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
      header: ({ column }) => {
        return (
          <Button variant="ghost" onClick={column.getToggleSortingHandler()}>
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
    {
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => {
        const watchlist = row.original;
        const isOwner = watchlist.userId === currentUserId;
        return (
          <div className="flex justify-end">
            <WatchlistRowActions
              watchlist={watchlist}
              serverId={serverId}
              isOwner={isOwner}
            />
          </div>
        );
      },
      enableHiding: false,
    },
  ];

  const [columnVisibility, setColumnVisibility] =
    usePersistantState<VisibilityState>(
      `watchlists-column-visibility-${serverId}`,
      {},
    );

  const table = useReactTable({
    data: watchlists,
    columns,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: { sorting, columnVisibility },
    initialState: { pagination: { pageSize: 20 } },
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
            aria-label="Empty watchlist"
            role="img"
          >
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
                return (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className="cursor-pointer"
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
          {(() => {
            const { pageIndex, pageSize } = table.getState().pagination;
            const total = table.getPrePaginationRowModel().rows.length;
            if (total === 0) return null;
            const from = pageIndex * pageSize + 1;
            const to = Math.min((pageIndex + 1) * pageSize, total);
            return (
              <p className="text-sm text-neutral-500">
                {from} - {to} of {total} results.
              </p>
            );
          })()}
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={table.previousPage}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={table.nextPage}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
