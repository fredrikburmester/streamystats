"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronDown, Film, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import * as React from "react";
import { useState } from "react";
import { useDebounce } from "use-debounce";
import { Poster } from "@/app/(app)/servers/[id]/(auth)/dashboard/Poster";
import { FormattedDate } from "@/components/FormattedDate";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePersistantState } from "@/hooks/usePersistantState";
import type {
  WatchlistItemWithListItem,
  WatchlistWithItemsLite,
} from "@/lib/db/watchlists";
import type { ServerPublic } from "@/lib/types";

function getItemIdsInCustomOrder(items: WatchlistItemWithListItem[]): string[] {
  return [...items]
    .sort((a, b) => a.position - b.position)
    .map((i) => i.item.id);
}

function RemoveWatchlistItemButton({
  itemId,
  onRemove,
}: {
  itemId: string;
  onRemove: (itemId: string) => Promise<void> | void;
}) {
  const [removing, setRemoving] = useState(false);

  const handleRemove = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setRemoving(true);
    await onRemove(itemId);
    setRemoving(false);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleRemove}
      disabled={removing}
    >
      <Trash2 className="w-4 h-4 text-destructive" />
    </Button>
  );
}

function ReorderButtons({
  itemId,
  enabled,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
}: {
  itemId: string;
  enabled: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: (itemId: string) => void;
  onMoveDown: (itemId: string) => void;
}) {
  const handleMoveUp = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onMoveUp(itemId);
    },
    [itemId, onMoveUp],
  );

  const handleMoveDown = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onMoveDown(itemId);
    },
    [itemId, onMoveDown],
  );

  return (
    <div
      className={[
        "flex items-center justify-end gap-1 transition-opacity",
        enabled ? "opacity-100" : "opacity-0 pointer-events-none",
      ].join(" ")}
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={handleMoveUp}
        disabled={!canMoveUp}
        aria-label="Move up"
      >
        <ArrowUp className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleMoveDown}
        disabled={!canMoveDown}
        aria-label="Move down"
      >
        <ArrowDown className="w-4 h-4" />
      </Button>
    </div>
  );
}

interface WatchlistItemsProps {
  watchlist: WatchlistWithItemsLite;
  isOwner: boolean;
  server: ServerPublic;
  currentType?: string;
  currentSort?: string;
}

