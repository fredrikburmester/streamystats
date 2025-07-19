"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Info,
  Loader2,
  Upload,
  Database,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

interface ImportResult {
  success: boolean;
  message: string;
  imported_count?: number;
  total_count?: number;
  error_count?: number;
  error?: string;
}

export default function LegacyImport({ serverId }: { serverId: number }) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setResult(null); // Clear previous results
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFile) {
      toast.error("Please select a file first");
      return;
    }

    setIsUploading(true);
    setResult(null);

    try {
      const response = await fetch(`${basePath}/api/import/legacy?serverId=${serverId}`, {
        method: "POST",
        body: selectedFile,
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data: ImportResult = await response.json();

      if (data.success) {
        toast.success(data.message);
        setResult(data);
        // Reset form
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } else {
        toast.error(data.error || data.message);
        setResult(data);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Upload failed";
      toast.error(errorMessage);
      setResult({
        success: false,
        error: errorMessage,
        message: "Upload failed",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          Legacy Streamystats V1 Database Import
        </CardTitle>
        <CardDescription>
          Import your playback history from a legacy .json file. This is a
          one-way import that converts your historical session data from older
          StreamyStats system.
          <br />
          If you have a .db file you need to convert it to a .json file first by
          using the sqlite3 command line tool.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit}
          className="space-y-4 flex flex-col items-start"
        >
          <div className="space-y-2 flex flex-col">
            <label htmlFor="legacy-file" className="text-sm font-medium">
              Legacy Database File (.json)
            </label>
            <Input
              ref={fileInputRef}
              id="legacy-file"
              name="file"
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              className="cursor-pointer"
              disabled={isUploading}
            />
            {selectedFile && (
              <p className="text-sm text-muted-foreground">
                Selected file: {selectedFile.name} (
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>

          {result && (
            <Alert variant={result.success ? "default" : "destructive"}>
              {result.success && <CheckCircle2 className="h-4 w-4" />}
              {!result.success && <AlertCircle className="h-4 w-4" />}
              <AlertTitle>{result.success ? "Success" : "Error"}</AlertTitle>
              <AlertDescription>
                {result.message}
                {result.success &&
                  result.imported_count !== undefined &&
                  result.total_count !== undefined && (
                    <div className="mt-2 text-sm">
                      <p>Imported: {result.imported_count}</p>
                      <p>Total processed: {result.total_count}</p>
                      {result.error_count !== undefined &&
                        result.error_count > 0 && (
                          <p>Errors: {result.error_count}</p>
                        )}
                    </div>
                  )}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col items-start justify-start">
            <Button
              type="submit"
              disabled={isUploading || !selectedFile}
              className="w-full"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Import Legacy Data
                </>
              )}
            </Button>
          </div>
        </form>

        <Accordion type="single" collapsible className="w-full mt-6">
          <AccordionItem value="help">
            <AccordionTrigger className="text-left">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4" />
                Import Instructions & File Format
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Supported File Format</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  The legacy import supports JSON files containing an array of
                  session objects with the following structure:
                </p>
                <div className="bg-muted p-3 rounded-md">
                  <code className="text-xs">
                    {`[
  {
    "id": "10",
    "user_jellyfin_id": "e60d0b070c2c47b4bfd2c004be832ffa",
    "device_id": "61e41983ecd931e172a5fcae6bc4dda904044f94",
    "device_name": "Device Name",
    "client_name": "Android TV",
    "item_jellyfin_id": "78d9d92209a0e2f3cd26229785c85427",
    "item_name": "The Infestation Hypothesis",
    "series_jellyfin_id": "6c5e0f7fabfb21e8cf99534cc5d1addf",
    "series_name": "The Big Bang Theory",
    "season_jellyfin_id": "d09ffaeb33895cfc10ae5c9a29a66124",
    "play_duration": "177",
    "play_method": "DirectPlay",
    "start_time": "2025-03-30T20:31:41Z",
    "end_time": "2025-03-30T20:34:51Z",
    "position_ticks": "1802240000",
    "runtime_ticks": "11862580000",
    "percent_complete": 15.192647805114909,
    "completed": "false",
    "server_id": "1",
    "inserted_at": "2025-03-30T20:34:51",
    "updated_at": "2025-03-30T20:34:51"
  }
]`}
                  </code>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Important Notes</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>
                    This is a one-way import - data cannot be exported back to
                    legacy format
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium mb-2">
                  Converting .db File to JSON
                </h4>
                <p className="text-sm text-muted-foreground mb-2">
                  If you have a legacy .db file, you need to convert it to JSON
                  format first using the sqlite3 command line tool:
                </p>
                <div className="bg-muted p-3 rounded-md">
                  <code className="text-xs font-mono">
                    sqlite3 input.db -json "SELECT * FROM playback_sessions;"
                    &gt; output.json
                  </code>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Replace{" "}
                  <code className="bg-muted px-1 rounded text-xs">
                    input.db
                  </code>{" "}
                  with your database file name and{" "}
                  <code className="bg-muted px-1 rounded text-xs">
                    output.json
                  </code>{" "}
                  with your desired output file name.
                </p>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Data Migration</AlertTitle>
                <AlertDescription>
                  This import feature is designed for migrating from legacy
                  tracking systems. Make sure your legacy database is exported
                  in the correct JSON format before importing.
                </AlertDescription>
              </Alert>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
