"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQueryParams } from "@/hooks/useQueryParams";
import { Library } from "@/lib/db";
import { Check } from "lucide-react";
import { useSearchParams } from "next/navigation";
import React from "react";

interface LibraryDropdownProps {
  libraries: Library[];
}

const LibraryDropdown = ({ libraries }: LibraryDropdownProps) => {
  const { updateQueryParams } = useQueryParams();
  const searchParams = useSearchParams();

  // Check if there's a libraries parameter in the URL
  const librariesParam = searchParams.get("libraries");
  const hasLibrariesParam = librariesParam !== null;

  // Parse selected IDs from the URL, or use all library IDs if parameter is absent
  const getSelectedIds = (): number[] => {
    // If no libraries parameter, default to all libraries selected
    if (!hasLibrariesParam) {
      return libraries.map((lib) => Number.parseInt(lib.id));
    }

    // If empty string, no libraries are selected - return empty array
    if (librariesParam === "") return [];

    return librariesParam
      .split(",")
      .map((id) => Number.parseInt(id, 10))
      .filter((id) => !Number.isNaN(id));
  };

  const selectedIds = getSelectedIds();

  const handleToggle = (id: number, checked: boolean) => {
    let newSelectedIds: number[];

    if (checked) {
      // Add ID to selection
      newSelectedIds = [...selectedIds, id];
    } else {
      // Remove ID from selection
      newSelectedIds = selectedIds.filter((selectedId) => selectedId !== id);
    }

    // If all libraries are selected, remove the parameter
    const allSelected =
      newSelectedIds.length === libraries.length &&
      libraries.every((lib) =>
        newSelectedIds.includes(Number.parseInt(lib.id)),
      );

    // If no libraries are selected, remove the parameter (same as all selected)
    const noLibrariesSelected = newSelectedIds.length === 0;

    // Update the URL with the new selection
    updateQueryParams({
      libraries:
        allSelected || noLibrariesSelected
          ? null // Remove the parameter completely instead of setting to empty string
          : newSelectedIds.join(","),
    });
  };

  const selectedCount = selectedIds.length;
  const totalCount = libraries.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          Libraries ({selectedCount}/{totalCount})
          <Check
            className={selectedCount > 0 ? "w-4 h-4 text-green-500" : "hidden"}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuLabel>Filter Libraries</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {libraries.map((library) => (
          <DropdownMenuCheckboxItem
            key={library.id}
            checked={selectedIds.includes(Number.parseInt(library.id))}
            onCheckedChange={(checked) =>
              handleToggle(Number.parseInt(library.id), checked)
            }
          >
            <div className="flex flex-col">
              <span>{library.name}</span>
              <span className="text-xs text-muted-foreground">
                {library.type}
              </span>
            </div>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LibraryDropdown;
