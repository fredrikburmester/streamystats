"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, QrCode, Smartphone } from "lucide-react";
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
import { initiateQuickConnect, login, verifyQuickConnect } from "@/lib/auth";
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
  const [quickConnect, setQuickConnect] = useState<boolean>(false);
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
        userAgent: navigator.userAgent,
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
      <Card className="mx-auto w-full max-w-md lg:min-w-[400px]">
        <CardHeader>
          <CardTitle className="text-2xl">
            {quickConnect ? "Quick Connect to " : "Log in to "}
            <span className="font-bold text-blue-500">{server.name}</span>
          </CardTitle>
          <CardDescription>
            {quickConnect
              ? "Sign in using a Quick Connect code from your Jellyfin app"
              : "Log in to Streamystats by using your Jellyfin account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {quickConnect ? (
            <QuickConnectSignIn
              serverId={server.id}
              onBack={() => setQuickConnect(false)}
            />
          ) : (
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
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Spinner /> : "Sign In"}
                </Button>
              </form>

              <div className="my-6 flex items-center">
                <div className="h-px flex-1 bg-border" />
                <span className="px-2 text-xs uppercase tracking-wider text-muted-foreground">
                  Or
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <Button
                type="button"
                variant="outline"
                className="flex w-full items-center justify-center gap-2"
                onClick={() => setQuickConnect(true)}
              >
                <QrCode className="size-4 text-blue-500" />
                <span>Log in with Quick Connect</span>
              </Button>
            </Form>
          )}

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

export function QuickConnectSignIn({
  serverId,
  onBack,
}: {
  serverId: number;
  onBack: () => void;
}) {
  const router = useRouter();
  const [qcData, setQcData] = useState<{
    code: string;
    secret: string;
    device: { id: string; name: string };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 1. Initiate Quick Connect when modal opens
  useEffect(() => {
    initiateQuickConnect({
      serverId,
      userAgent: navigator.userAgent,
    })
      .then(setQcData)
      .catch((err) => {
        const message =
          err instanceof Error ? err.message : "Error initiating Quick Connect";
        setError(message);
        toast.error(message);
        console.error("Error initiating Quick Connect:", err);
      });
  }, [serverId]);

  // 2. Poll the server every 3 seconds once we have a secret
  useEffect(() => {
    if (!qcData) return;

    const interval = setInterval(async () => {
      try {
        const result = await verifyQuickConnect({
          serverId,
          secret: qcData.secret,
          device: qcData.device,
        });

        if (result.authenticated) {
          clearInterval(interval);
          toast.success("Logged in successfully");
          router.push(`/servers/${serverId}/dashboard`);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 3000);

    // Cleanup interval if user closes modal or navigates away
    return () => clearInterval(interval);
  }, [qcData, serverId, router]);

  return (
    <div className="space-y-6">
      {error ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
            <p className="text-sm font-medium text-destructive">{error}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Make sure Quick Connect is enabled in your Jellyfin server
              settings under Dashboard → General → Quick Connect.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={onBack}
          >
            <ArrowLeft className="mr-2 size-4" />
            Back to Password Login
          </Button>
        </div>
      ) : !qcData ? (
        <div className="flex flex-col items-center justify-center py-8 space-y-3">
          <Spinner />
          <p className="text-sm text-muted-foreground">
            Generating Quick Connect code...
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="relative flex flex-col items-center justify-center rounded-xl border border-border bg-card/60 px-6 py-8 text-center shadow-inner">
            <div className="font-mono text-4xl font-extrabold tracking-[0.3em] text-foreground sm:text-5xl">
              {qcData.code}
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-blue-500" />
              </span>
              Waiting for authorization...
            </div>
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-2.5 text-xs text-muted-foreground">
            <div className="font-medium text-foreground flex items-center gap-1.5">
              <Smartphone className="size-3.5 text-blue-400" />
              <span>How to connect:</span>
            </div>
            <ol className="list-decimal list-inside space-y-1.5 pl-1">
              <li>Open Jellyfin on your TV, mobile device, or browser</li>
              <li>
                Go to{" "}
                <span className="font-medium text-foreground">
                  User Menu → Quick Connect
                </span>
              </li>
              <li>Enter the 6-character code shown above</li>
            </ol>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={onBack}
          >
            <ArrowLeft className="mr-2 size-4" />
            Back to Password Login
          </Button>
        </div>
      )}
    </div>
  );
}
