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
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  CollectionFolder,
  getLibrariesDirectlyFromJellyfin,
} from "@/lib/jellyfin";

const FormSchema = z.object({
  url: z.string().min(2, {
    message: "Url must be at least 2 characters.",
  }),
  apikey: z.string().min(2, {
    message: "Apikey must be at least 2 characters.",
  }),
  libraries: z.array(z.string()).optional(),
});

type LibraryType = {
  Id: string;
  Name: string;
  CollectionType?: string;
};

export function SetupForm() {
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [libraries, setLibraries] = useState<CollectionFolder[]>([]);
  const [showLibraries, setShowLibraries] = useState(false);
  const router = useRouter();

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      apikey: "",
      url: "",
      libraries: [],
    },
  });

  const { watch } = form;
  const url = watch("url");
  const apikey = watch("apikey");

  async function testConnection() {
    if (!url || !apikey) {
      toast.error("Please enter a valid URL and API key");
      return;
    }

    let _url = url.trim();
    _url = _url.endsWith("/") ? _url.slice(0, -1) : _url;

    setTestingConnection(true);
    try {
      const libraries = await getLibrariesDirectlyFromJellyfin({
        api_key: apikey,
        url: _url,
      });

      if (libraries.length === 0) throw new Error("No libraries found");

      setLibraries(libraries);
      setShowLibraries(true);
      toast.success("Successfully connected to Jellyfin server");
    } catch (error) {
      console.error("Connection test failed:", error);
      toast.error("Failed to connect to Jellyfin server");
    } finally {
      setTestingConnection(false);
    }
  }

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    let url = data.url.trim();
    url = url.endsWith("/") ? url.slice(0, -1) : url;

    setLoading(true);

    try {
      const server = await createServer(url, data.apikey, data.libraries || []);

      if (!server || !server?.id) throw new Error("Server not created");

      router.push(`/servers/${server.id}/login`);
    } catch (error) {
      console.error("Error creating server:", error);
      toast.error("Error creating server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen w-full items-center justify-center px-4">
      <Card className="mx-auto lg:min-w-[500px]">
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
                      <Input placeholder="Your API key" {...field} />
                    </FormControl>
                    <FormDescription>
                      Get the api key from the admin dashboard in Jellyfin
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {!showLibraries && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={testConnection}
                  disabled={testingConnection}
                  className="mr-2"
                >
                  {testingConnection ? <Spinner /> : "Test Connection"}
                </Button>
              )}

              {showLibraries && libraries.length > 0 && (
                <div className="space-y-4">
                  <FormLabel>Select Libraries to Sync</FormLabel>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {libraries.map((library) => (
                      <FormField
                        key={library.Id}
                        control={form.control}
                        name="libraries"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 border p-4 rounded-md">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(library.Id)}
                                onCheckedChange={(checked) => {
                                  const currentValues = field.value || [];
                                  const newValues = checked
                                    ? [...currentValues, library.Id]
                                    : currentValues.filter(
                                        (value) => value !== library.Id
                                      );
                                  field.onChange(newValues);
                                }}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>{library.Name}</FormLabel>
                              <FormDescription>
                                {library.CollectionType || "Media"}
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading || form.watch("libraries")?.length === 0}
              >
                {loading ? <Spinner /> : "Create"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
