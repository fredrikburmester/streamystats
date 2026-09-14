"use client";

import type {
  UserGroupChange,
  UserGroupSnapshot,
} from "@streamystats/database";
import { useQueryClient } from "@tanstack/react-query";
import { Merge } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { FormattedDate } from "@/components/FormattedDate";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

const groupSchema = z.object({
  id: z.string(),
  serverId: z.number(),
  primaryUserId: z.string(),
  memberUserIds: z.array(z.string()),
  revision: z.number(),
});
const accountSchema = z.object({
  id: z.string(),
  name: z.string(),
  lastActivityDate: z.string().nullable(),
  excluded: z.boolean(),
  groupId: z.string().nullable(),
});
const overviewSchema = z.object({
  accounts: z.array(accountSchema),
  groups: z.array(groupSchema),
  csrfToken: z.string(),
});
const previewSchema = z.object({
  token: z.string(),
  operationId: z.string().uuid(),
  sessionCount: z.number(),
  watchTime: z.number(),
});
type Account = z.infer<typeof accountSchema>;
const shortId = (id: string) =>
  id.length > 16 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;

async function requestJson({
  path,
  body,
  csrfToken = "",
}: {
  path: string;
  body?: unknown;
  csrfToken?: string;
}): Promise<unknown> {
  const response = await fetch(
    `${basePath}${path}`,
    body === undefined
      ? { cache: "no-store" }
      : {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-groups-csrf": csrfToken,
          },
          body: JSON.stringify(body),
        },
  );
  const data: unknown = await response.json();
  if (!response.ok) {
    const error = z.object({ error: z.string() }).safeParse(data);
    throw new Error(error.success ? error.data.error : "Request failed.");
  }
  return data;
}

