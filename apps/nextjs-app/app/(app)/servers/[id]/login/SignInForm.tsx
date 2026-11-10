"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "nextjs-toploader/app";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
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
import { initiateQuickConnect, login, loginWithQuickConnect } from "@/lib/auth";
import type { ServerPublic } from "@/lib/types";

const FormSchema = z.object({
  username: z.string(),
  password: z.string().optional(),
});

interface Props {
  server: ServerPublic;
  servers: ServerPublic[];
}

export const SignInForm: React.FC<Props> = ({ server, servers }) => {
  const [loading, setLoading] = useState(false);
  const [quickConnect, setQuickConnect] = useState<{
    code: string;
    secret: string;
  } | null>(null);
  const router = useRouter();
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  useEffect(() => {
    if (!quickConnect) return;
    const interval = setInterval(async () => {
      try {
        const done = await loginWithQuickConnect({
          serverId: server.id,
          secret: quickConnect.secret,
        });
        if (!done) return;
        clearInterval(interval);
        toast.success("Logged in successfully");
        router.push(`/servers/${server.id}/dashboard`);
      } catch (error) {
        clearInterval(interval);
        setQuickConnect(null);
        toast.error("Quick Connect failed");
        console.error("Quick Connect failed:", error);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [quickConnect, server.id, router]);

  async function startQuickConnect() {
    try {
      setQuickConnect(
        await initiateQuickConnect({
          serverId: server.id,
          userAgent: navigator.userAgent,
        }),
      );
    } catch (error) {
      toast.error("Quick Connect is not enabled on this server");
      console.error("Quick Connect failed:", error);
    }
  }

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    setLoading(true);
    try {
      const result = await login({
        serverId: server.id,
        username: data.username,
        password: data.password || "",
        userAgent: navigator.userAgent,
      });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
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
          <div className="mt-6 space-y-2">
            {quickConnect ? (
              <>
                <p className="text-center font-mono text-3xl tracking-widest">
                  {quickConnect.code}
                </p>
                <p className="text-sm text-muted-foreground">
                  Enter this code under Quick Connect in your Jellyfin user
                  settings.
                </p>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={startQuickConnect}
              >
                Use Quick Connect
              </Button>
            )}
          </div>
          {/* Only show this section if there are other servers available */}
          {servers.filter((s) => s.id !== server.id).length > 0 && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center">
                <div className="h-px flex-1 bg-border" />
                <span className="px-2 text-xs text-muted-foreground">
                  Or select another server
                </span>
                <div className="h-px flex-1 bg-border" />
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
