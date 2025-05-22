"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useState } from "react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/Spinner";
import { Server } from "@/lib/db";
import { updateServerUrls } from "@/lib/db/server";

const FormSchema = z.object({
  internal_url: z
    .string()
    .optional()
    .refine(
      (value) => {
        if (!value || value.trim() === "") return true;
        try {
          new URL(value);
          return true;
        } catch {
          return false;
        }
      },
      {
        message: "Internal URL must be a valid URL format",
      }
    ),
  external_url: z
    .string()
    .optional()
    .refine(
      (value) => {
        if (!value || value.trim() === "") return true;
        try {
          new URL(value);
          return true;
        } catch {
          return false;
        }
      },
      {
        message: "External URL must be a valid URL format",
      }
    ),
});

interface Props {
  server: Server;
}

export const UrlConfiguration: React.FC<Props> = ({ server }) => {
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      internal_url: server.internal_url || "",
      external_url: server.external_url || "",
    },
  });

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    setLoading(true);
    try {
      await updateServerUrls(server.id, {
        internal_url: data.internal_url?.trim() || null,
        external_url: data.external_url?.trim() || null,
      });

      toast.success("URL configuration updated successfully");

      // Refresh the page to reflect changes
      window.location.reload();
    } catch (error) {
      console.error("Error updating URL configuration:", error);
      toast.error("Failed to update URL configuration");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>URL Configuration</CardTitle>
        <CardDescription>
          Configure separate internal and external URLs for your Jellyfin
          server. This allows for different access URLs depending on whether
          requests are coming from inside your network or from external users.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">Current Legacy URL</h4>
                <p className="text-sm text-muted-foreground">
                  <strong>URL:</strong> {server.url}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  This is currently used as fallback when internal/external URLs
                  are not set.
                </p>
              </div>

              <FormField
                control={form.control}
                name="internal_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Internal URL</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="http://jellyfin:8096 or http://192.168.1.100:8096"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormDescription>
                      URL used for server-to-server communication and internal
                      API calls. This is typically a local network address or
                      container name. Leave blank to use the legacy URL.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="external_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>External URL</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://jellyfin.yourdomain.com or https://your-external-ip:8096"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormDescription>
                      URL used for user-facing requests like images and direct
                      links to Jellyfin. This is typically your public domain or
                      external IP address. Leave blank to use the legacy URL.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-950/50 rounded-lg">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                Use Case Examples
              </h4>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                <li>
                  • <strong>Internal:</strong> Local Docker container name or
                  private IP for backend communication
                </li>
                <li>
                  • <strong>External:</strong> Public domain or reverse proxy
                  URL for user access
                </li>
                <li>
                  • <strong>Network separation:</strong> Different URLs for
                  internal network vs internet access
                </li>
                <li>
                  • <strong>Load balancing:</strong> Backend vs frontend load
                  balancer endpoints
                </li>
              </ul>
            </div>

            <Button type="submit" disabled={loading}>
              {loading ? <Spinner /> : "Update URL Configuration"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