export function MergeUsersManager({
  serverId,
  group,
}: {
  serverId: number;
  group?: UserGroupSnapshot;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [groups, setGroups] = useState<UserGroupSnapshot[]>([]);
  const [editing, setEditing] = useState<UserGroupSnapshot | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [primary, setPrimary] = useState("");
  const [search, setSearch] = useState("");
  const [csrfToken, setCsrfToken] = useState("");
  const [preview, setPreview] = useState<
    | (z.infer<typeof previewSchema> & {
        change: UserGroupChange;
      })
    | null
  >(null);
  const endpoint = `/api/servers/${serverId}/user-groups`;

  function chooseGroup(next: UserGroupSnapshot | null) {
    setEditing(next);
    setSelected(next?.memberUserIds ?? []);
    setPrimary(next?.primaryUserId ?? "");
    setPreview(null);
    setError(null);
    setSearch("");
  }

  async function load(targetGroupId: string | null = group?.id ?? null) {
    setBusy(true);
    setError(null);
    setPreview(null);
    try {
      const data = overviewSchema.parse(await requestJson({ path: endpoint }));
      setCsrfToken(data.csrfToken);
      setAccounts(data.accounts);
      setGroups(data.groups);
      chooseGroup(data.groups.find((g) => g.id === targetGroupId) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load accounts.");
    } finally {
      setBusy(false);
    }
  }

  async function review() {
    setBusy(true);
    setError(null);
    const change: UserGroupChange = {
      groupId: editing?.id ?? null,
      expectedRevision: editing?.revision ?? null,
      primaryUserId: primary,
      memberUserIds: selected,
    };
    try {
      setPreview({
        ...previewSchema.parse(
          await requestJson({
            path: `${endpoint}/preview`,
            body: change,
            csrfToken,
          }),
        ),
        change,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not preview merge.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      await requestJson({
        path: endpoint,
        csrfToken,
        body: {
          change: preview.change,
          previewToken: preview.token,
          operationId: preview.operationId,
        },
      });
      await queryClient.invalidateQueries();
      setOpen(false);
      toast.success(
        selected.length === 1 ? "Accounts unlinked" : "Merged accounts updated",
      );
      router.push(`/servers/${serverId}/users/${encodeURIComponent(primary)}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save merge.");
    } finally {
      setBusy(false);
    }
  }

  const selectedAccounts = accounts.filter((a) => selected.includes(a.id));
  const removed =
    editing?.memberUserIds.filter((id) => !selected.includes(id)) ?? [];
  const valid =
    selected.length >= (editing ? 1 : 2) && selected.includes(primary);

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
        <Button variant="outline" size="sm" className="gap-2">
          <Merge className="size-4" />
          {group
            ? `Merged accounts (${group.memberUserIds.length})`
            : "Merge users"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Manage merged accounts" : "Merge users"}
          </DialogTitle>
          <DialogDescription>
            Combine playback analytics for one person. Login, permissions, and
            private account data stay separate. Accounts can be unlinked later.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <div className="space-y-2">
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void load(editing?.id ?? group?.id ?? null)}
            >
              Reload accounts
            </Button>
          </div>
        )}
        {busy && accounts.length === 0 ? (
          <p role="status">Loading accounts…</p>
        ) : preview ? (
          <div className="space-y-4">
            <p className="font-medium break-words">
              {accounts.find((a) => a.id === primary)?.name} · {selected.length}{" "}
              {selected.length === 1 ? "account" : "accounts"}
            </p>
            <ul className="space-y-2 text-sm">
              {selectedAccounts.map((a) => (
                <li key={a.id} className="break-words">
                  {a.name}{" "}
                  <span className="text-muted-foreground">
                    ({shortId(a.id)}){a.id === primary ? " · Primary" : ""}
                    {a.excluded ? " · Excluded from statistics" : ""}
                  </span>
                </li>
              ))}
            </ul>
            <div className="rounded-md border p-4">
              <p>{formatDuration(preview.watchTime)} watchtime</p>
              <p className="text-sm text-muted-foreground">
                {preview.sessionCount}{" "}
                {preview.sessionCount === 1 ? "session" : "sessions"} after
                statistics exclusions
              </p>
            </div>
            {removed.length > 0 && (
              <p className="text-sm">
                Unlinking{" "}
                {removed
                  .map((id) => accounts.find((a) => a.id === id)?.name ?? id)
                  .join(", ")}
                . Their original playback history returns to separate profiles.
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Playback remains attributed to its original account.
              {selected.length > 1
                ? " New playback also appears in the combined profile."
                : " New playback appears in each separate profile."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="merge-group">Group</Label>
                <Select
                  value={editing?.id ?? "new"}
                  onValueChange={(id) =>
                    chooseGroup(groups.find((g) => g.id === id) ?? null)
                  }
                  disabled={busy}
                >
                  <SelectTrigger id="merge-group">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New merge</SelectItem>
                    {groups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {accounts.find((a) => a.id === g.primaryUserId)?.name ??
                          g.primaryUserId}{" "}
                        ({g.memberUserIds.length} accounts)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="merge-search">Accounts</Label>
              <Input
                id="merge-search"
                placeholder="Search name or account ID"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={busy}
              />
            </div>
            <div className="max-h-64 overflow-y-auto rounded-md border divide-y">
              {accounts
                .filter((a) =>
                  `${a.name} ${a.id}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                )
                .map((a) => {
                  const otherGroup =
                    a.groupId !== null && a.groupId !== editing?.id;
                  return (
                    <label
                      key={a.id}
                      htmlFor={`merge-account-${encodeURIComponent(a.id)}`}
                      className="flex min-h-14 items-start gap-3 p-3 cursor-pointer"
                    >
                      <Checkbox
                        id={`merge-account-${encodeURIComponent(a.id)}`}
                        className="mt-1"
                        checked={selected.includes(a.id)}
                        disabled={busy || otherGroup}
                        onCheckedChange={(checked) => {
                          setSelected((prev) =>
                            checked
                              ? [...prev, a.id]
                              : prev.filter((id) => id !== a.id),
                          );
                          if (checked && !primary) setPrimary(a.id);
                          if (!checked && primary === a.id) setPrimary("");
                          setPreview(null);
                        }}
                      />
                      <span className="min-w-0 flex-1 text-sm">
                        <span className="block font-medium break-words">
                          {a.name}
                        </span>
                        <span className="block text-xs text-muted-foreground break-all">
                          {a.id}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {otherGroup ? (
                            "Already in another group"
                          ) : a.excluded ? (
                            "Excluded from statistics"
                          ) : a.lastActivityDate ? (
                            <>
                              Last activity:{" "}
                              <FormattedDate date={a.lastActivityDate} />
                            </>
                          ) : (
                            "No recorded activity"
                          )}
                        </span>
                      </span>
                    </label>
                  );
                })}
            </div>
            <div className="space-y-2">
              <Label htmlFor="merge-primary">Primary account</Label>
              <Select
                value={primary}
                onValueChange={setPrimary}
                disabled={busy || selected.length === 0}
              >
                <SelectTrigger id="merge-primary">
                  <SelectValue placeholder="Choose name and avatar to display" />
                </SelectTrigger>
                <SelectContent>
                  {selectedAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} ({shortId(a.id)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {editing && (
              <p className="text-sm text-muted-foreground">
                Uncheck an account to unlink it. Choose a new primary before
                unlinking the current primary.
              </p>
            )}
          </div>
        )}
        <DialogFooter className="gap-2">
          {preview ? (
            <>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => setPreview(null)}
              >
                Back
              </Button>
              <Button disabled={busy} onClick={() => void save()}>
                {busy ? "Saving…" : "Confirm changes"}
              </Button>
            </>
          ) : (
            <Button disabled={busy || !valid} onClick={() => void review()}>
              {busy ? "Loading…" : "Preview changes"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
