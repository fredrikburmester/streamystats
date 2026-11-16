import { watchesForStatistics } from "./statistics-model";
import { ledgerMinutes } from "./duration";
import type { getWatchLedger } from "./store";
import { dayKey, groupHistoryDays, type Watch, type Title } from "./engine";

type Ledger = Awaited<ReturnType<typeof getWatchLedger>>;
const PAGE_SIZE = 100;
const dayOffset = (day: string, amount: number) => {
  const value = new Date(`${day}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
};
export function buildLedgerView(ledger: Ledger, query: URLSearchParams) {
  const zone = ledger.settings.timezone,
    today = dayKey(new Date().toISOString(), zone);
  const kind = query.get("kind") ?? "all",
    search = (query.get("search") ?? "").toLowerCase().slice(0, 300);
  // Keep the underlying watch and coverage intact; this filter only affects Ledger's view.
  const visibleWatches = ledger.watches.flatMap((watch): Watch[] => {
    if (!watch.sessions.length) return [watch];
    const sessions = watch.sessions.filter((session) => ledgerMinutes(session.seconds) > 0);
    if (!sessions.length) return [];
    if (sessions.length === watch.sessions.length) return [watch];
    return [
      {
        ...watch,
        sessions,
        measuredSeconds: sessions.reduce((sum, session) => sum + session.seconds, 0),
        start: watch.dateCorrected
          ? watch.start
          : sessions.reduce(
              (first, session) => (session.start < first ? session.start : first),
              sessions[0].start,
            ),
        end: watch.dateCorrected
          ? watch.end
          : sessions.reduce(
              (last, session) => (session.end > last ? session.end : last),
              sessions[0].end,
            ),
      },
    ];
  });
  const watches = visibleWatches.filter(
    (w) =>
      (kind === "all" || w.title.kind === kind) &&
      `${w.title.name} ${w.episodeTitle}`.toLowerCase().includes(search),
  );
  const statistical = watchesForStatistics(watches, ledger.settings.includeImportedStats);
  const completed = statistical.filter((w) => w.completed);
  const days = new Map<
    string,
    { day: string; recorded: number; imported: number; count: number }
  >();
  const getDay = (day: string) => {
    let row = days.get(day);
    if (!row) {
      row = { day, recorded: 0, imported: 0, count: 0 };
      days.set(day, row);
    }
    return row;
  };
  type Rank = {
    title: Title;
    seconds: number;
    count: number;
    image?: { itemId: string; tag: string };
  };
  const ranks = new Map<string, Map<string, Rank>>();
  const watchImages = new Map(
    statistical.map((watch) => [
      watch.id,
      watch.sessions.map((session) => ledger.images[session.id]).find(Boolean),
    ]),
  );
  const addRank = (day: string, watch: Watch, seconds: number, count: number) => {
    const byTitle = ranks.get(day) ?? new Map<string, Rank>();
    const row: Rank = byTitle.get(watch.title.key) ?? { title: watch.title, seconds: 0, count: 0 };
    row.image ??= watchImages.get(watch.id);
    row.seconds += seconds;
    row.count += count;
    byTitle.set(watch.title.key, row);
    ranks.set(day, byTitle);
  };
  for (const watch of statistical) {
    for (const session of watch.sessions) {
      const day = dayKey(session.start, zone);
      getDay(day).recorded += session.seconds;
      addRank(day, watch, session.seconds, 0);
    }
    if (watch.end) {
      const key = dayKey(watch.end, zone),
        day = getDay(key);
      day.imported += watch.estimatedSeconds;
      if (watch.completed) day.count++;
      addRank(key, watch, watch.estimatedSeconds, watch.completed ? 1 : 0);
    }
  }
  const recap = (start: string, end: string) => {
    const matches = (day: string) => day >= start && day < end;
    const rows = [...days.values()].filter((row) => matches(row.day));
    const top = new Map<string, Rank>();
    for (const [day, byTitle] of ranks)
      if (matches(day))
        for (const [key, contribution] of byTitle) {
          const row: Rank = top.get(key) ?? { title: contribution.title, seconds: 0, count: 0 };
          row.image ??= contribution.image;
          row.seconds += contribution.seconds;
          row.count += contribution.count;
          top.set(key, row);
        }
    const ranked = [...top.values()]
      .filter((row) => row.seconds > 0)
      .sort((a, b) => b.seconds - a.seconds);
    const categories = (["tv", "movie", "anime"] as const).map((kind) => {
      const titles = ranked.filter((row) => row.title.kind === kind);
      return {
        kind,
        titles: titles.length,
        seconds: titles.reduce((sum, row) => sum + row.seconds, 0),
        top: titles.slice(0, 3),
      };
    });
    const activity = rows.filter((row) => row.recorded + row.imported > 0);
    const peak = [...activity].sort(
      (a, b) => b.recorded + b.imported - (a.recorded + a.imported),
    )[0];
    return {
      categories,
      average: activity.length
        ? activity.reduce((sum, row) => sum + row.recorded + row.imported, 0) / activity.length
        : 0,
      peak: peak ? { day: peak.day, seconds: peak.recorded + peak.imported } : null,
      activity: Array.from(
        { length: Math.round((Date.parse(end) - Date.parse(start)) / 86400000) },
        (_, index) => {
          const day = dayOffset(start, index),
            row = days.get(day);
          return { day, seconds: (row?.recorded ?? 0) + (row?.imported ?? 0) };
        },
      ),
      recorded: rows.reduce((sum, row) => sum + row.recorded, 0),
      imported: rows.reduce((sum, row) => sum + row.imported, 0),
      count: rows.reduce((sum, row) => sum + row.count, 0),
      active: rows.filter((row) => row.recorded + row.imported > 0).length,
      top: ranked.slice(0, 3),
    };
  };
  const monthInput = query.get("month"),
    weekInput = query.get("week");
  const month =
    monthInput && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthInput) ? monthInput : today.slice(0, 7);
  const monthEnd = new Date(`${month}-01T12:00:00Z`);
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);
  const weekDay = new Date(`${today}T12:00:00Z`).getUTCDay();
  const week =
    weekInput && /^\d{4}-\d{2}-\d{2}$/.test(weekInput) && Number.isFinite(Date.parse(weekInput))
      ? weekInput
      : dayOffset(today, -((weekDay + 6) % 7));
  const status = query.get("watchStatus") ?? "all";
  const from = query.get("from") ?? "",
    to = query.get("to") ?? "";
  const cards = groupHistoryDays(
    watches.filter(
      (w) => status === "all" || (status === "completed" ? w.completed : !w.completed),
    ),
    zone,
  )
    .filter(
      ([day]) =>
        !(from || to) || (/^\d{4}/.test(day) && (!from || day >= from) && (!to || day <= to)),
    )
    .flatMap(([day, rows]) => rows.map((watch) => ({ day, watch })));
  const requestedPage = Number(query.get("page") ?? 0);
  const page = Math.max(
    0,
    Math.min(
      Number.isSafeInteger(requestedPage) ? requestedPage : 0,
      Math.max(0, Math.ceil(cards.length / PAGE_SIZE) - 1),
    ),
  );
  const visible = cards.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const grouped = new Map<string, Watch[]>();
  for (const { day, watch } of visible) grouped.set(day, [...(grouped.get(day) ?? []), watch]);
  const ids = new Set(visible.map((row) => row.watch.id));
  const originals = watches.filter((watch) => ids.has(watch.id));
  const sessionIds = new Set(
    originals.flatMap((watch) => watch.sessions.map((session) => session.id)),
  );
  type Summary = ReturnType<typeof recap>;
  type TimelineEntry =
    | {
        type: "day";
        key: string;
        day: string;
        watches: Watch[];
        watchTime: { recorded: number; imported: number } | null;
      }
    | {
        type: "recap";
        key: string;
        period: "month" | "week";
        start: string;
        end: string;
        summary: Summary;
      };
  const timeline: TimelineEntry[] = [];
  const monday = (day: string) =>
    dayOffset(day, -((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7));
  let cursor = page * PAGE_SIZE;
  for (const [day, rows] of grouped) {
    const previousDay = cards[cursor - 1]?.day;
    if (/^\d{4}/.test(day)) {
      if (!previousDay || previousDay.slice(0, 7) !== day.slice(0, 7)) {
        const start = `${day.slice(0, 7)}-01`,
          endDate = new Date(`${start}T12:00:00Z`);
        endDate.setUTCMonth(endDate.getUTCMonth() + 1);
        const end = endDate.toISOString().slice(0, 10);
        timeline.push({
          type: "recap",
          key: `month:${start}`,
          period: "month",
          start,
          end: dayOffset(end, -1),
          summary: recap(start, end),
        });
      }
      const start = monday(day);
      if (!previousDay || !/^\d{4}/.test(previousDay) || monday(previousDay) !== start)
        timeline.push({
          type: "recap",
          key: `week:${start}`,
          period: "week",
          start,
          end: dayOffset(start, 6),
          summary: recap(start, dayOffset(start, 7)),
        });
    }
    const totals = days.get(day);
    timeline.push({
      type: "day",
      key: `day:${day}`,
      day,
      watches: rows,
      // Use all matching activity for the date, even when its cards span pages.
      watchTime: /^\d{4}/.test(day)
        ? { recorded: totals?.recorded ?? 0, imported: totals?.imported ?? 0 }
        : null,
    });
    cursor += rows.length;
  }
  return {
    watches: originals,
    timeline,
    availableImportedSeconds: watches.reduce((sum, watch) => sum + watch.estimatedSeconds, 0),
    grouped: [...grouped.entries()],
    titles: ledger.titles,
    settings: ledger.settings,
    images: Object.fromEntries(Object.entries(ledger.images).filter(([id]) => sessionIds.has(id))),
    sessionCount: new Set(
      visibleWatches.flatMap((watch) => watch.sessions.map((session) => session.id)),
    ).size,
    hiddenCount: ledger.hiddenCount,
    totalWatches: visibleWatches.length,
    totals: {
      recorded: statistical.reduce((sum, watch) => sum + watch.measuredSeconds, 0),
      imported: statistical.reduce((sum, watch) => sum + watch.estimatedSeconds, 0),
      completed: completed.length,
      completedTitles: new Set(completed.map((watch) => watch.title.key)).size,
      rewatches: completed.filter((watch) => watch.rewatch).length,
    },
    days: [...days.values()],
    recaps: {
      month: recap(`${month}-01`, monthEnd.toISOString().slice(0, 10)),
      week: recap(week, dayOffset(week, 7)),
    },
    pagination: {
      page,
      pageSize: PAGE_SIZE,
      total: cards.length,
      hasNext: (page + 1) * PAGE_SIZE < cards.length,
    },
  };
}
