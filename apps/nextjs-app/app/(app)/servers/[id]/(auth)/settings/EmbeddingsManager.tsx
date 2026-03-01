"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader, Play, Square } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
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
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  clearEmbeddings,
  type EmbeddingProgress,
  type EmbeddingProvider,
  getEmbeddingProgress,
  saveEmbeddingConfig,
  startEmbedding,
  stopEmbedding,
  toggleAutoEmbeddings,
} from "@/lib/db/server";
import type { ServerPublic } from "@/lib/types";

// Presets for common embedding providers
const PROVIDER_PRESETS = {
  openai: {
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "text-embedding-3-small",
    defaultDimensions: 1536,
    requiresApiKey: true,
    provider: "openai-compatible" as EmbeddingProvider,
  },
  "together-ai": {
    name: "Together AI",
    baseUrl: "https://api.together.xyz/v1",
    defaultModel: "togethercomputer/m2-bert-80M-8k-retrieval",
    defaultDimensions: 768,
    requiresApiKey: true,
    provider: "openai-compatible" as EmbeddingProvider,
  },
  fireworks: {
    name: "Fireworks AI",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    defaultModel: "nomic-ai/nomic-embed-text-v1.5",
    defaultDimensions: 768,
    requiresApiKey: true,
    provider: "openai-compatible" as EmbeddingProvider,
  },
  voyage: {
    name: "Voyage AI",
    baseUrl: "https://api.voyageai.com/v1",
    defaultModel: "voyage-2",
    defaultDimensions: 1024,
    requiresApiKey: true,
    provider: "openai-compatible" as EmbeddingProvider,
  },
  ollama: {
    name: "Ollama",
    baseUrl: "http://localhost:11434",
    defaultModel: "nomic-embed-text",
    defaultDimensions: 768,
    requiresApiKey: false,
    provider: "ollama" as EmbeddingProvider,
  },
  "lm-studio": {
    name: "LM Studio",
    baseUrl: "http://localhost:1234/v1",
    defaultModel: "text-embedding-nomic-embed-text-v1.5",
    defaultDimensions: 768,
    requiresApiKey: false,
    provider: "openai-compatible" as EmbeddingProvider,
  },
  localai: {
    name: "LocalAI",
    baseUrl: "http://localhost:8080/v1",
    defaultModel: "text-embedding-ada-002",
    defaultDimensions: 1536,
    requiresApiKey: false,
    provider: "openai-compatible" as EmbeddingProvider,
  },
  custom: {
    name: "Custom",
    baseUrl: "",
    defaultModel: "",
    defaultDimensions: 1536,
    requiresApiKey: false,
    provider: "openai-compatible" as EmbeddingProvider,
  },
} as const;

type PresetKey = keyof typeof PROVIDER_PRESETS;

// Embeddings sync runs every 15 minutes (cron */15 * * * *) at :00, :15, :30, :45
const EMBEDDINGS_CRON_INTERVAL_MINUTES = 15;

function getNextEmbeddingsRunTime(): Date {
  const now = new Date();
  const minute = now.getMinutes();
  const nextMinute = Math.ceil((minute + 1) / EMBEDDINGS_CRON_INTERVAL_MINUTES) * EMBEDDINGS_CRON_INTERVAL_MINUTES;
  const next = new Date(now);
  if (nextMinute >= 60) {
    next.setHours(next.getHours() + 1);
    next.setMinutes(0, 0, 0);
  } else {
    next.setMinutes(nextMinute, 0, 0);
  }
  return next;
}

function formatTimeUntil(until: Date): string {
  const ms = until.getTime() - Date.now();
  if (ms <= 0) return "any moment";
  const sec = Math.floor(ms / 1000) % 60;
  const min = Math.floor(ms / 60000);
  if (min > 0) return `${min}m ${sec}s`;
  return `${sec}s`;
}

// Detect preset from server config
function detectPreset(server: ServerPublic): PresetKey {
  const baseUrl = server.embeddingBaseUrl || "";
  for (const [key, preset] of Object.entries(PROVIDER_PRESETS)) {
    if (key !== "custom" && baseUrl === preset.baseUrl) {
      return key as PresetKey;
    }
  }
  return baseUrl ? "custom" : "openai";
}

