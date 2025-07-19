"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Loader2,
  Upload,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";

export default function DatabaseBackupRestore({
  serverId,
}: {
  serverId: number;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [importSuccess, setImportSuccess] = useState<{
    message: string;
    imported_count?: number;
    total_count?: number;
  } | null>(null);
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

  const exportMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${basePath}/api/export/${serverId}`, {
        method: "GET",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown" }));
        throw new Error(err.error || "Export failed");
      }
      return res;
    },
    onSuccess: async (res) => {
      const cd = res.headers.get("content-disposition") ?? "";
      const m = cd.match(/filename="?([^"]+)"?/);
      const fn =
        m?.[1] ??
        `streamystats-backup-${new Date().toISOString().split("T")[0]}.json`;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fn;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Export complete");
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Export failed");
    },
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Select a file first");
      const form = new FormData();
      form.set("file", file, file.name);
      const res = await fetch(`...`, {
        method: "POST",
        body: form,
      });
      const payload = await res.json().catch(() => ({
        error: "Invalid response",
      }));
      if (!res.ok) throw new Error(payload.error || "Import failed");
      return payload;
    },
    onSuccess: (data) => {
      // Handle both immediate success and background processing responses
      if (data.status === "processing") {
        toast.success(data.message || "Import started successfully");
        setImportSuccess(null);
      } else {
        setImportSuccess({
          message: data.message || "Import succeeded",
          imported_count: data.imported_count,
          total_count: data.total_count,
        });
        toast.success(data.message || "Import succeeded");
      }
      setFile(null);
    },
    onError: (e) => {
      setImportSuccess(null);
      toast.error(e instanceof Error ? e.message : "Import failed");
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Streamystats Backup & Restore</CardTitle>
          <CardDescription>
            Export or restore your playback session data.
            <br />
            <b>
              Only works with the new version of Streamystats. If you want to
              import old Streamystats data please use legacy import at the
              bottom.
            </b>
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* EXPORT */}
          <div className="space-y-2">
            <h3 className="">Export Sessions</h3>
            {exportMutation.isError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  {exportMutation.error instanceof Error
                    ? exportMutation.error.message
                    : "Export failed"}
                </AlertDescription>
              </Alert>
            )}
            <Button
              onClick={() => exportMutation.mutate()}
              disabled={exportMutation.isPending}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              {exportMutation.isPending ? "Downloading..." : "Download"}
            </Button>
          </div>

          {/* IMPORT */}
          <div className="space-y-2">
            <h3 className="">Import Sessions</h3>
            {importMutation.isError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  {importMutation.error instanceof Error
                    ? importMutation.error.message
                    : "Import failed"}
                </AlertDescription>
              </Alert>
            )}
            {importSuccess && (
              <Alert variant="default" className="bg-green-50 border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <AlertTitle className="text-green-700">Success</AlertTitle>
                <AlertDescription className="text-green-600">
                  {importSuccess.message}
                  {importSuccess.imported_count &&
                    importSuccess.total_count && (
                      <p>
                        Successfully imported {importSuccess.imported_count} of{" "}
                        {importSuccess.total_count} sessions.
                      </p>
                    )}
                </AlertDescription>
              </Alert>
            )}
            <div className="flex flex-col items-start gap-4">
              <div className="w-full">
                <Input
                  type="file"
                  accept=".json"
                  onChange={(e) => {
                    setFile(e.target.files?.[0] ?? null);
                    setImportSuccess(null);
                  }}
                />
              </div>

              <Button
                onClick={() => importMutation.mutate()}
                disabled={importMutation.isPending || !file}
                className="flex items-center gap-2"
              >
                {importMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Upload and Import
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
