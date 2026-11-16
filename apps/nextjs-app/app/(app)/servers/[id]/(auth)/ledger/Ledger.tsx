"use client";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import {
  CalendarDays,
  Hourglass,
  ChevronDown,
  Clock,
  Film,
  Import,
  Plus,
  Repeat,
  Search,
  Settings2,
  Tv,
  Undo2,
  X,
} from "lucide-react";
import { newManualRequestKey } from "@/lib/ledger/request-key";
import type { getLedgerView } from "@/lib/ledger/view";
import {
  simklPoster,
  dayKey,
  validDate,
  record,
  normalize,
  type Title,
  type Watch,
} from "@/lib/ledger/engine";
import { basePath, getJellyfinImageUrl } from "@/lib/utils";
import { formatLedgerDuration as seconds } from "@/lib/ledger/duration";
import "./ledger.css";
type Data = Awaited<ReturnType<typeof getLedgerView>>;
const label = (watch: Watch) =>
  watch.title.kind === "movie"
    ? watch.title.name
    : watch.season !== undefined && watch.episode !== undefined
      ? `S${String(watch.season).padStart(2, "0")} E${String(watch.episode).padStart(2, "0")} · ${watch.episodeTitle}`
      : watch.episodeTitle;
function Modal({
  children,
  onClose,
  label,
}: {
  children: React.ReactNode;
  onClose: () => void;
  label: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="wl-native-dialog"
      aria-label={label}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      {children}
    </dialog>
  );
}
function dateLabel(day: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${day}T12:00:00Z`));
}
function dayOffset(day: string, n: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function Monday(day: string) {
  const d = new Date(`${day}T12:00:00Z`);
  return dayOffset(day, -((d.getUTCDay() + 6) % 7));
}
export function Ledger({
  initial,
  serverId,
  serverUrl,
  selectedUserId,
  availableUsers,
}: {
  initial: Data;
  serverId: number;
  serverUrl: string;
  selectedUserId: string;
  availableUsers: { id: string; name: string }[];
}) {
  const router = useRouter(),
    pathname = usePathname(),
    searchParams = useSearchParams();
  const [switching, setSwitching] = useState(false);
  const selectedName =
    availableUsers.find((user) => user.id === selectedUserId)?.name ?? "Selected user";
  const [data, setData] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [tab, setTab] = useState("history"),
    [kind, setKind] = useState("all"),
    [search, setSearch] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [manual, setManual] = useState(false),
    [importOpen, setImportOpen] = useState(false),
    [importMode, setImportMode] = useState("merge"),
    [importSelection, setImportSelection] = useState<File[]>([]),
    [edit, setEdit] = useState<Watch | null>(null),
    [settings, setSettings] = useState(false),
    [statusFilter, setStatusFilter] = useState("all"),
    [watchStatus, setWatchStatus] = useState("all"),
    [page, setPage] = useState(0),
    [listPage, setListPage] = useState(0),
    [loading, setLoading] = useState(false);
  const manualRequestId = useRef<string>("");
  const generation = useRef(0),
    mutating = useRef(false);
  const settingsBaseline = useRef(initial.settings);
  const upload = useRef<HTMLInputElement>(null),
    zone = data.settings.timezone;
  const today = dayKey(new Date().toISOString(), zone);
  const endpoint = `${basePath}/api/ledger?${new URLSearchParams({
    serverId: String(serverId),
    userId: selectedUserId,
    kind,
    search,
    watchStatus,
    from,
    to,
    page: String(page),
  })}`;
  async function refresh() {
    const ticket = generation.current;
    const r = await fetch(endpoint, { cache: "no-store" });
    if (!r.ok) throw new Error("Unable to refresh history. Please log in again.");
    const result = await r.json();
    if (ticket === generation.current) setData(result);
  }
  function changedSettings(incoming: Record<string, unknown>) {
    const baseline = record(settingsBaseline.current) ?? {};
    return Object.fromEntries(
      Object.entries(incoming).filter(
        ([key, value]) => JSON.stringify(value) !== JSON.stringify(baseline[key]),
      ),
    );
  }
  async function mutate(body: unknown) {
    generation.current++;
    mutating.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error ?? "Unable to save");
      await refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save");
      return false;
    } finally {
      mutating.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    setPage(0);
  }, [kind, search, watchStatus, from, to]);
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      if (mutating.current) return;
      const ticket = generation.current;
      setLoading(true);
      try {
        const response = await fetch(endpoint, { cache: "no-store", signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Unable to load history");
        if (!controller.signal.aborted && ticket === generation.current) {
          setData(result);
          setError("");
        }
      } catch (error) {
        if (!controller.signal.aborted)
          setError(error instanceof Error ? error.message : "Unable to load history");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    const debounce = setTimeout(() => {
      void load();
    }, 200);
    const timer = setInterval(() => {
      void load();
    }, 60000);
    return () => {
      clearTimeout(debounce);
      clearInterval(timer);
      controller.abort();
    };
  }, [endpoint]);
  const grouped = data.grouped;
  const { recorded, imported: estimated } = data.totals;
  const contributions = useMemo(
    () =>
      new Map(
        data.days.map((day) => [day.day, { recorded: day.recorded, estimated: day.imported }]),
      ),
    [data.days],
  );

  const streak = useMemo(() => {
    const dates = [...contributions]
      .filter(([, v]) => v.recorded + v.estimated > 0)
      .map(([d]) => d)
      .sort();
    let longest = 0,
      current = 0,
      last = "";
    for (const d of dates) {
      current = last && dayOffset(last, 1) === d ? current + 1 : 1;
      longest = Math.max(longest, current);
      last = d;
    }
    return longest;
  }, [contributions]);
  useEffect(() => {
    setListPage(0);
  }, [kind, search, statusFilter]);
  const catalogMatches = data.titles.filter(
    (t) =>
      (kind === "all" || t.kind === kind) &&
      (statusFilter === "all" || t.status === statusFilter) &&
      t.name.toLowerCase().includes(search.toLowerCase()),
  );
  const catalog = catalogMatches.slice(listPage * 100, (listPage + 1) * 100);
  const heatStart = dayOffset(today, -364),
    heatDays = Array.from({ length: 365 }, (_, i) => dayOffset(heatStart, i));
  const heatMax = Math.max(
    3600,
    ...[...contributions.values()].map((v) => v.recorded + v.estimated),
  );
  function openImport() {
    setImportMode("merge");
    setImportSelection([]);
    if (upload.current) upload.current.value = "";
    setImportOpen(true);
  }
  async function importFiles(files: File[]) {
    if (!files.length || mutating.current) return;
    if (importMode === "use-import-dates" && !files.some((file) => /\.json$/i.test(file.name))) {
      setError("Choose the JSON file from your SIMKL backup to correct episode dates.");
      return;
    }
    mutating.current = true;
    generation.current++;
    setBusy(true);
    setError("");
    try {
      let count = 0;
      for (const file of [...files].sort(
        (a, b) => Number(a.name.endsWith(".csv")) - Number(b.name.endsWith(".csv")),
      )) {
        const form = new FormData();
        form.set("file", file);
        form.set("importMode", importMode);
        const r = await fetch(endpoint, { method: "POST", body: form }),
          v = await r.json();
        if (!r.ok) throw new Error(v.error ?? "Import failed");
        count += v.imported;
      }
      await refresh();
      setImportOpen(false);
      setMessage(
        `Imported ${count} title records.${importMode === "use-import-dates" ? " Matching imported dates now use this JSON, including earlier dates." : " Existing entries keep their latest dates."}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
      mutating.current = false;
      if (upload.current) upload.current.value = "";
    }
  }
  function poster(w: Watch) {
    const session = w.sessions.find((s) => data.images[s.id]);
    const image = session ? data.images[session.id] : undefined;
    return image
      ? getJellyfinImageUrl(serverUrl, image.itemId, image.tag, {
          width: 160,
          height: 240,
        })
      : data.settings.remotePosters
        ? simklPoster(w.title.poster)
        : null;
  }
  function Recap({ entry }: { entry: Extract<Data["timeline"][number], { type: "recap" }> }) {
    const {
      recorded: rec,
      imported: est,
      count,
      active,
      categories,
      average,
      peak,
      activity,
    } = entry.summary;
    const monthLabel = new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      month: "long",
      year: "numeric",
    }).format(new Date(`${entry.start}T12:00:00Z`));
    const shortDate = (day: string) =>
      new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(
        new Date(`${day}T12:00:00Z`),
      );
    const title =
      entry.period === "month"
        ? monthLabel
        : `${shortDate(entry.start)} – ${shortDate(entry.end)}, ${entry.end.slice(0, 4)}`;
    const ongoing = entry.start <= today && entry.end >= today;
    const categoryLabel = { tv: "TV shows", movie: "movies", anime: "anime" };
    const maxActivity = Math.max(1, ...activity.map((day) => day.seconds));
    return (
      <section className={`wl-recap wl-recap--${entry.period}`} aria-label={`${title} recap`}>
        <div className="wl-recap-period">
          {title}
          {ongoing ? " · so far" : ""}
        </div>
        <div className="wl-recap-overview">
          <div className="wl-recap-intro">
            <Hourglass size={58} strokeWidth={1.5} aria-hidden="true" />
            <h2>
              {entry.period === "month"
                ? ongoing
                  ? "This month,"
                  : "That month,"
                : ongoing
                  ? "This week,"
                  : "That week,"}
              <br />
              you watched
            </h2>
          </div>
          {categories.map((category) => (
            <div className="wl-recap-category" key={category.kind}>
              <span>
                {category.titles}{" "}
                {category.titles === 1 && category.kind !== "anime"
                  ? category.kind === "tv"
                    ? "TV show"
                    : "movie"
                  : categoryLabel[category.kind]}
              </span>
              <strong>{seconds(category.seconds)}</strong>
            </div>
          ))}
        </div>
        <div className="wl-recap-statbar">
          <div>
            <span>Total watched</span>
            <strong>{seconds(rec + est)}</strong>
          </div>
          <div>
            <span>Days with activity</span>
            <strong>
              {active} {active === 1 ? "day" : "days"}
            </strong>
            <div className="wl-recap-activity" aria-label={`${active} days with activity`}>
              {activity.map((day) => (
                <i
                  key={day.day}
                  title={`${shortDate(day.day)}: ${seconds(day.seconds)}`}
                  style={{
                    background: day.seconds
                      ? `rgba(68, 147, 235, ${0.3 + (0.7 * day.seconds) / maxActivity})`
                      : undefined,
                  }}
                />
              ))}
            </div>
          </div>
          <div>
            <span>Average per active day</span>
            <strong>{seconds(average)}</strong>
          </div>
          <div>
            <span>Most active day</span>
            <strong>{peak ? shortDate(peak.day) : "None"}</strong>
            {peak && <small>{seconds(peak.seconds)}</small>}
          </div>
          <div>
            <span>Completed watches</span>
            <strong>{count}</strong>
          </div>
        </div>
        {categories
          .filter((category) => category.top.length)
          .map((category) => {
            const Icon = category.kind === "movie" ? Film : Tv;
            return (
              <div
                className={`wl-recap-ranking wl-recap-ranking--${category.kind}`}
                key={category.kind}
              >
                <div className="wl-recap-ranking-label">
                  <Icon size={30} strokeWidth={1.5} />
                  <span>
                    Most watched
                    <br />
                    {categoryLabel[category.kind]}
                  </span>
                </div>
                <div className="wl-recap-posters">
                  {category.top.map((item, index) => {
                    const image = item.image
                      ? getJellyfinImageUrl(serverUrl, item.image.itemId, item.image.tag, {
                          width: 160,
                          height: 240,
                        })
                      : data.settings.remotePosters
                        ? simklPoster(item.title.poster)
                        : null;
                    return (
                      <article className="wl-recap-title" key={item.title.key}>
                        <div className="wl-recap-poster">
                          {image ? (
                            <img
                              src={image}
                              alt=""
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              onError={(event) => {
                                event.currentTarget.style.display = "none";
                              }}
                            />
                          ) : (
                            <Icon size={28} strokeWidth={1.5} />
                          )}
                        </div>
                        <div className="wl-recap-title-info">
                          <b>{index + 1}</b>
                          <h3>{item.title.name}</h3>
                          <p>
                            {item.count} completed {item.count === 1 ? "watch" : "watches"}
                          </p>
                          <small>{seconds(item.seconds)}</small>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            );
          })}
        {!categories.some((category) => category.top.length) && (
          <p className="wl-recap-empty">No dated viewing in this period.</p>
        )}
        <p className="wl-recap-source">
          {seconds(rec)} recorded · {seconds(est)} imported/manual runtime
          {data.settings.includeImportedStats
            ? " · Imported/estimated history included"
            : " · Imported/estimated history excluded"}
        </p>
      </section>
    );
  }
  async function submitManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget),
      name = String(f.get("name") ?? "").trim(),
      k = String(f.get("kind")),
      candidates = data.titles.filter(
        (t) =>
          normalize(t.name) === normalize(name) &&
          t.kind === k &&
          (!f.get("year") || t.year === Number(f.get("year"))),
      );
    const existing = candidates.length === 1 ? candidates[0] : undefined;
    const when = String(f.get("date") ?? "");
    const title = existing ?? {
      key: `manual:${k}:${normalize(name)}:${f.get("year") || "unknown"}`,
      name,
      kind: k,
      year: f.get("year") ? Number(f.get("year")) : undefined,
    };
    const ok = await mutate({
      action: "manual",
      idempotencyKey: (manualRequestId.current ||= newManualRequestKey()),
      entry: {
        title,
        season: k !== "movie" ? Number(f.get("season")) : undefined,
        episode: k !== "movie" ? Number(f.get("episode")) : undefined,
        episodeTitle: String(f.get("episodeTitle") ?? ""),
        watchedAt: when ? validDate(fromZonedTime(when, zone).toISOString()) : null,
        accuracy: when ? "accurate" : "unknown",
        runtime: Number(f.get("minutes")) * 60,
        completed: true,
      },
    });
    if (ok) {
      manualRequestId.current = "";
      setManual(false);
    }
  }
  return (
    <main className="wl" aria-busy={switching}>
      <fieldset disabled={switching} className="wl-user-content">
        <header className="wl-header">
          <div>
            <span className="wl-eyebrow">YOUR WATCH LEDGER</span>
            <h1>
              Every watch.
              <br />
              <em>All in one place.</em>
            </h1>
            <p>{selectedName}’s viewing history, with resumes kept together.</p>
          </div>
          <div className="wl-buttons">
            <label className="wl-user-filter">
              <span>User</span>
              <select
                aria-label="Filter by user"
                value={selectedUserId}
                onChange={(event) => {
                  const query = new URLSearchParams(searchParams.toString());
                  query.set("userId", event.target.value);
                  setSwitching(true);
                  router.push(`${pathname}?${query.toString()}`);
                }}
              >
                {availableUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </label>
            <Link href={`/servers/${serverId}/history`}>Raw sessions</Link>
            <button onClick={openImport} disabled={busy}>
              <Import size={16} /> Import SIMKL
            </button>
            <button
              className="wl-primary"
              onClick={() => {
                manualRequestId.current = "";
                setManual(true);
              }}
            >
              <Plus size={16} /> Log a watch
            </button>
            <button
              onClick={() => {
                settingsBaseline.current = data.settings;
                setSettings(true);
              }}
              aria-label="History settings"
            >
              <Settings2 size={17} />
            </button>
          </div>
        </header>
        {error && (
          <div className="wl-error" role="alert">
            {error}
          </div>
        )}
        {message && (
          <div className="wl-message" role="status">
            {message}
            <button onClick={() => setMessage("")} aria-label="Dismiss">
              <X size={14} />
            </button>
          </div>
        )}
        <label className="wl-import-toggle">
          <input
            type="checkbox"
            checked={data.settings.includeImportedStats}
            disabled={busy}
            onChange={(event) =>
              void mutate({
                action: "settings",
                settings: { includeImportedStats: event.currentTarget.checked },
              })
            }
          />
          Include imported/estimated watches in statistics
          <small>Applies to this user in Watch Ledger and Streamystats.</small>
        </label>
        <div className="wl-stats">
          <div>
            <span>RECORDED PLAYBACK</span>
            <strong>{seconds(recorded)}</strong>
            <small>Actual session time</small>
          </div>
          <div>
            <span>COMPLETED WATCHES</span>
            <strong>{data.totals.completed.toLocaleString("en-US")}</strong>
            <small>
              {data.totals.completedTitles} titles · {data.sessionCount} sessions
            </small>
          </div>
          <div>
            <span>COMPLETED REWATCHES</span>
            <strong>{data.totals.rewatches}</strong>
            <small>Repeated watches, not resumes</small>
          </div>
          <div>
            <span>IMPORTED / MANUAL RUNTIME</span>
            <strong>{seconds(data.availableImportedSeconds)}</strong>
            <small>
              {data.settings.includeImportedStats
                ? "Included in statistics"
                : "Manual logs included; imports excluded"}
            </small>
          </div>
        </div>
        <nav className="wl-nav">
          <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>
            <Clock size={16} /> History
          </button>
          <button className={tab === "lists" ? "active" : ""} onClick={() => setTab("lists")}>
            <Film size={16} /> My lists
          </button>
          <div className="wl-kind">
            {[
              ["all", "All"],
              ["tv", "TV shows"],
              ["movie", "Movies"],
              ["anime", "Anime"],
            ].map(([key, name]) => (
              <button
                key={key}
                className={kind === key ? "active" : ""}
                onClick={() => setKind(key)}
              >
                {name}
              </button>
            ))}
          </div>
        </nav>
        <div className="wl-filter">
          <Search size={17} />
          <input
            aria-label="Search history"
            placeholder="Search your shows, movies, or episodes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {tab === "history" ? (
            <>
              <label>
                Watch status{" "}
                <select
                  aria-label="Watch status"
                  value={watchStatus}
                  onChange={(event) => setWatchStatus(event.target.value)}
                >
                  <option value="all">All watches</option>
                  <option value="in-progress">In progress</option>
                  <option value="completed">Completed</option>
                </select>
              </label>
              <label>
                From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </label>
              <label>
                To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </label>
            </>
          ) : (
            <select
              aria-label="List status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {["all", "planned", "watching", "completed", "on-hold", "dropped"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          )}
        </div>
        {tab === "history" ? (
          <>
            {watchStatus !== "all" && (
              <p role="status" className="wl-watch-status-note">
                {watchStatus === "in-progress"
                  ? "Showing unfinished watches. Open a watch’s edit menu to mark it complete. A completed watch’s earlier resume days are excluded."
                  : "Showing completed watches, including their earlier playback days."}{" "}
                Calendar and recap totals still include all watch statuses.
              </p>
            )}
            <section className="wl-calendar">
              <div className="wl-section-heading">
                <h2>
                  A year, <em>day by day.</em>
                </h2>
                <span>
                  {streak} day longest streak · {zone}
                </span>
              </div>
              <div className="wl-heatmap">
                {heatDays.map((day) => {
                  const d = contributions.get(day),
                    n = (d?.recorded ?? 0) + (d?.estimated ?? 0),
                    level = n ? Math.min(4, Math.max(1, Math.ceil((n / heatMax) * 4))) : 0;
                  return (
                    <button
                      key={day}
                      className={`level-${level}`}
                      aria-label={`${day}: ${seconds(n)}`}
                      title={`${dateLabel(day)}: ${seconds(d?.recorded ?? 0)} recorded + ${seconds(d?.estimated ?? 0)} imported/manual runtime`}
                      onClick={() => {
                        setFrom(day);
                        setTo(day);
                      }}
                    />
                  );
                })}
              </div>
              <div className="wl-calendar-foot">
                <span>
                  Click a day to filter history. Imported dates follow the statistics toggle.
                </span>
                <button
                  onClick={() => {
                    setFrom("");
                    setTo("");
                  }}
                >
                  Clear date filter
                </button>
              </div>
            </section>
            <section className="wl-timeline" aria-busy={loading}>
              <p role="status">
                {loading ? "Loading history…" : `${data.pagination.total} matching history entries`}
              </p>
              {data.timeline.map((entry) => {
                if (entry.type === "recap") return <Recap key={entry.key} entry={entry} />;
                const { day, watches } = entry;
                return (
                  <section key={entry.key} className="wl-day">
                    <div className="wl-day-heading">
                      <CalendarDays size={18} />
                      <h2>{/^\d/.test(day) ? dateLabel(day) : day}</h2>
                      {entry.watchTime && (
                        <span
                          className="wl-day-hours"
                          aria-label={`Daily watch time: ${seconds(entry.watchTime.recorded + entry.watchTime.imported)}`}
                          title={`${seconds(entry.watchTime.recorded)} recorded + ${seconds(entry.watchTime.imported)} imported/manual runtime`}
                        >
                          {seconds(entry.watchTime.recorded + entry.watchTime.imported)}
                        </span>
                      )}
                      <span className="wl-day-count">
                        {watches.length} watch{watches.length === 1 ? "" : "es"}
                      </span>
                    </div>
                    <div className="wl-watch-grid">
                      {watches.map((w) => {
                        const url = poster(w);
                        return (
                          <article className="wl-watch" key={w.id}>
                            {url ? (
                              <img
                                src={url}
                                alt=""
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  const fallback = data.settings.remotePosters
                                    ? simklPoster(w.title.poster)
                                    : null;
                                  if (fallback && e.currentTarget.src !== fallback)
                                    e.currentTarget.src = fallback;
                                  else e.currentTarget.style.display = "none";
                                }}
                              />
                            ) : (
                              <div className="wl-poster">
                                {w.title.kind === "movie" ? <Film /> : <Tv />}
                              </div>
                            )}
                            <div className="wl-watch-info">
                              <div className="wl-watch-title">
                                <h3>
                                  {w.itemId ? (
                                    <Link
                                      className="wl-watch-link"
                                      href={`/servers/${serverId}/library/${encodeURIComponent(w.itemId)}`}
                                      prefetch={false}
                                      aria-label={`Open ${w.title.name}: ${label(w)} item details`}
                                    >
                                      {w.title.name}
                                    </Link>
                                  ) : (
                                    w.title.name
                                  )}
                                </h3>
                                <button
                                  aria-label={`Edit ${w.title.name} watch`}
                                  onClick={() =>
                                    setEdit(
                                      data.watches.find((original) => original.id === w.id) ?? w,
                                    )
                                  }
                                >
                                  <ChevronDown size={16} />
                                </button>
                              </div>
                              <p>{label(w)}</p>
                              <div className="wl-badges">
                                {w.sources.includes("simkl") && <span>Imported · SIMKL</span>}
                                {w.sources.includes("manual") && <span>Manual log</span>}
                                {w.rewatch && (
                                  <span className="wl-repeat">
                                    <Repeat size={11} />{" "}
                                    {w.completed ? "Rewatch" : "Rewatch in progress"}
                                  </span>
                                )}
                                <span>{w.completed ? "Completed" : "In progress"}</span>
                                {w.accuracy === "estimated" && <span>Estimated date</span>}
                                {!w.end && <span>Date unknown</span>}
                                {w.completionBasis === "reported" && <span>Legacy completion</span>}
                              </div>
                              <small>
                                {w.end && w.accuracy === "accurate"
                                  ? formatInTimeZone(w.end, zone, "h:mm a") + " · "
                                  : ""}
                                {w.measuredSeconds
                                  ? seconds(w.measuredSeconds) + " recorded"
                                  : seconds(w.estimatedSeconds) + " imported/manual runtime"}
                                {w.sessions.length
                                  ? ` · ${w.sessions.length} session${w.sessions.length === 1 ? "" : "s"}`
                                  : ""}
                              </small>
                              {w.coverage !== null && (
                                <div
                                  className="wl-progress"
                                  aria-label={`${Math.round(w.coverage * 100)}% viewed`}
                                >
                                  <i
                                    style={{
                                      width: `${Math.round(w.coverage * 100)}%`,
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
              {data.pagination.total > data.pagination.pageSize && (
                <div className="wl-buttons" aria-label="History pages">
                  <button
                    disabled={loading || data.pagination.page === 0}
                    onClick={() => setPage(data.pagination.page - 1)}
                  >
                    Previous page
                  </button>
                  <span>
                    Page {data.pagination.page + 1} of{" "}
                    {Math.ceil(data.pagination.total / data.pagination.pageSize)}
                  </span>
                  <button
                    disabled={loading || !data.pagination.hasNext}
                    onClick={() => setPage(data.pagination.page + 1)}
                  >
                    Next page
                  </button>
                </div>
              )}
              {!grouped.length && (
                <div className="wl-empty">
                  <Clock size={36} />
                  {data.totalWatches ? (
                    <>
                      <h2>No watches match these filters.</h2>
                      <p>Try another watch status, search, media type, or date range.</p>
                      <button
                        onClick={() => {
                          setWatchStatus("all");
                          setSearch("");
                          setKind("all");
                          setFrom("");
                          setTo("");
                        }}
                      >
                        Clear history filters
                      </button>
                    </>
                  ) : (
                    <>
                      <h2>Your history starts here.</h2>
                      <p>
                        Import your SIMKL JSON and CSV, log a watch, or play something in Jellyfin.
                      </p>
                      <button onClick={openImport}>Import history</button>
                    </>
                  )}
                </div>
              )}
            </section>
          </>
        ) : (
          <section className="wl-lists">
            {catalogMatches.length > 100 && (
              <div className="wl-buttons" aria-label="List pages">
                <button disabled={listPage === 0} onClick={() => setListPage((value) => value - 1)}>
                  Previous titles
                </button>
                <span>
                  Page {listPage + 1} of {Math.ceil(catalogMatches.length / 100)}
                </span>
                <button
                  disabled={(listPage + 1) * 100 >= catalogMatches.length}
                  onClick={() => setListPage((value) => value + 1)}
                >
                  Next titles
                </button>
              </div>
            )}
            {catalog.map((t) => (
              <article key={t.key}>
                <h3>{t.name}</h3>
                <p>
                  {t.kind.toUpperCase()} {t.year ?? ""}{" "}
                  {t.latestEpisode ? ` · ${t.latestEpisode}` : ""}
                </p>
                <label>
                  Status{" "}
                  <select
                    value={t.status ?? "planned"}
                    disabled={busy}
                    onChange={(e) =>
                      void mutate({
                        action: "title",
                        title: { ...t, status: e.target.value },
                      })
                    }
                  >
                    {["planned", "watching", "completed", "on-hold", "dropped"].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Rating{" "}
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step=".5"
                    defaultValue={t.rating ?? ""}
                    aria-label={`Rating for ${t.name}`}
                    onBlur={(e) => {
                      if (e.target.value !== "" && Number(e.target.value) !== t.rating)
                        void mutate({
                          action: "title",
                          title: { ...t, rating: Number(e.target.value) },
                        });
                    }}
                  />
                </label>
              </article>
            ))}
            {!catalog.length && <p>No titles match. Import SIMKL to populate your lists.</p>}
          </section>
        )}
        <footer className="wl-footer">
          <p>
            Recorded time and imported runtime estimates stay separate. Sessions spanning midnight
            are assigned to their start date. Deleted Jellyfin metadata can prevent automatic
            episode matching.
          </p>
          {data.hiddenCount > 0 && (
            <button disabled={busy} onClick={() => void mutate({ action: "restore" })}>
              <Undo2 size={14} /> Reset all watch corrections ({data.hiddenCount} hidden)
            </button>
          )}
        </footer>
        {importOpen && (
          <Modal
            label="Import SIMKL history"
            onClose={() => {
              if (!busy) setImportOpen(false);
            }}
          >
            <section className="wl-dialog">
              <div className="wl-section-heading">
                <h2>Import SIMKL history</h2>
                <button
                  disabled={busy}
                  aria-label="Close import"
                  onClick={() => setImportOpen(false)}
                >
                  <X />
                </button>
              </div>
              <p>
                If your backup is a ZIP, extract it first and select the JSON inside. CSV is
                optional for list metadata.
              </p>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void importFiles(importSelection);
                }}
              >
                <label>
                  Reimport dates
                  <select
                    value={importMode}
                    disabled={busy}
                    onChange={(event) => setImportMode(event.target.value)}
                  >
                    <option value="merge">Keep latest dates</option>
                    <option value="use-import-dates">Use dates from this import</option>
                  </select>
                </label>
                <p>
                  {importMode === "use-import-dates"
                    ? "Use corrected JSON dates for matching imported watches, even when earlier. Missing dates keep the existing date. Entries absent from this file, recorded sessions, manual logs, and your watch corrections are preserved."
                    : "Merge new history and keep the later date for existing imported watches. Choose Use dates from this import if you corrected dates in SIMKL."}
                </p>
                <input
                  hidden
                  ref={upload}
                  type="file"
                  accept=".json,.csv"
                  multiple
                  onChange={(e) => setImportSelection(Array.from(e.target.files ?? []))}
                />
                <button type="button" disabled={busy} onClick={() => upload.current?.click()}>
                  Choose JSON / CSV files
                </button>
                <p role="status">
                  {importSelection.length
                    ? importSelection.map((file) => file.name).join(", ")
                    : "No files selected"}
                </p>
                <button
                  className="wl-primary"
                  type="submit"
                  disabled={busy || !importSelection.length}
                >
                  {busy ? "Importing…" : "Import history"}
                </button>
              </form>
              {error && (
                <p className="wl-error" role="alert">
                  {error}
                </p>
              )}
            </section>
          </Modal>
        )}
        {manual && (
          <Modal label="Log a watch" onClose={() => setManual(false)}>
            <section
              className="wl-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="log-title"
            >
              <div className="wl-section-heading">
                <h2 id="log-title">Log a watch</h2>
                <button aria-label="Close" onClick={() => setManual(false)}>
                  <X />
                </button>
              </div>
              <form onSubmit={(e) => void submitManual(e)}>
                <label>
                  Title
                  <input name="name" required maxLength={300} list="wl-titles" />
                  <datalist id="wl-titles">
                    {data.titles.map((t) => (
                      <option key={t.key} value={t.name} />
                    ))}
                  </datalist>
                </label>
                <div className="wl-form-row">
                  <label>
                    Type
                    <select name="kind">
                      <option value="tv">TV episode</option>
                      <option value="movie">Movie</option>
                      <option value="anime">Anime episode</option>
                    </select>
                  </label>
                  <label>
                    Year
                    <input name="year" type="number" min={1800} max={2200} />
                  </label>
                </div>
                <div className="wl-form-row">
                  <label>
                    Season (TV/anime)
                    <input name="season" type="number" min={0} max={1000} defaultValue={1} />
                  </label>
                  <label>
                    Episode (TV/anime)
                    <input name="episode" type="number" min={0} max={100000} defaultValue={1} />
                  </label>
                </div>
                <label>
                  Episode title (optional)
                  <input name="episodeTitle" maxLength={300} />
                </label>
                <label>
                  Watched at ({zone}; leave blank if unknown)
                  <input name="date" type="datetime-local" />
                </label>
                <div className="wl-form-row">
                  <label>
                    Runtime, minutes
                    <input
                      name="minutes"
                      type="number"
                      required
                      min={0}
                      max={1440}
                      defaultValue={45}
                    />
                  </label>
                </div>
                <p>
                  Manual logs use runtime estimates. They do not pretend to be measured playback.
                </p>
                <button className="wl-primary" disabled={busy}>
                  Save watch
                </button>
              </form>
            </section>
          </Modal>
        )}
        {edit && (
          <Modal label="Edit watch" onClose={() => setEdit(null)}>
            <section
              className="wl-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-title"
            >
              <div className="wl-section-heading">
                <h2 id="edit-title">{edit.title.name}</h2>
                <button aria-label="Close" onClick={() => setEdit(null)}>
                  <X />
                </button>
              </div>
              <p>{label(edit)}</p>
              <label>
                <input
                  type="checkbox"
                  checked={edit.completed}
                  onChange={(e) => setEdit({ ...edit, completed: e.target.checked })}
                />{" "}
                Completed watch
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={edit.rewatch}
                  onChange={(e) => setEdit({ ...edit, rewatch: e.target.checked })}
                />{" "}
                This is a rewatch
              </label>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const v = new FormData(e.currentTarget).get("date");
                  const patch = {
                    completed: edit.completed,
                    rewatch: edit.rewatch,
                    ...(v
                      ? {
                          watchedAt: validDate(fromZonedTime(String(v), zone).toISOString()),
                        }
                      : {}),
                  };
                  if (await mutate({ action: "correct", key: edit.id, patch })) setEdit(null);
                }}
              >
                <label>
                  Correct watched date ({zone})
                  <input name="date" type="datetime-local" defaultValue="" />
                </label>
                <button className="wl-primary" disabled={busy}>
                  Save corrections
                </button>
              </form>
              <details>
                <summary>{edit.sessions.length} original playback sessions</summary>
                {edit.sessions.map((s) => (
                  <p key={s.id}>
                    {formatInTimeZone(s.start, zone, "MMM d, h:mm a")} · {seconds(s.seconds)} ·{" "}
                    {s.device}
                  </p>
                ))}
              </details>
              <button
                disabled={busy}
                onClick={async () => {
                  if (await mutate({ action: "resetCorrection", key: edit.id })) setEdit(null);
                }}
              >
                Reset this watch’s corrections
              </button>
              <button
                className="wl-danger"
                disabled={busy}
                onClick={async () => {
                  if (
                    await mutate({
                      action: "correct",
                      key: edit.id,
                      patch: { hidden: true },
                    })
                  )
                    setEdit(null);
                }}
              >
                Remove watch from ledger
              </button>
              <p>Removal is reversible. Original sessions remain in the raw history.</p>
            </section>
          </Modal>
        )}
        {settings && (
          <Modal label="History settings" onClose={() => setSettings(false)}>
            <section
              className="wl-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="settings-title"
            >
              <div className="wl-section-heading">
                <h2 id="settings-title">History settings</h2>
                <button aria-label="Close" onClick={() => setSettings(false)}>
                  <X />
                </button>
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  if (
                    await mutate({
                      action: "settings",
                      settings: changedSettings({
                        completionThreshold: Number(f.get("threshold")) / 100,

                        timezone: String(f.get("timezone")),
                        remotePosters: f.get("remotePosters") === "on",
                        confirmedPriorTitles: String(f.get("priorTitles") ?? "")
                          .split(",")
                          .map(normalize)
                          .filter(Boolean),
                      }),
                    })
                  )
                    setSettings(false);
                }}
              >
                <label>
                  Completion threshold, percent
                  <input
                    name="threshold"
                    type="number"
                    min={50}
                    max={100}
                    defaultValue={data.settings.completionThreshold * 100}
                  />
                </label>

                <label>
                  Timezone
                  <input name="timezone" required defaultValue={zone} />
                </label>
                <label>
                  <input
                    type="checkbox"
                    name="remotePosters"
                    defaultChecked={data.settings.remotePosters}
                  />{" "}
                  Load missing posters from SIMKL’s image server
                </label>
                <label>
                  Confirmed prior viewings (comma-separated titles)
                  <input
                    name="priorTitles"
                    defaultValue={data.settings.confirmedPriorTitles.join(", ")}
                  />
                </label>
                <p>
                  These titles can be recognized as rewatches even when their first-watch dates are
                  unknown.
                </p>

                <button disabled={busy} className="wl-primary">
                  Save settings
                </button>
              </form>
            </section>
          </Modal>
        )}
      </fieldset>
    </main>
  );
}
