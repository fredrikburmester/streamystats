import { revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/api-auth";
import { normalize, record, validDate } from "@/lib/ledger/engine";
import { parseSimklCsv, parseSimklJson, type ImportedRecord } from "@/lib/ledger/import";
import { resolveLedgerUser } from "@/lib/ledger/access";
import { LedgerLimitError } from "@/lib/ledger/limits";
import { getLedgerView } from "@/lib/ledger/view";
import { saveLedgerRows, resetLedgerCorrections } from "@/lib/ledger/persistence";
const serverSchema = z.coerce.number().int().positive();
const timestampSchema = z
  .string()
  .datetime({ offset: true })
  .transform((value) => {
    const result = validDate(value);
    if (!result) throw new Error("Invalid watch date");
    return result;
  });
const titleSchema = z.object({
  key: z.string().min(1).max(300),
  name: z.string().min(1).max(300),
  kind: z.enum(["tv", "movie", "anime"]),
  year: z.number().int().min(1800).max(2200).optional(),
  status: z.enum(["planned", "watching", "completed", "on-hold", "dropped"]).optional(),
  rating: z.number().min(0).max(10).optional(),
});
const correctionSchema = z.object({
  hidden: z.boolean().optional(),
  completed: z.boolean().optional(),
  rewatch: z.boolean().optional(),
  watchedAt: timestampSchema.optional(),
});
const manualSchema = z
  .object({
    title: titleSchema,
    season: z.number().int().min(0).max(1000).optional(),
    episode: z.number().int().min(0).max(100000).optional(),
    episodeTitle: z.string().max(300).optional(),
    watchedAt: timestampSchema.nullable(),
    accuracy: z.enum(["accurate", "estimated", "unknown"]),
    runtime: z.number().min(0).max(86400),
    completed: z.boolean(),
  })
  .refine(
    (v) => v.title.kind === "movie" || (v.season !== undefined && v.episode !== undefined),
    "Enter season and episode numbers.",
  );
function invalidateLedger(serverId: number, userId: string) {
  // Wrapped for every year shares this tag, including correction resets.
  revalidateTag(`ledger-${serverId}-${userId}`, { expire: 0 });
  revalidateTag(`ledger-stats-${serverId}`, { expire: 0 });
}
export async function GET(request: NextRequest) {
  const sid = serverSchema.safeParse(request.nextUrl.searchParams.get("serverId"));
  if (!sid.success) return NextResponse.json({ error: "Invalid server" }, { status: 400 });
  const auth = await requireSession(sid.data);
  if (auth.error) return auth.error;
  const userId = await resolveLedgerUser(auth.session, request.nextUrl.searchParams.get("userId"));
  if (!userId) return NextResponse.json({ error: "User is not available" }, { status: 403 });
  try {
    return NextResponse.json(
      await getLedgerView({ serverId: sid.data, userId, query: request.nextUrl.searchParams }),
    );
  } catch (error) {
    if (error instanceof LedgerLimitError)
      return NextResponse.json({ error: error.message }, { status: 413 });
    throw error;
  }
}
function sameOrigin(request: NextRequest): boolean {
  const value = request.headers.get("origin");
  if (!value) return false;
  try {
    const origin = new URL(value);
    const host =
      request.headers.get("x-forwarded-host") ??
      request.headers.get("host") ??
      request.nextUrl.host;
    return ["http:", "https:"].includes(origin.protocol) && origin.host === host;
  } catch {
    return false;
  }
}
export async function POST(request: NextRequest) {
  const sid = serverSchema.safeParse(request.nextUrl.searchParams.get("serverId"));
  if (!sid.success) return NextResponse.json({ error: "Invalid server" }, { status: 400 });
  const auth = await requireSession(sid.data);
  if (auth.error) return auth.error;
  const userId = await resolveLedgerUser(auth.session, request.nextUrl.searchParams.get("userId"));
  if (!userId) return NextResponse.json({ error: "User is not available" }, { status: 403 });
  // Mutations require a same-origin browser request; existing session cookies
  // remain the only authentication source and tokens are never sent to SIMKL.
  if (!sameOrigin(request)) return NextResponse.json({ error: "Origin mismatch" }, { status: 403 });
  try {
    let rows: ImportedRecord[] = [];
    let useIncomingDates = false;
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await request.formData(),
        file = form.get("file");
      if (!(file instanceof File) || file.size > 20 * 1024 * 1024)
        throw new Error("Choose a SIMKL JSON/CSV file under 20 MB.");
      const mode = z.enum(["merge", "use-import-dates"]).parse(form.get("importMode") ?? "merge");
      if (file.name.toLowerCase().endsWith(".zip"))
        throw new Error("Extract the SIMKL ZIP and choose the JSON file inside it.");
      if (!/\.(json|csv)$/i.test(file.name)) throw new Error("Choose a SIMKL JSON or CSV file.");
      useIncomingDates = mode === "use-import-dates" && file.name.toLowerCase().endsWith(".json");
      const text = await file.text();
      rows = file.name.toLowerCase().endsWith(".csv")
        ? parseSimklCsv(text)
        : parseSimklJson(JSON.parse(text));
    } else {
      const body = record(await request.json());
      if (!body) throw new Error("Invalid request");
      if (body.action === "manual") {
        const v = manualSchema.parse(body.entry),
          key = z.string().uuid().parse(body.idempotencyKey);
        rows = [
          {
            kind: "manual",
            sourceKey: key,
            payload: { ...v, key, source: "manual" },
          },
        ];
      } else if (body.action === "correct") {
        const key = z.string().min(1).max(1000).parse(body.key),
          patch = correctionSchema.parse(body.patch);
        rows = [
          {
            kind: "correction",
            sourceKey: key,
            payload: patch,
          },
        ];
      } else if (body.action === "restore" || body.action === "resetCorrection") {
        const key =
          body.action === "resetCorrection"
            ? z.string().min(1).max(1000).parse(body.key)
            : undefined;
        await resetLedgerCorrections({ serverId: sid.data, userId, key });
        invalidateLedger(sid.data, userId);
      } else if (body.action === "title") {
        const title = titleSchema.parse(body.title);
        rows = [{ kind: "title", sourceKey: title.key, payload: { title } }];
      } else if (body.action === "settings") {
        const v = z
          .object({
            completionThreshold: z.number().min(0.5).max(1),
            timezone: z.string().min(1).max(100),
            remotePosters: z.boolean(),
            includeImportedStats: z.boolean(),
            confirmedPriorTitles: z.array(z.string().max(300)).max(1000),
          })
          .partial()
          .parse(body.settings);
        if (v.timezone !== undefined) new Intl.DateTimeFormat("en", { timeZone: v.timezone });
        if (v.confirmedPriorTitles) v.confirmedPriorTitles = v.confirmedPriorTitles.map(normalize);
        rows = [
          {
            kind: "settings",
            sourceKey: "settings",
            payload: v,
          },
        ];
      } else throw new Error("Unknown action");
    }
    if (rows.length > 10000) throw new Error("Import exceeds 10,000 titles.");
    if (rows.length) await saveLedgerRows({ serverId: sid.data, userId, rows, useIncomingDates });
    invalidateLedger(sid.data, userId);
    return NextResponse.json({ ok: true, imported: rows.length });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to save history",
      },
      { status: 400 },
    );
  }
}
