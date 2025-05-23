"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { PageTitle } from "@/components/PageTitle";
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
import { createServer } from "@/lib/db";
import { useRouter } from "nextjs-toploader/app";
import { useState } from "react";
import { toast } from "sonner";

const FormSchema = z.object({
  url: z.string().min(2, {
    message: "Url must be at least 2 characters.",
  }),
  apikey: z.string().min(2, {
    message: "Apikey must be at least 2 characters.",
  }),
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

export function SetupForm() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      apikey: "",
      url: "",
      internal_url: "",
      external_url: "",
    },
  });

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    setLoading(true);
    try {
      const server = await createServer(
        data.url,
        data.apikey,
        data.internal_url?.trim() || undefined,
        data.external_url?.trim() || undefined
      );

      if (!server || !server?.id) throw new Error("Server not created");

      router.push(`/servers/${server.id}/login`);
      // You can add a success message or redirect the user here
    } catch (error) {
      console.error("Error creating server:", error);
      toast.error("Error creating server");
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

              <div className="space-y-4">
                <div className="text-sm font-medium text-muted-foreground">
                  Advanced Configuration (Optional)
                </div>

                <FormField
                  control={form.control}
                  name="internal_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Internal URL (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="http://jellyfin:8096" {...field} />
                      </FormControl>
                      <FormDescription>
                        URL for server-to-server communication. Leave blank to
                        use the main URL.
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
                      <FormLabel>External URL (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://jellyfin.yourdomain.com"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        URL for user-facing requests. Leave blank to use the
                        main URL.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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