export function EmbeddingsManager({ server }: { server: ServerPublic }) {
  // Preset selection
  const [selectedPreset, setSelectedPreset] = useState<PresetKey>(
    detectPreset(server),
  );

  // Embedding config state
  const [baseUrl, setBaseUrl] = useState(
    server.embeddingBaseUrl || PROVIDER_PRESETS.openai.baseUrl,
  );
  // Don't pre-fill API key for security - just track if one exists
  const [apiKey, setApiKey] = useState("");
  const hasExistingApiKey = server.hasEmbeddingApiKey;
  const [model, setModel] = useState(
    server.embeddingModel || PROVIDER_PRESETS.openai.defaultModel,
  );
  const [dimensions, setDimensions] = useState(
    server.embeddingDimensions || 1536,
  );
  const [provider, setProvider] = useState<EmbeddingProvider>(
    (server.embeddingProvider as EmbeddingProvider) || "openai-compatible",
  );

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [autoEmbeddings, setAutoEmbeddings] = useState(
    server.autoGenerateEmbeddings || false,
  );
  const [isUpdatingAutoEmbed, setIsUpdatingAutoEmbed] = useState(false);
  const [nextRunTime, setNextRunTime] = useState<Date>(() => getNextEmbeddingsRunTime());
  const [timeUntilNext, setTimeUntilNext] = useState<string>("");

  // Update next-run countdown every second when auto embeddings is on
  useEffect(() => {
    if (!autoEmbeddings) {
      setTimeUntilNext("");
      return;
    }
    const tick = () => {
      const next = getNextEmbeddingsRunTime();
      setNextRunTime(next);
      setTimeUntilNext(formatTimeUntil(next));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [autoEmbeddings]);

  const {
    data: progress,
    error,
    isLoading: _isLoading,
    refetch,
  } = useQuery<EmbeddingProgress>({
    queryKey: ["embedding-progress", server.id],
    queryFn: async () => await getEmbeddingProgress({ serverId: server.id }),
    refetchInterval: 2000,
    retry: 3,
    retryDelay: 1000,
  });

  const handlePresetChange = (preset: PresetKey) => {
    setSelectedPreset(preset);
    const presetConfig = PROVIDER_PRESETS[preset];
    if (preset === "custom") {
      // Custom defaults to openai-compatible (user can still enter any URL)
      setProvider("openai-compatible");
    } else {
      setBaseUrl(presetConfig.baseUrl);
      setModel(presetConfig.defaultModel);
      setDimensions(presetConfig.defaultDimensions);
      setProvider(presetConfig.provider);
    }
  };

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      await saveEmbeddingConfig({
        serverId: server.id,
        config: {
          provider,
          baseUrl,
          apiKey: apiKey || undefined,
          model,
          dimensions,
        },
      });
      toast.success("Embedding configuration saved");
      refetch();
    } catch (_error) {
      toast.error("Failed to save embedding configuration");
    } finally {
      setIsSaving(false);
    }
  };

  // Check if current provider has valid configuration
  const hasValidConfig = () => {
    const preset = PROVIDER_PRESETS[selectedPreset];
    // API key is valid if: already saved OR newly entered
    const hasApiKey = hasExistingApiKey || !!apiKey;
    if (preset.requiresApiKey && !hasApiKey) {
      return false;
    }
    return !!baseUrl && !!model;
  };

  // Check for dimension mismatch with existing embeddings
  const existingDimension = progress?.existingDimension;
  const hasDimensionMismatch =
    existingDimension !== null &&
    existingDimension !== undefined &&
    existingDimension !== dimensions;

  const handleStartEmbedding = async () => {
    setIsStarting(true);
    try {
      await startEmbedding({ serverId: server.id });
      toast.success("Embedding process started");
      refetch();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to start embedding process",
      );
    } finally {
      setIsStarting(false);
    }
  };

  const handleStopEmbedding = async () => {
    setIsStopping(true);
    try {
      await stopEmbedding({ serverId: server.id });
      toast.success("Embedding process stopped");
      refetch();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to stop embedding process",
      );
    } finally {
      setIsStopping(false);
    }
  };

  const _handleCleanupStaleJobs = async () => {
    try {
      const jobServerUrl =
        process.env.JOB_SERVER_URL && process.env.JOB_SERVER_URL !== "undefined"
          ? process.env.JOB_SERVER_URL
          : "http://localhost:3005";

      const response = await fetch(`${jobServerUrl}/api/jobs/cleanup-stale`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to cleanup stale jobs");
      }

      const result = await response.json();

      if (result.cleanedJobs > 0) {
        toast.success(
          `Cleaned up ${result.cleanedJobs} stale embedding job(s)`,
        );
      } else {
        toast.info("No stale embedding jobs to cleanup");
      }

      refetch();
    } catch (error) {
      console.error("Error cleaning up stale jobs:", error);
      toast.error("Failed to cleanup stale jobs");
    }
  };

  const handleClearEmbeddings = async () => {
    setIsClearing(true);
    try {
      // Stop any running embedding jobs first
      try {
        await stopEmbedding({ serverId: server.id });
      } catch {
        // Ignore errors - job might not be running
      }
      await clearEmbeddings({ serverId: server.id });
      toast.success("Embeddings and vector index cleared");
      refetch();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to clear embeddings",
      );
    } finally {
      setIsClearing(false);
      setShowClearDialog(false);
    }
  };

  const handleToggleAutoEmbeddings = async (checked: boolean) => {
    setIsUpdatingAutoEmbed(true);
    try {
      await toggleAutoEmbeddings({ serverId: server.id, enabled: checked });
      setAutoEmbeddings(checked);
      toast.success(
        `Auto-generate embeddings ${checked ? "enabled" : "disabled"}`,
      );
    } catch (_error) {
      toast.error("Failed to update auto-embedding setting");
      // Reset to previous state
      setAutoEmbeddings(!checked);
    } finally {
      setIsUpdatingAutoEmbed(false);
    }
  };

  // Check if the process is actively running
  const isProcessRunning =
    progress?.status === "processing" || progress?.status === "starting";

  // Helper to get status text
  const getStatusText = (status: string) => {
    switch (status) {
      case "idle":
        return "Idle";
      case "starting":
        return "Starting embedding process...";
      case "processing":
        return "Generating embeddings for movies and series...";
      case "completed":
        return "All requested items have embeddings";
      case "failed":
        return "Process failed. Please try again.";
      case "stopped":
        return "Process was stopped";
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  return (
    <>
      <Card className="w-full mb-6">
        <CardHeader>
          <CardTitle>AI & Embeddings</CardTitle>
          <CardDescription>
            Configure your embedding provider for AI-powered recommendations.
            Supports any OpenAI-compatible API.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="preset-select">Provider Preset</Label>
              <Select
                value={selectedPreset}
                onValueChange={(value: PresetKey) => handlePresetChange(value)}
              >
                <SelectTrigger id="preset-select">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="together-ai">Together AI</SelectItem>
                  <SelectItem value="fireworks">Fireworks AI</SelectItem>
                  <SelectItem value="voyage">Voyage AI</SelectItem>
                  <SelectItem value="ollama">Ollama (Local)</SelectItem>
                  <SelectItem value="lm-studio">LM Studio (Local)</SelectItem>
                  <SelectItem value="localai">LocalAI (Local)</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Select a preset or choose Custom for any OpenAI-compatible API
              </p>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-sm font-medium">
              {PROVIDER_PRESETS[selectedPreset].name} Configuration
            </h3>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="base-url">Base URL</Label>
                <Input
                  id="base-url"
                  placeholder="https://api.openai.com/v1"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="api-key">
                  API Key{" "}
                  {!PROVIDER_PRESETS[selectedPreset].requiresApiKey &&
                    "(Optional)"}
                </Label>
                <Input
                  id="api-key"
                  type="password"
                  placeholder={
                    hasExistingApiKey
                      ? "API key saved (enter new key to replace)"
                      : PROVIDER_PRESETS[selectedPreset].requiresApiKey
                        ? "Required"
                        : "Optional"
                  }
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                {hasExistingApiKey && !apiKey && (
                  <p className="text-xs text-green-600 dark:text-green-400">
                    An API key is already saved. Leave empty to keep it.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  placeholder="text-embedding-3-small"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Enter the embedding model name supported by your provider
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dimensions">Dimensions</Label>
                <Input
                  id="dimensions"
                  type="number"
                  placeholder="1536"
                  value={dimensions}
                  onChange={(e) =>
                    setDimensions(Number.parseInt(e.target.value, 10) || 1536)
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Must match your embedding model output. OpenAI models support
                  dimension reduction via the dimensions parameter.
                  {existingDimension && (
                    <span className="block mt-1">
                      Current embeddings: {existingDimension} dimensions
                    </span>
                  )}
                </p>
                {dimensions > 2000 && (
                  <div className="mt-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
                    <p className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">
                      Dimensions over 2000 skip the HNSW index (pgvector limit).
                      Queries will work but may be slower for large libraries.
                    </p>
                  </div>
                )}
                {hasDimensionMismatch && (
                  <div className="mt-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                    <p className="text-xs text-destructive font-medium">
                      Dimension mismatch: existing embeddings have{" "}
                      {existingDimension} dimensions, but configured is{" "}
                      {dimensions}. Clear existing embeddings before changing
                      dimensions.
                    </p>
                  </div>
                )}
              </div>

              {selectedPreset === "ollama" && (
                <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted rounded-md">
                  <p>
                    Make sure the model is available in your Ollama instance:
                  </p>
                  <code className="bg-background px-2 py-1 rounded text-xs block">
                    ollama pull {model}
                  </code>
                </div>
              )}

              <Button
                type="button"
                onClick={handleSaveConfig}
                disabled={isSaving || !baseUrl || !model}
                className="w-full"
              >
                {isSaving ? "Saving..." : "Save Configuration"}
              </Button>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-sm font-medium">Movie Embeddings</h3>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">
                Status: {getStatusText(progress?.status ?? "idle")}
              </span>
              <span className="text-sm text-gray-400">
                {progress?.processed ?? 0} of {progress?.total ?? 0} items
                embedded
                {(progress?.total ?? 0) > 0
                  ? ` (${(progress?.percentage ?? 0).toFixed(1)}%)`
                  : ""}
              </span>
            </div>
            {typeof progress?.total === "number" && typeof progress?.processed === "number" && (
              <p className="text-sm text-muted-foreground -mt-1 mb-1">
                <span className="font-medium">
                  {(progress.total - progress.processed).toLocaleString()} items remaining
                </span> to process for AI recommendations.
              </p>
            )}

            <Progress value={progress?.percentage ?? 0} className="h-2" />

            {autoEmbeddings && !isProcessRunning && (progress?.total ?? 0) > (progress?.processed ?? 0) && (
              <p className="text-sm text-muted-foreground">
                Next scheduled batch: <span className="font-medium tabular-nums">{timeUntilNext}</span>
                <span className="text-xs text-muted-foreground block mt-0.5">
                  Runs every 15 minutes when auto-generate is on
                </span>
              </p>
            )}

            <div className="flex flex-wrap gap-2 mt-4">
              <Button
                type="button"
                onClick={handleStartEmbedding}
                disabled={
                  isStarting ||
                  isProcessRunning ||
                  !hasValidConfig() ||
                  hasDimensionMismatch
                }
                className="flex items-center gap-1"
              >
                {isStarting ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" /> Starting...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" /> {(progress?.total ?? 0) > (progress?.processed ?? 0)
                      ? "Start next batch"
                      : "Start embedding"}
                  </>
                )}
              </Button>

              <Button
                type="button"
                onClick={handleStopEmbedding}
                disabled={isStopping || !isProcessRunning}
                variant="secondary"
                className="flex items-center gap-1"
              >
                {isStopping ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" /> Stopping...
                  </>
                ) : (
                  <>
                    <Square className="h-4 w-4" /> Stop Embedding
                  </>
                )}
              </Button>
            </div>

            {error && (
              <div className="text-sm text-red-400 mt-2">
                Error fetching progress. Retrying...
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-sm font-medium">Auto-Generate Embeddings</h3>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-sm text-gray-400">
                  Automatically generate embeddings for all (and new) items
                </p>
                <p className="text-xs text-gray-400">
                  This requires a valid embedding provider configuration
                </p>
              </div>
              <Switch
                checked={autoEmbeddings}
                onCheckedChange={handleToggleAutoEmbeddings}
                disabled={isUpdatingAutoEmbed || !hasValidConfig()}
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-sm font-medium">Clear Embeddings</h3>
            <p className="text-sm text-gray-400">
              Clearing embeddings will remove all existing embeddings, reset the
              vector index, and require re-processing. Use this to fix dimension
              mismatches when changing embedding models.
            </p>
            <Button
              type="button"
              variant="destructive"
              onClick={() => setShowClearDialog(true)}
              disabled={isClearing}
            >
              {isClearing ? "Clearing..." : "Clear All Embeddings"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all embeddings and reset the vector index. Use
              this to fix dimension mismatches when switching embedding models.
              You will need to regenerate embeddings for AI recommendations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleClearEmbeddings();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isClearing ? "Clearing..." : "Clear Embeddings"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
