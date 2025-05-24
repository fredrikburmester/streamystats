"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  saveOpenAIKey,
  saveOllamaConfig,
  saveEmbeddingProvider,
  clearEmbeddings,
  getEmbeddingProgress,
  EmbeddingProgress,
  startEmbedding,
  stopEmbedding,
  toggleAutoEmbeddings,
} from "@/lib/db/server";
import { useQuery } from "@tanstack/react-query";
import { Separator } from "@/components/ui/separator";
import { Server } from "@/lib/db";
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
import { Loader, Play, Square } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export function EmbeddingsManager({ server }: { server: Server }) {
  console.log("server", server);
  // OpenAI state
  const [apiKey, setApiKey] = useState(server.open_ai_api_token || "");

  // Ollama state
  const [ollamaToken, setOllamaToken] = useState(server.ollama_api_token || "");
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState(
    server.ollama_base_url || "http://localhost:11434"
  );
  const [ollamaModel, setOllamaModel] = useState(
    server.ollama_model || "nomic-embed-text"
  );

  // Provider selection
  const [provider, setProvider] = useState<"openai" | "ollama">(
    server.embedding_provider || "openai"
  );

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [autoEmbeddings, setAutoEmbeddings] = useState(
    server.auto_generate_embeddings || false
  );
  const [isUpdatingAutoEmbed, setIsUpdatingAutoEmbed] = useState(false);

  // Update local state when server prop changes
  useEffect(() => {
    setApiKey(server.open_ai_api_token || "");
  }, [server.open_ai_api_token]);

  useEffect(() => {
    setOllamaToken(server.ollama_api_token || "");
  }, [server.ollama_api_token]);

  useEffect(() => {
    setOllamaBaseUrl(server.ollama_base_url || "http://localhost:11434");
  }, [server.ollama_base_url]);

  useEffect(() => {
    setOllamaModel(server.ollama_model || "nomic-embed-text");
  }, [server.ollama_model]);

  useEffect(() => {
    setProvider(server.embedding_provider || "openai");
  }, [server.embedding_provider]);

  useEffect(() => {
    setAutoEmbeddings(server.auto_generate_embeddings || false);
  }, [server.auto_generate_embeddings]);

  const {
    data: progress,
    error,
    isLoading,
    refetch,
  } = useQuery<EmbeddingProgress>({
    queryKey: ["embedding-progress", server.id],
    queryFn: async () => await getEmbeddingProgress(server.id),
    refetchInterval: 1000, // Poll every second
    retry: 3,
    retryDelay: 1000,
    initialData: {
      total: 0,
      processed: 0,
      status: "idle" as const,
      percentage: 0,
    },
  });

  const handleSaveApiKey = async () => {
    setIsSaving(true);
    try {
      await saveOpenAIKey(server.id, apiKey);
      toast.success("OpenAI API Key saved successfully");
      refetch();
    } catch (error) {
      toast.error("Failed to save OpenAI API key");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveOllamaConfig = async () => {
    setIsSaving(true);
    try {
      await saveOllamaConfig(server.id, {
        ollama_api_token: ollamaToken || undefined,
        ollama_base_url: ollamaBaseUrl,
        ollama_model: ollamaModel,
      });
      toast.success("Ollama configuration saved successfully");
      refetch();
    } catch (error) {
      toast.error("Failed to save Ollama configuration");
    } finally {
      setIsSaving(false);
    }
  };

  const handleProviderChange = async (newProvider: "openai" | "ollama") => {
    try {
      await saveEmbeddingProvider(server.id, newProvider);
      setProvider(newProvider);
      toast.success(
        `Switched to ${newProvider === "openai" ? "OpenAI" : "Ollama"} provider`
      );
      refetch();
    } catch (error) {
      toast.error("Failed to change embedding provider");
    }
  };

  // Check if current provider has valid configuration
  const hasValidConfig = () => {
    if (provider === "openai") {
      return !!apiKey;
    } else {
      return !!ollamaBaseUrl && !!ollamaModel;
    }
  };

  const handleStartEmbedding = async () => {
    setIsStarting(true);
    try {
      const result = await startEmbedding(server.id);
      toast.success(result.message);
      refetch();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to start embedding process"
      );
    } finally {
      setIsStarting(false);
    }
  };

  const handleStopEmbedding = async () => {
    setIsStopping(true);
    try {
      const result = await stopEmbedding(server.id);
      toast.success(result.message);
      refetch();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to stop embedding process"
      );
    } finally {
      setIsStopping(false);
    }
  };

  const handleClearEmbeddings = async () => {
    setIsClearing(true);
    try {
      const result = await clearEmbeddings(server.id);
      toast.success(result.message);
      refetch();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to clear embeddings"
      );
    } finally {
      setIsClearing(false);
      setShowClearDialog(false);
    }
  };

  const handleToggleAutoEmbeddings = async (checked: boolean) => {
    setIsUpdatingAutoEmbed(true);
    try {
      await toggleAutoEmbeddings(server.id, checked);
      setAutoEmbeddings(checked);
      toast.success(
        `Auto-generate embeddings ${checked ? "enabled" : "disabled"}`
      );
    } catch (error) {
      toast.error("Failed to update auto-embedding setting");
      // Reset to previous state
      setAutoEmbeddings(!checked);
    } finally {
      setIsUpdatingAutoEmbed(false);
    }
  };

  // Helper to get status text
  const getStatusText = (status: string) => {
    switch (status) {
      case "idle":
        return "Idle";
      case "starting":
        return "Starting embedding process...";
      case "processing":
        return "Generating embeddings for movies...";
      case "completed":
        return "All requested movies have embeddings";
      case "failed":
        return "Process failed. Please try again.";
      case "stopped":
        return "Process was stopped";
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  // Check if the process is actively running
  const isProcessRunning =
    progress?.status === "processing" || progress?.status === "starting";

  return (
    <>
      <Card className="w-full mb-6">
        <CardHeader>
          <CardTitle>AI & Embeddings</CardTitle>
          <CardDescription>
            Configure your embedding provider for AI-powered recommendations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="provider-select">Embedding Provider</Label>
              <Select
                value={provider}
                onValueChange={(value: "openai" | "ollama") =>
                  handleProviderChange(value)
                }
              >
                <SelectTrigger id="provider-select">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="ollama">Ollama</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {provider === "openai" && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium">OpenAI Configuration</h3>
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="sk-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={handleSaveApiKey}
                  disabled={isSaving || !apiKey}
                >
                  {isSaving ? "Saving..." : "Save API Key"}
                </Button>
              </div>
            </div>
          )}

          {provider === "ollama" && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Ollama Configuration</h3>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="ollama-url">Base URL</Label>
                  <Input
                    id="ollama-url"
                    placeholder="http://localhost:11434"
                    value={ollamaBaseUrl}
                    onChange={(e) => setOllamaBaseUrl(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ollama-model">Model</Label>
                  <Select value={ollamaModel} onValueChange={setOllamaModel}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nomic-embed-text">
                        nomic-embed-text (768d) - Recommended
                      </SelectItem>
                      <SelectItem value="all-minilm">
                        all-minilm (384d) - Lightweight, fast model
                      </SelectItem>
                      <SelectItem value="mxbai-embed-large">
                        mxbai-embed-large (1024d) - State-of-the-art performance
                      </SelectItem>
                      <SelectItem value="bge-large">
                        bge-large (1024d) - High-quality embeddings
                      </SelectItem>
                      <SelectItem value="bge-base">
                        bge-base (768d) - Balanced performance and speed
                      </SelectItem>
                      <SelectItem value="snowflake-arctic-embed">
                        snowflake-arctic-embed (1024d) - Optimized for retrieval
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="text-xs text-gray-400 space-y-1">
                    <p>
                      <strong className="text-gray-300">
                        All models are automatically padded to 1536 dimensions
                      </strong>{" "}
                      for compatibility with the database.
                    </p>
                    <p>
                      <strong className="text-gray-300">
                        Model dimensions:
                      </strong>{" "}
                      384d = lightweight & fast, 768d = balanced, 1024d = high
                      performance
                    </p>
                    <p>
                      Make sure the model is available in your Ollama instance:{" "}
                      <code className="bg-gray-800 text-gray-300 px-1 py-0.5 rounded text-xs">
                        ollama pull {ollamaModel}
                      </code>
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ollama-token">API Token (Optional)</Label>
                  <Input
                    id="ollama-token"
                    type="password"
                    placeholder="Leave empty if not required"
                    value={ollamaToken}
                    onChange={(e) => setOllamaToken(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleSaveOllamaConfig}
                  disabled={isSaving || (!ollamaBaseUrl && !ollamaModel)}
                  className="w-full"
                >
                  {isSaving ? "Saving..." : "Save Ollama Configuration"}
                </Button>
              </div>
            </div>
          )}

          <Separator />

          <div className="space-y-4">
            <h3 className="text-sm font-medium">Movie Embeddings</h3>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">
                Status: {getStatusText(progress?.status || "idle")}
              </span>
              <span className="text-sm text-gray-400">
                {progress?.processed || 0} of {progress?.total || 0} movies
                embedded
                {progress?.total > 0
                  ? ` (${progress.percentage.toFixed(1)}%)`
                  : ""}
              </span>
            </div>

            <Progress value={progress?.percentage || 0} className="h-2" />

            <div className="flex gap-2 mt-4">
              <Button
                onClick={handleStartEmbedding}
                disabled={isStarting || isProcessRunning || !hasValidConfig()}
                className="flex items-center gap-1"
              >
                {isStarting ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" /> Starting...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" /> Start Embedding
                  </>
                )}
              </Button>

              <Button
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
              Clearing embeddings will remove all existing embeddings and
              require re-processing.
            </p>
            <Button
              variant="destructive"
              onClick={() => setShowClearDialog(true)}
              disabled={isClearing || isProcessRunning}
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
              This action will delete all existing movie embeddings. You will
              need to regenerate them if you want to use AI-powered
              recommendations.
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
