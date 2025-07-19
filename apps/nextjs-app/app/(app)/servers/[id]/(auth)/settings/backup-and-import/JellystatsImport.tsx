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

export default function JellystatsImport({ serverId }: { serverId: number }) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.type === "application/json" || file.name.endsWith(".json")) {
        setSelectedFile(file);
        setResult(null); // Clear previous results
      } else {
        setSelectedFile(null);
        // Reset the file input
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        toast.error("Please select a valid JSON file");
      }
    } else {
      setSelectedFile(null);
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
      const response = await fetch(
        `${basePath}/api/import/jellystats?serverId=${serverId}`,
        {
          method: "POST",
          body: selectedFile,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

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
        <CardTitle className="text-xl">Import from Jellystats</CardTitle>
        <CardDescription>
          Import your playback history from a Jellystats JSON export file. The
          file should contain session data in the Jellystats backup format.
          Sessions with missing users or media items will still be imported and
          count towards statistics.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit}
          className="space-y-4 flex flex-col items-start"
        >
          <div className="space-y-2 flex flex-col">
            <label htmlFor="jellystats-file" className="text-sm font-medium">
              Jellystats JSON Export File
            </label>
            <Input
              ref={fileInputRef}
              id="jellystats-file"
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
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload and Import
                </>
              )}
            </Button>
          </div>
        </form>

        <Accordion type="single" collapsible className="mt-6">
          <AccordionItem value="instructions">
            <AccordionTrigger className="flex items-center text-sm font-medium">
              <HelpCircle className="mr-2 h-4 w-4" />
              How to export data from Jellystats
            </AccordionTrigger>
            <AccordionContent>
              <div className="text-sm text-muted-foreground space-y-2 pt-2 pl-1">
                <ol className="list-decimal pl-5 space-y-1.5">
                  <li>Open your Jellystats instance</li>
                  <li>Navigate to Settings and select the Backup tab</li>
                  <li>
                    Select only <em className="font-semibold">Activity</em> (it
                    will appear purple when selected)
                  </li>
                  <li>Under settings click Settings</li>
                  <li>Scroll all the way to the end and start a backup</li>
                  <li>Navigate back to Backups</li>
                  <li>
                    Select Actions on the backup you just took once it is
                    visible and click Download
                  </li>
                  <li>Upload it here</li>
                </ol>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
