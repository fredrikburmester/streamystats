"use client";

import { Loader, Zap } from "lucide-react";
import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  type ChatProvider,
  clearChatConfig,
  saveChatConfig,
  testChatConnection,
} from "@/lib/db/server";
import type { ServerPublic } from "@/lib/types";

const PROVIDER_PRESETS = {
  openai: {
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    requiresApiKey: true,
    provider: "openai-compatible" as ChatProvider,
  },
  anthropic: {
    name: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-3-5-sonnet-latest",
    requiresApiKey: true,
    provider: "anthropic" as ChatProvider,
  },
  "together-ai": {
    name: "Together AI",
    baseUrl: "https://api.together.xyz/v1",
    defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    requiresApiKey: true,
    provider: "openai-compatible" as ChatProvider,
  },
  fireworks: {
    name: "Fireworks AI",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    defaultModel: "accounts/fireworks/models/llama-v3p1-70b-instruct",
    requiresApiKey: true,
    provider: "openai-compatible" as ChatProvider,
  },
  groq: {
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
    requiresApiKey: true,
    provider: "openai-compatible" as ChatProvider,
  },
  ollama: {
    name: "Ollama",
    baseUrl: "http://localhost:11434/v1",
    defaultModel: "llama3.2",
    requiresApiKey: false,
    provider: "ollama" as ChatProvider,
  },
  "lm-studio": {
    name: "LM Studio",
    baseUrl: "http://localhost:1234/v1",
    defaultModel: "local-model",
    requiresApiKey: false,
    provider: "openai-compatible" as ChatProvider,
  },
  custom: {
    name: "Custom",
    baseUrl: "",
    defaultModel: "",
    requiresApiKey: false,
    provider: "openai-compatible" as ChatProvider,
  },
} as const;

type PresetKey = keyof typeof PROVIDER_PRESETS;

function detectPreset(server: ServerPublic): PresetKey {
  const baseUrl = server.chatBaseUrl || "";
  for (const [key, preset] of Object.entries(PROVIDER_PRESETS)) {
    if (key !== "custom" && baseUrl === preset.baseUrl) {
      return key as PresetKey;
    }
  }
  if (server.chatProvider === "anthropic") {
    return "anthropic";
  }
  return baseUrl ? "custom" : "openai";
}

export function ChatAIManager({ server }: { server: ServerPublic }) {
  const [selectedPreset, setSelectedPreset] = useState<PresetKey>(
    detectPreset(server),
  );

  const [baseUrl, setBaseUrl] = useState(
    server.chatBaseUrl || PROVIDER_PRESETS.openai.baseUrl,
  );
  // Don't pre-fill API key for security - just track if one exists
  const [apiKey, setApiKey] = useState("");
  const hasExistingApiKey = server.hasChatApiKey;
  const [model, setModel] = useState(
    server.chatModel || PROVIDER_PRESETS.openai.defaultModel,
  );
  const [provider, setProvider] = useState<ChatProvider>(
    (server.chatProvider as ChatProvider) || "openai-compatible",
  );

  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);

  const handlePresetChange = (preset: PresetKey) => {
    setSelectedPreset(preset);
    const presetConfig = PROVIDER_PRESETS[preset];
    if (preset === "custom") {
      setProvider("openai-compatible");
    } else {
      setBaseUrl(presetConfig.baseUrl);
      setModel(presetConfig.defaultModel);
      setProvider(presetConfig.provider);
    }
  };

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      await saveChatConfig({
        serverId: server.id,
        config: {
          provider,
          baseUrl,
          apiKey: apiKey || undefined,
          model,
        },
      });
      toast.success("AI Chat configuration saved");
    } catch (_error) {
      toast.error("Failed to save AI Chat configuration");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      const result = await testChatConnection({
        config: {
          provider,
          baseUrl,
          apiKey: apiKey || undefined,
          model,
        },
      });
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (_error) {
      toast.error("Failed to test connection");
    } finally {
      setIsTesting(false);
    }
  };

  const hasValidConfig = () => {
    const preset = PROVIDER_PRESETS[selectedPreset];
    // API key is valid if: already saved OR newly entered
    const hasApiKey = hasExistingApiKey || !!apiKey;
    if (preset.requiresApiKey && !hasApiKey) {
      return false;
    }
    return !!baseUrl && !!model;
  };

  const handleClearConfig = async () => {
    setIsClearing(true);
    try {
      await clearChatConfig({ serverId: server.id });
      toast.success("AI Chat configuration cleared");
      setBaseUrl(PROVIDER_PRESETS.openai.baseUrl);
      setApiKey("");
      setModel(PROVIDER_PRESETS.openai.defaultModel);
      setProvider("openai-compatible");
      setSelectedPreset("openai");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to clear configuration",
      );
    } finally {
      setIsClearing(false);
      setShowClearDialog(false);
    }
  };

  return (
    <>
      <Card className="w-full mb-6">
        <CardHeader>
          <CardTitle>AI Chat</CardTitle>
          <CardDescription>
            Configure an AI provider to enable the chat assistant. Use Cmd+K to
            ask questions about your watch history and get recommendations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="preset-select">Provider</Label>
              <Select
                value={selectedPreset}
                onValueChange={(value: PresetKey) => handlePresetChange(value)}
              >
                <SelectTrigger id="preset-select">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                  <SelectItem value="together-ai">Together AI</SelectItem>
                  <SelectItem value="fireworks">Fireworks AI</SelectItem>
                  <SelectItem value="groq">Groq</SelectItem>
                  <SelectItem value="ollama">Ollama (Local)</SelectItem>
                  <SelectItem value="lm-studio">LM Studio (Local)</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Select a provider or choose Custom for any OpenAI-compatible API
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
                  placeholder="gpt-4o-mini"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Enter the chat model name supported by your provider
                </p>
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

              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={handleSaveConfig}
                  disabled={isSaving || !baseUrl || !model}
                  className="flex-1"
                >
                  {isSaving ? "Saving..." : "Save Configuration"}
                </Button>
                <Button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting || !hasValidConfig()}
                  variant="outline"
                  className="flex items-center gap-1"
                >
                  {isTesting ? (
                    <>
                      <Loader className="h-4 w-4 animate-spin" /> Testing...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4" /> Test
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-sm font-medium">Clear Configuration</h3>
            <p className="text-sm text-gray-400">
              Remove the AI Chat configuration from this server.
            </p>
            <Button
              type="button"
              variant="destructive"
              onClick={() => setShowClearDialog(true)}
              disabled={isClearing || !server.chatProvider}
            >
              {isClearing ? "Clearing..." : "Clear Configuration"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear AI Chat Configuration?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the AI Chat configuration. The chat feature will
              be disabled until you configure a new provider.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleClearConfig();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isClearing ? "Clearing..." : "Clear Configuration"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
