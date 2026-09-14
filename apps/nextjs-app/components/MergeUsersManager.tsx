"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { basePath, formatDuration } from "@/lib/utils";

const identitySchema = z.object({ id: z.string(), name: z.string() });
const overviewSchema = z.object({
  accounts: z.array(identitySchema.extend({ canRetire: z.boolean() })),
  csrfToken: z.string(),
});
const previewSchema = z.object({
  source: identitySchema,
  target: identitySchema,
  transferred: z.record(z.string(), z.number()),
  watchTime: z.number(),
  token: z.string(),
  operationId: z.string().uuid(),
});
type Account = z.infer<typeof overviewSchema>["accounts"][number];

export function MergeUsersManager({ serverId }: { serverId: number }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [csrfToken, setCsrfToken] = useState("");
  const [sourceUserId, setSource] = useState("");
  const [targetUserId, setTarget] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [preview, setPreview] = useState<z.infer<typeof previewSchema> | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const endpoint = `${basePath}/api/servers/${serverId}/user-merge`;

  async function request(path: string, body?: unknown): Promise<unknown> {
    const response = await fetch(
      path,
      body === undefined
        ? { cache: "no-store" }
        : {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-user-merge-csrf": csrfToken,
            },
            body: JSON.stringify(body),
          },
    );
    const data: unknown = await response.json();
    if (!response.ok) {
      const message = z.object({ error: z.string() }).safeParse(data);
      throw new Error(message.success ? message.data.error : "Request failed.");
    }
    return data;
  }

  async function load() {
    setBusy(true);
    setError(null);
    setPreview(null);
    setConfirmation("");
    setSource("");
    setTarget("");
    try {
      const data = overviewSchema.parse(await request(endpoint));
      setAccounts(data.accounts);
      setCsrfToken(data.csrfToken);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load accounts.");
    } finally {
      setBusy(false);
    }
  }

  async function review() {
    setBusy(true);
    setError(null);
    try {
      setPreview(
        previewSchema.parse(
          await request(`${endpoint}/preview`, { sourceUserId, targetUserId }),
        ),
      );
      setConfirmation("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not preview merge.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!preview || confirmation !== "MERGE") return;
    setBusy(true);
    setError(null);
    try {
      await request(endpoint, {
        input: {
          sourceUserId: preview.source.id,
          targetUserId: preview.target.id,
        },
        previewToken: preview.token,
        operationId: preview.operationId,
        confirmation,
      });
      await queryClient.invalidateQueries();
      setOpen(false);
      toast.success("Account permanently merged");
      router.push(
        `/servers/${serverId}/users/${encodeURIComponent(preview.target.id)}`,
      );
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Merge failed. Retry the same request.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (busy) return;
        setOpen(value);
        if (value) void load();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">Merge users</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Permanently merge an account</DialogTitle>
          <DialogDescription>
            Move an old account into its replacement. The old Streamystats
            account is deleted. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {!preview ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Old accounts can be selected even if they were deleted from
              Jellyfin.
            </p>
            {[
              {
                id: "merge-source",
                label: "Old account to remove",
                value: sourceUserId,
                onChange: setSource,
                choices: accounts.filter(
                  (a) => a.canRetire && a.id !== targetUserId,
                ),
              },
              {
                id: "merge-target",
                label: "Destination account to keep",
                value: targetUserId,
                onChange: setTarget,
                choices: accounts.filter((a) => a.id !== sourceUserId),
              },
            ].map((field) => (
              <div key={field.id} className="space-y-2">
                <Label htmlFor={field.id}>{field.label}</Label>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={busy}
                >
                  <SelectTrigger id={field.id} className="min-w-0">
                    <SelectValue placeholder="Choose account" />
                  </SelectTrigger>
                  <SelectContent>
                    {field.choices.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        <span className="break-all">
                          {account.name} ({account.id})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
            <p className="text-sm text-muted-foreground">
              The destination keeps its Jellyfin login and permissions. The old
              account loses access to Streamystats. Later playback from its
              Jellyfin ID is assigned to the destination.
            </p>
          </div>
        ) : (
          <div className="space-y-4 text-sm">
            <div className="rounded-md border p-3 space-y-2">
              <p className="break-all">
                <strong>Remove:</strong> {preview.source.name} (
                {preview.source.id})
              </p>
              <p className="break-all">
                <strong>Keep:</strong> {preview.target.name} (
                {preview.target.id})
              </p>
            </div>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                {preview.transferred.sessions} playback records ·{" "}
                {formatDuration(preview.watchTime)}
              </li>
              <li>{preview.transferred.watchlists} watchlists</li>
              <li>
                {preview.transferred.hiddenRecommendations} hidden
                recommendations
              </li>
              <li>
                {preview.transferred.activities} activities and{" "}
                {preview.transferred.securityEvents} security events
              </li>
            </ul>
            <p className="text-muted-foreground">
              All records transfer, including excluded history. The
              destination’s preferences and exclusions take precedence; its
              unset watchtime preference is filled from the old account. New
              records arriving before confirmation are included.
            </p>
            <div className="space-y-2">
              <Label htmlFor="merge-confirmation">
                Type MERGE to confirm permanent deletion of the old account
              </Label>
              <Input
                id="merge-confirmation"
                autoComplete="off"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                disabled={busy}
              />
            </div>
          </div>
        )}
        <DialogFooter>
          {preview && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setPreview(null);
                setConfirmation("");
                setError(null);
              }}
            >
              Back
            </Button>
          )}
          {preview ? (
            <Button
              variant="destructive"
              disabled={busy || confirmation !== "MERGE"}
              onClick={save}
            >
              {busy ? "Merging…" : "Permanently merge"}
            </Button>
          ) : (
            <Button
              disabled={
                busy ||
                !sourceUserId ||
                !targetUserId ||
                sourceUserId === targetUserId
              }
              onClick={review}
            >
              {busy ? "Loading…" : "Review permanent merge"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
