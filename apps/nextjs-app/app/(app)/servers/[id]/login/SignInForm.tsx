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
import type { Server } from "@/lib/types";
import { useRouter } from "nextjs-toploader/app";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { login } from "@/lib/auth";

const FormSchema = z.object({
  username: z.string(),
  password: z.string().optional(),
});

interface Props {
  server: Server;
  servers: Server[];
}

export const SignInForm: React.FC<Props> = ({ server, servers }) => {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    setLoading(true);
    try {
      await login({
        serverId: server.id,
        username: data.username,
        password: data.password || "",
      });
      toast.success("Logged in successfully");
      router.push(`/servers/${server.id}/dashboard`);
    } catch (error) {
      toast.error("Error logging in");
      console.error("Error logging in:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen w-full items-center justify-center px-4">
      <Card className="mx-auto lg:min-w-[400px]">
        <CardHeader>
          <CardTitle className="text-2xl">
            Log in to{" "}
            <span className="font-bold text-blue-500">{server.name}</span>
          </CardTitle>
          <CardDescription>
            Log in to Streamystats by using your Jellyfin account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="w-full space-y-6"
            >
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="John"
                        {...field}
                        autoComplete="username"
                      />
                    </FormControl>
                    <FormDescription>
                      Enter your Jellyfin username
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="**********"
                        {...field}
                        autoComplete="current-password"
                      />
                    </FormControl>
                    <FormDescription>Jellyfin password</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit">{loading ? <Spinner /> : "Sign In"}</Button>
            </form>
          </Form>
          {/* Only show this section if there are other servers available */}
          {servers.filter((s) => s.id !== server.id).length > 0 && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center">
                <div className="h-px flex-1 bg-border"></div>
                <span className="px-2 text-xs text-muted-foreground">
                  Or select another server
                </span>
                <div className="h-px flex-1 bg-border"></div>
              </div>

              <div className="space-y-2">
                <div className="grid gap-2">
                  {servers
                    .filter((s) => s.id !== server.id)
                    .map((s) => (
                      <Button
                        key={s.id}
                        variant="outline"
                        className="flex w-full justify-between rainbow-border-glow"
                        onClick={() => router.push(`/servers/${s.id}/login`)}
                      >
                        <span className="font-medium">{s.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {s.url}
                        </span>
                      </Button>
                    ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