export function WatchlistItems({
  watchlist,
  isOwner,
  server,
  currentType,
  currentSort,
}: WatchlistItemsProps) {
  const router = useRouter();
  const params = useParams();
  const serverIdParam = params.id as string;
  const [items, setItems] = useState(watchlist.items);

  const [typeFilter, setTypeFilter] = useState<string>(currentType ?? "all");
  const [sortOrder, setSortOrder] = useState<string>(
    currentSort ?? watchlist.defaultSortOrder ?? "custom",
  );
  const initialOrderRef = React.useRef<string[]>(
    getItemIdsInCustomOrder(items),
  );
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  const [searchInput, setSearchInput] = useState<string>("");
  const [debouncedSearch] = useDebounce(searchInput, 500);

  const handleTypeChange = (value: string) => {
    setTypeFilter(value);
    setPage(1);
  };

  const handleSortChange = (value: string) => {
    setSortOrder(value);
    setPage(1);
  };

  const isCustomOrdering = sortOrder === "custom";
  const canReorder =
    isOwner && isCustomOrdering && typeFilter === "all" && !debouncedSearch;

  const currentOrderIds = React.useMemo(
    () => getItemIdsInCustomOrder(items),
    [items],
  );
  const itemCount = items.length;
  const hasOrderChanges = React.useMemo(() => {
    const initial = initialOrderRef.current;
    if (initial.length !== currentOrderIds.length) return true;
    for (let i = 0; i < initial.length; i++) {
      if (initial[i] !== currentOrderIds[i]) return true;
    }
    return false;
  }, [currentOrderIds]);

  const moveItemBy = React.useCallback((itemId: string, delta: -1 | 1) => {
    setItems((prev) => {
      // Find index in the *current* array (which is already sorted by position)
      const currentIndex = prev.findIndex((i) => i.item.id === itemId);
      if (currentIndex === -1) return prev;

      const targetIndex = currentIndex + delta;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;

      // Create a shallow copy of the array
      const next = [...prev];

      // Swap the items
      const itemA = next[currentIndex];
      const itemB = next[targetIndex];

      // Swap their positions (so sort order is maintained if we re-sort, though the array order is what matters for display if we trust it)
      const posA = itemA.position;
      const posB = itemB.position;

      // We need to create new object references ONLY for the two moved items
      // to trigger re-renders for those rows, but keep others stable if possible.
      next[currentIndex] = { ...itemB, position: posA };
      next[targetIndex] = { ...itemA, position: posB };

      return next;
    });
  }, []);

  const handleMoveUp = React.useCallback(
    (itemId: string) => {
      moveItemBy(itemId, -1);
    },
    [moveItemBy],
  );

  const handleMoveDown = React.useCallback(
    (itemId: string) => {
      moveItemBy(itemId, 1);
    },
    [moveItemBy],
  );

  const handleResetOrder = React.useCallback(() => {
    // Reset by restoring the initial order (by position) and ensuring positions are sequential
    setItems((prev) => {
      const byId = new Map(prev.map((i) => [i.item.id, i] as const));
      const initialIds = initialOrderRef.current;
      const next: WatchlistItemWithListItem[] = [];
      const used = new Set<string>();

      for (let i = 0; i < initialIds.length; i++) {
        const id = initialIds[i];
        const item = byId.get(id);
        if (item) {
          next.push({ ...item, position: i });
          used.add(id);
        }
      }

      // Add any items that weren't in the initial order (safety fallback)
      for (const item of prev) {
        if (!used.has(item.item.id)) {
          next.push({ ...item, position: next.length });
        }
      }

      return next;
    });
  }, []);

  const handleSaveOrder = React.useCallback(async () => {
    if (!canReorder) return;
    setIsSavingOrder(true);
    try {
      const res = await fetch(`/api/watchlists/${watchlist.id}/items/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds: currentOrderIds }),
      });

      if (!res.ok) {
        return;
      }

      initialOrderRef.current = currentOrderIds;
      router.refresh();
    } finally {
      setIsSavingOrder(false);
    }
  }, [canReorder, currentOrderIds, router, watchlist.id]);

  const handleRemoveItemStable = React.useCallback(
    async (itemId: string) => {
      const res = await fetch(
        `/api/watchlists/${watchlist.id}/items/${itemId}`,
        {
          method: "DELETE",
        },
      );

      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.item.id !== itemId));
        router.refresh();
      }
    },
    [router, watchlist.id],
  );

  const columns = React.useMemo<ColumnDef<WatchlistItemWithListItem>[]>(() => {
    const baseColumns: ColumnDef<WatchlistItemWithListItem>[] = [
      {
        accessorFn: (row) => row.item?.name || "",
        id: "item_name",
        header: "Item",
        cell: ({ row }) => {
          const watchlistItem = row.original;
          const item = watchlistItem.item;
          const href = `/servers/${serverIdParam}/library/${item.id}`;
          const isEpisode = item.type === "Episode";
          const posterWidth = isEpisode ? 160 : 150;
          const posterHeight = isEpisode ? 90 : 225;
          const preferredImageType = isEpisode ? "Thumb" : "Primary";
          return (
            <Link
              href={href}
              className="flex flex-row items-center gap-4 cursor-pointer group"
            >
              <div className="shrink-0 rounded overflow-hidden">
                <Poster
                  item={item}
                  server={server}
                  size="default"
                  width={posterWidth}
                  height={posterHeight}
                  preferredImageType={preferredImageType}
                />
              </div>
              <div className="flex flex-col">
                <div className="capitalize font-medium transition-colors duration-200 group-hover:text-primary">
                  {item.name}
                </div>
                {item.seriesName && (
                  <div className="text-sm text-neutral-500 transition-colors duration-200 group-hover:text-primary/80">
                    {item.seriesName}
                    {item.parentIndexNumber &&
                      item.indexNumber &&
                      ` • S${item.parentIndexNumber}E${item.indexNumber}`}
                  </div>
                )}
              </div>
            </Link>
          );
        },
      },
      {
        accessorKey: "item.type",
        id: "item_type",
        header: () => <div className="text-left">Type</div>,
        cell: ({ row }) => {
          const type = row.original.item.type;
          return (
            <Badge variant="outline" className="text-xs">
              {type}
            </Badge>
          );
        },
      },
      {
        accessorKey: "item.productionYear",
        id: "item_year",
        header: "Year",
        cell: ({ row }) => {
          const year = row.original.item.productionYear;
          return <div className="font-medium">{year || "-"}</div>;
        },
      },
      {
        accessorKey: "item.communityRating",
        id: "item_rating",
        header: () => <div className="text-left">Rating</div>,
        cell: ({ row }) => {
          const rating = row.original.item.communityRating;
          if (!rating) return <div className="text-muted-foreground">-</div>;
          return (
            <div className="flex items-center gap-1">
              <svg
                className="w-3 h-3 text-yellow-500"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-label="Rating"
                role="img"
              >
                <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
              </svg>
              <span className="font-medium">{rating.toFixed(1)}</span>
            </div>
          );
        },
      },
      {
        accessorKey: "addedAt",
        id: "addedAt",
        header: "Date Added",
        cell: ({ row }) => {
          return (
            <FormattedDate
              date={row.original.addedAt}
              format="datetime"
              fallback="No Date"
            />
          );
        },
      },
    ];

    if (isOwner) {
      baseColumns.push({
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => {
          const watchlistItem = row.original;
          // Use the position field directly from the item (updated by buildItemsWithUpdatedPositions)
          const orderIndex = watchlistItem.position;
          const canMoveUp = canReorder && orderIndex > 0;
          const canMoveDown = canReorder && orderIndex < itemCount - 1;
          return (
            <div className="flex items-center justify-end gap-1">
              <ReorderButtons
                itemId={watchlistItem.item.id}
                enabled={canReorder}
                canMoveUp={canMoveUp}
                canMoveDown={canMoveDown}
                onMoveUp={handleMoveUp}
                onMoveDown={handleMoveDown}
              />
              <RemoveWatchlistItemButton
                itemId={watchlistItem.item.id}
                onRemove={handleRemoveItemStable}
              />
            </div>
          );
        },
      });
    }

    return baseColumns;
  }, [
    serverIdParam,
    server,
    isOwner,
    canReorder,
    itemCount,
    handleMoveUp,
    handleMoveDown,
    handleRemoveItemStable,
  ]);

  const [columnVisibility, setColumnVisibility] =
    usePersistantState<VisibilityState>(
      `watchlist-items-column-visibility-${watchlist.id}`,
      {},
    );

  const filteredData = React.useMemo(() => {
    let filtered = items;

    if (typeFilter && typeFilter !== "all") {
      filtered = filtered.filter((i) => i.item.type === typeFilter);
    }

    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase();
      filtered = filtered.filter(
        (watchlistItem) =>
          watchlistItem.item.name.toLowerCase().includes(searchLower) ||
          watchlistItem.item.seriesName?.toLowerCase().includes(searchLower),
      );
    }

    return filtered;
  }, [items, typeFilter, debouncedSearch]);

  const sortedData = React.useMemo(() => {
    const sorted = [...filteredData];

    switch (sortOrder) {
      case "name":
        sorted.sort((a, b) =>
          a.item.name.localeCompare(b.item.name, undefined, {
            sensitivity: "base",
          }),
        );
        break;
      case "dateAdded":
        sorted.sort((a, b) => {
          const aDate = a.addedAt ? new Date(a.addedAt).getTime() : 0;
          const bDate = b.addedAt ? new Date(b.addedAt).getTime() : 0;
          return bDate - aDate;
        });
        break;
      case "releaseDate":
        sorted.sort((a, b) => {
          const aYear = a.item.premiereDate
            ? new Date(a.item.premiereDate).getTime()
            : 0;
          const bYear = b.item.premiereDate
            ? new Date(b.item.premiereDate).getTime()
            : 0;
          return bYear - aYear;
        });
        break;
      default:
        sorted.sort((a, b) => a.position - b.position);
        break;
    }

    return sorted;
  }, [filteredData, sortOrder]);

  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const [page, setPage] = useState(1);
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedData = sortedData.slice(startIndex, endIndex);

  const table = useReactTable({
    data: paginatedData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    autoResetPageIndex: false, // Don't reset page when data changes (e.g. reorder)
    state: {
      columnVisibility,
    },
  });

  const itemTypes = [...new Set(items.map((i) => i.item.type))];

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-muted-foreground">
          <Film className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No items yet</p>
          <p className="text-sm">
            Add items from the library to start building your watchlist
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex flex-col gap-4 mb-4">
        <div className="flex items-center gap-3">
          {!watchlist.allowedItemType && itemTypes.length > 1 && (
            <Select value={typeFilter} onValueChange={handleTypeChange}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {itemTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={sortOrder} onValueChange={handleSortChange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Sort by" />
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
          <Input
            placeholder="Search items..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="max-w-sm"
          />
          {isOwner && isCustomOrdering && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetOrder}
                disabled={!hasOrderChanges || !canReorder || isSavingOrder}
              >
                Reset order
              </Button>
              <Button
                size="sm"
                onClick={handleSaveOrder}
                disabled={!hasOrderChanges || !canReorder || isSavingOrder}
              >
                {isSavingOrder ? "Saving..." : "Save order"}
              </Button>
            </div>
          )}
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
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
