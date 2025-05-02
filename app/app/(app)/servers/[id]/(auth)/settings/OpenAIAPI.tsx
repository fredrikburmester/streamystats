"use client";

import { useState } from "react";
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
import { toast } from "sonner";
import { saveOpenAIKey } from "@/lib/db/server";

export const OpenAIAPI = ({
  serverId,
  initialApiKey,
}: {
  serverId: number;
  initialApiKey?: string;
}) => {
  const [apiKey, setApiKey] = useState(initialApiKey || "");
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      console.log("Saving API key:", apiKey);
      await saveOpenAIKey(serverId, apiKey);
      toast.success("API Key saved successfully");
      toast;
    } catch (error) {
      toast.error("Failed to save API key");
      console.error("Failed to save API key:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>OpenAI API Key</CardTitle>
        <CardDescription>
          Enter your OpenAI API key to enable AI features like semantic search.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Input
            type="password"
            placeholder="sk-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>
      </CardContent>
      <CardFooter className="flex justify-end">
        <Button onClick={handleSave} disabled={isLoading}>
          {isLoading ? "Saving..." : "Save API Key"}
        </Button>
      </CardFooter>
    </Card>
  );
};
