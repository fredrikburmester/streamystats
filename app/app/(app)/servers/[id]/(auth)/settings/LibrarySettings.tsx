"use client";

import { Spinner } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Library, Server, updateServer } from "@/lib/db";
import { CollectionFolder } from "@/lib/jellyfin";
import { useState } from "react";
import { toast } from "sonner";

export default function LibrarySettings({
  server,
  libraries,
}: {
  server: Server;
  libraries?: CollectionFolder[];
}) {
  const [selectedLibraries, setSelectedLibraries] = useState<string[]>(
    server.enabled_libraries || []
  );

  const [loading, setLoading] = useState(false);

  const handleLibraryToggle = (libraryId: string) => {
    setSelectedLibraries((current) => {
      if (current.includes(libraryId)) {
        return current.filter((id) => id !== libraryId);
      }
      return [...current, libraryId];
    });
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateServer(server.id, {
        enabled_libraries: selectedLibraries,
      });
      toast.success("Library settings updated successfully");
    } catch (error) {
      console.error("Error updating library settings:", error);
      toast.error("Failed to update library settings");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Library Sync Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4">Select the libraries you want to sync:</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {libraries?.map((library) => (
            <div
              key={library.Id}
              className="flex items-center space-x-3 border p-4 rounded-md"
            >
              <Checkbox
                id={`library-${library.Id}`}
                checked={selectedLibraries.includes(library.Id)}
                onCheckedChange={() => handleLibraryToggle(library.Id)}
              />
              <label
                htmlFor={`library-${library.Id}`}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {library.Name}
              </label>
            </div>
          ))}
        </div>
        <Button onClick={handleSave} disabled={loading}>
          {loading ? <Spinner /> : "Save Settings"}
        </Button>
      </CardContent>
    </Card>
  );
}
