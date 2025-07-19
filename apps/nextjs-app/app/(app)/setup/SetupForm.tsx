"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Spinner } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
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
import { createServer } from "@/lib/server";
import { useRouter } from "nextjs-toploader/app";
import { useState } from "react";
import { toast } from "sonner";

const FormSchema = z.object({
  url: z
    .string()
    .min(2, {
      message: "URL must be at least 2 characters.",
    })
    .refine(
      (url) => {
        return url.startsWith("http://") || url.startsWith("https://");
      },
      {
        message: "URL must start with http:// or https://",
      }
    )
    .refine(
      (url) => {
        return !url.endsWith("/");
      },
      {
        message: "URL should not end with a slash",
      }
    )
    .refine(
      (url) => {
        try {
          new URL(url);
          return true;
        } catch {
          return false;
        }
      },
      {
        message: "Please enter a valid URL",
      }
    ),
  apikey: z.string().min(2, {
    message: "API key must be at least 2 characters.",
  }),
});

export function SetupForm() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      apikey: "",
      url: "",
    },
  });

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    setLoading(true);
    try {
      // Additional validation with better error messages
      if (!data.url.startsWith("http://") && !data.url.startsWith("https://")) {
        console.warn("[SetupForm] Invalid URL protocol:", data.url);
        toast.error("URL must start with http:// or https://");
        return;
      }

      if (data.url.endsWith("/")) {
        console.warn("[SetupForm] URL ends with slash:", data.url);
        toast.error("URL should not end with a slash");
        return;
      }

      // Test if URL is valid
      let hostname: string;
      try {
        const urlObj = new URL(data.url);
        hostname = urlObj.hostname;
      } catch {
        console.error("[SetupForm] Failed to parse URL:", data.url);
        toast.error("Please enter a valid URL format");
        return;
      }

      const serverData = {
        name: hostname, // Extract hostname as name
        url: data.url,
        apiKey: data.apikey,
      };

      const response = await createServer(serverData);

      if (!response || response.success === false) {
        const errorMessage = (response && 'details' in response ? response.details : null) || "Unknown error occurred";
        
        // Handle specific error cases
        if (errorMessage.includes("A server with this URL already exists")) {
          toast.error("A server with this URL has already been added to Streamystats");
        } else if (errorMessage.includes("Invalid API key")) {
          toast.error("Invalid API key. Please check your Jellyfin API key and try again.");
        } else if (errorMessage.includes("Server not found") || errorMessage.includes("Cannot reach server")) {
          toast.error("Cannot connect to server. Please check the URL and ensure Jellyfin is running.");
        } else {
          toast.error(errorMessage);
        }
        return;
      }

      toast.success("Server created successfully! Setting up...");

      // Redirect to the server immediately - polling can happen on the destination page
      router.push(`/servers/${response.server.id}/login`);
    } catch (error) {
      console.error("[SetupForm] Error creating server:", {
        error,
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });

      toast.error(
        "Failed to create server. Please check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen w-full items-center justify-center px-4">
      <Card className="mx-auto lg:min-w-[400px]">
        <CardHeader>
          <CardTitle className="text-2xl">Set up</CardTitle>
          <CardDescription>
            Setup Streamystats by adding a Jellyfin server
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jellyfin URL</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="http://your-jellyfin-server:8096"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Enter the URL of your Jellyfin server
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="apikey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jellyfin Api Key</FormLabel>
                    <FormControl>
                      <Input placeholder="shadcn" {...field} />
                    </FormControl>
                    <FormDescription>
                      Get the api key from the admin dashboard in Jellyfin
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={loading}>
                {loading ? <Spinner /> : "Create"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
